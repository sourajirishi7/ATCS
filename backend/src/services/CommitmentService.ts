import { prisma, toDecimalNumber } from '../prisma';
import { CommitmentStatus, RoleType } from '@prisma/client';
import { AuthUser } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { AuditService } from './AuditService';
import { emitEvent } from '../socket';

export class CommitmentService {
  /**
   * List commitments filtered by role & department
   */
  public static async getCommitments(user: AuthUser, status?: CommitmentStatus) {
    const where: any = {};

    if (user.role === RoleType.EMPLOYEE) {
      where.spendingRequest = { employeeId: user.id };
    } else if (user.role === RoleType.MANAGER && user.departmentId) {
      where.spendingRequest = { departmentId: user.departmentId };
    }

    if (status) {
      where.status = status;
    }

    return prisma.commitment.findMany({
      where,
      include: {
        spendingRequest: {
          include: {
            employee: { select: { id: true, name: true, email: true } },
            department: true,
            category: true,
          },
        },
        transactions: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Fetch single commitment by ID
   */
  public static async getCommitmentById(id: string) {
    const commitment = await prisma.commitment.findUnique({
      where: { id },
      include: {
        spendingRequest: {
          include: {
            employee: { select: { id: true, name: true, email: true } },
            department: true,
            category: true,
          },
        },
        transactions: true,
      },
    });

    if (!commitment) {
      throw new AppError('Commitment not found.', 404, 'COMMITMENT_NOT_FOUND');
    }

    return commitment;
  }

  /**
   * Cancel an outstanding commitment
   */
  public static async cancelCommitment(id: string, reason: string, user: AuthUser) {
    const commitment = await prisma.commitment.findUnique({
      where: { id },
      include: { spendingRequest: true },
    });

    if (!commitment) {
      throw new AppError('Commitment not found.', 404, 'COMMITMENT_NOT_FOUND');
    }

    if (commitment.status === CommitmentStatus.SETTLED) {
      throw new AppError('Cannot cancel a fully settled commitment.', 400, 'ALREADY_SETTLED');
    }

    const updated = await prisma.commitment.update({
      where: { id },
      data: { status: CommitmentStatus.CANCELLED },
    });

    await AuditService.createLog({
      userId: user.id,
      action: 'COMMITMENT_CANCELLED',
      entityType: 'Commitment',
      entityId: commitment.id,
      previousValue: JSON.stringify({ status: commitment.status, remaining: toDecimalNumber(commitment.remainingAmount) }),
      newValue: JSON.stringify({ status: CommitmentStatus.CANCELLED }),
      metadata: JSON.stringify({ reason }),
    });

    emitEvent('dashboard.updated', { departmentId: commitment.spendingRequest.departmentId });

    return updated;
  }
}
