import { prisma, toDecimal, toDecimalNumber } from '../prisma';
import {
  TransactionStatus,
  TransactionSource,
  CommitmentStatus,
  AlertSeverity,
} from '../models/types';
import Decimal from 'decimal.js';
import { AppError } from '../middleware/errorHandler';
import { AuthUser } from '../middleware/auth';
import { AuditService } from './AuditService';
import { AlertService } from './AlertService';
import { emitEvent } from '../socket';

export interface CreateTransactionInput {
  employeeId?: string;
  departmentId: string;
  categoryId: string;
  amount: number;
  currency?: string;
  transactionDate?: Date | string;
  vendor: string;
  referenceNumber: string;
  source?: TransactionSource;
  commitmentId?: string | null;
}

export class TransactionService {
  /**
   * Settles an actual financial transaction, reconciling against commitments
   */
  public static async recordTransaction(data: CreateTransactionInput, user?: AuthUser) {
    const amount = new Decimal(data.amount);
    if (amount.lessThanOrEqualTo(0)) {
      throw new AppError('Transaction amount must be strictly positive.', 400, 'INVALID_TRANSACTION_AMOUNT');
    }

    // 1. Duplicate reference number check
    const existing = await prisma.transaction.findUnique({
      where: { referenceNumber: data.referenceNumber },
    });
    if (existing) {
      throw new AppError(
        `Duplicate transaction detected: Reference number '${data.referenceNumber}' already exists.`,
        409,
        'DUPLICATE_TRANSACTION_REF',
        'Check bank statement or invoice to ensure transaction was not already recorded.'
      );
    }

    // 2. Execute Settlement Transaction
    const result = await prisma.$transaction(async (tx) => {
      // Find employee ID (fallback to user if not provided)
      const employeeId = data.employeeId || user?.id;
      if (!employeeId) {
        throw new AppError('An associated employee must be specified for the transaction.', 400, 'MISSING_EMPLOYEE');
      }

      // Check department and category existence
      const [dept, cat] = await Promise.all([
        tx.department.findUnique({ where: { id: data.departmentId } }),
        tx.category.findUnique({ where: { id: data.categoryId } }),
      ]);
      if (!dept) throw new AppError('Department not found.', 404, 'DEPARTMENT_NOT_FOUND');
      if (!cat) throw new AppError('Category not found.', 404, 'CATEGORY_NOT_FOUND');

      let updatedCommitment = null;

      // 3. Reconcile with Commitment if linked
      if (data.commitmentId) {
        const commitment = await tx.commitment.findUnique({
          where: { id: data.commitmentId },
        });

        if (!commitment) {
          throw new AppError('Linked commitment not found.', 404, 'COMMITMENT_NOT_FOUND');
        }

        if (commitment.status === CommitmentStatus.SETTLED || commitment.status === CommitmentStatus.CANCELLED) {
          throw new AppError(
            `Commitment is in '${commitment.status}' state and cannot be settled against.`,
            400,
            'COMMITMENT_NOT_ACTIVE'
          );
        }

        const currRemaining = new Decimal(commitment.remainingAmount.toString());
        const newRemaining = Decimal.max(0, currRemaining.minus(amount));
        const newStatus = newRemaining.isZero() ? CommitmentStatus.SETTLED : CommitmentStatus.PARTIALLY_SETTLED;

        updatedCommitment = await tx.commitment.update({
          where: { id: commitment.id },
          data: {
            remainingAmount: newRemaining,
            status: newStatus,
          },
        });
      }

      // 4. Create Transaction record
      const transaction = await tx.transaction.create({
        data: {
          employeeId,
          departmentId: data.departmentId,
          categoryId: data.categoryId,
          amount,
          currency: data.currency || 'INR',
          transactionDate: data.transactionDate ? new Date(data.transactionDate) : new Date(),
          vendor: data.vendor,
          referenceNumber: data.referenceNumber,
          source: data.source || TransactionSource.MANUAL,
          status: TransactionStatus.RECORDED,
          commitmentId: data.commitmentId || undefined,
        },
      });

      // 5. Immutable Audit Log
      await tx.auditLog.create({
        data: {
          userId: user?.id || employeeId,
          action: 'TRANSACTION_CREATED',
          entityType: 'Transaction',
          entityId: transaction.id,
          newValue: JSON.stringify({
            amount: toDecimalNumber(amount),
            vendor: data.vendor,
            referenceNumber: data.referenceNumber,
            commitmentId: data.commitmentId,
            commitmentRemaining: updatedCommitment ? toDecimalNumber(updatedCommitment.remainingAmount) : null,
          }),
        },
      });

      return { transaction, commitment: updatedCommitment };
    });

    // Post-settlement real-time notifications
    emitEvent('transaction.created', result.transaction, data.departmentId);
    emitEvent('dashboard.updated', { departmentId: data.departmentId });

    return result;
  }

  /**
   * Reverse an existing transaction (never delete transactions silently)
   */
  public static async reverseTransaction(transactionId: string, reason: string, user: AuthUser) {
    const txRecord = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!txRecord) {
      throw new AppError('Transaction not found.', 404, 'TRANSACTION_NOT_FOUND');
    }

    if (txRecord.status === TransactionStatus.REVERSED) {
      throw new AppError('Transaction has already been reversed.', 400, 'ALREADY_REVERSED');
    }

    const reversed = await prisma.$transaction(async (tx) => {
      // Restore commitment if linked
      if (txRecord.commitmentId) {
        const commitment = await tx.commitment.findUnique({
          where: { id: txRecord.commitmentId },
        });

        if (commitment) {
          const restoredRemaining = new Decimal(commitment.remainingAmount.toString()).plus(txRecord.amount.toString());
          await tx.commitment.update({
            where: { id: commitment.id },
            data: {
              remainingAmount: restoredRemaining,
              status: CommitmentStatus.ACTIVE,
            },
          });
        }
      }

      const updated = await tx.transaction.update({
        where: { id: transactionId },
        data: { status: TransactionStatus.REVERSED },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'TRANSACTION_REVERSED',
          entityType: 'Transaction',
          entityId: transactionId,
          previousValue: JSON.stringify({ status: txRecord.status }),
          newValue: JSON.stringify({ status: TransactionStatus.REVERSED, reason }),
        },
      });

      return updated;
    });

    emitEvent('dashboard.updated', { departmentId: txRecord.departmentId });

    return reversed;
  }

  /**
   * List transactions with filters
   */
  public static async getTransactions(filters: {
    departmentId?: string;
    categoryId?: string;
    status?: TransactionStatus;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};
    if (filters.departmentId) where.departmentId = filters.departmentId;
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.status) where.status = filters.status;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          employee: { select: { id: true, name: true, email: true } },
          department: true,
          category: true,
          commitment: true,
        },
        orderBy: { transactionDate: 'desc' },
        take: filters.limit || 100,
        skip: filters.offset || 0,
      }),
      prisma.transaction.count({ where }),
    ]);

    return { transactions, total };
  }
}
