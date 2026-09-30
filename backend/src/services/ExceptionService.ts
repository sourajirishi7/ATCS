import { prisma } from '../prisma';
import { ExceptionDecision, SpendingStatus, CommitmentStatus, RoleType } from '@prisma/client';
import { AuthUser } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { AuditService } from './AuditService';
import { emitEvent } from '../socket';

export class ExceptionService {
  /**
   * Request an exception override for a rejected or policy-violating request
   */
  public static async createException(spendingRequestId: string, reason: string, user: AuthUser) {
    const request = await prisma.spendingRequest.findUnique({
      where: { id: spendingRequestId },
    });

    if (!request) {
      throw new AppError('Spending request not found.', 404, 'REQUEST_NOT_FOUND');
    }

    if (request.status !== SpendingStatus.REJECTED) {
      throw new AppError('Exceptions can only be filed for rejected or policy-violating requests.', 400, 'INVALID_STATUS');
    }

    const exception = await prisma.exception.create({
      data: {
        spendingRequestId,
        type: 'POLICY_OVERRIDE_REQUEST',
        reason,
        requestedBy: user.id,
        decision: ExceptionDecision.PENDING,
      },
      include: {
        spendingRequest: true,
        requester: { select: { id: true, name: true, email: true } },
      },
    });

    await AuditService.createLog({
      userId: user.id,
      action: 'EXCEPTION_CREATED',
      entityType: 'Exception',
      entityId: exception.id,
      newValue: JSON.stringify({ spendingRequestId, reason }),
    });

    emitEvent('dashboard.updated', { departmentId: request.departmentId });

    return exception;
  }

  /**
   * Review and decide an exception override (Finance / Admin role only)
   */
  public static async reviewException(
    exceptionId: string,
    decision: ExceptionDecision,
    justification: string,
    user: AuthUser
  ) {
    if (user.role !== RoleType.FINANCE && user.role !== RoleType.ADMIN) {
      throw new AppError('Only Finance or Admin can review exception overrides.', 403, 'FORBIDDEN_ROLE');
    }

    const result = await prisma.$transaction(async (tx) => {
      const exception = await tx.exception.findUnique({
        where: { id: exceptionId },
        include: { spendingRequest: true },
      });

      if (!exception) {
        throw new AppError('Exception request not found.', 404, 'EXCEPTION_NOT_FOUND');
      }

      if (exception.decision !== ExceptionDecision.PENDING) {
        throw new AppError('Exception has already been reviewed.', 400, 'ALREADY_REVIEWED');
      }

      const updatedException = await tx.exception.update({
        where: { id: exceptionId },
        data: {
          decision,
          reviewedBy: user.id,
          reviewedAt: new Date(),
        },
      });

      let updatedRequest = null;
      let commitment = null;

      if (decision === ExceptionDecision.APPROVED) {
        // Finance override approved: convert request to COMMITTED and create commitment
        updatedRequest = await tx.spendingRequest.update({
          where: { id: exception.spendingRequestId },
          data: { status: SpendingStatus.COMMITTED },
        });

        commitment = await tx.commitment.create({
          data: {
            spendingRequestId: exception.spendingRequestId,
            committedAmount: exception.spendingRequest.requestedAmount,
            remainingAmount: exception.spendingRequest.requestedAmount,
            status: CommitmentStatus.ACTIVE,
          },
        });
      }

      // Record mandatory override audit trail
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: decision === ExceptionDecision.APPROVED ? 'EXCEPTION_OVERRIDE_APPROVED' : 'EXCEPTION_OVERRIDE_REJECTED',
          entityType: 'Exception',
          entityId: exceptionId,
          previousValue: JSON.stringify({ decision: exception.decision, originalVerdict: 'VIOLATION' }),
          newValue: JSON.stringify({
            decision,
            justification,
            spendingRequestId: exception.spendingRequestId,
            newStatus: updatedRequest ? updatedRequest.status : exception.spendingRequest.status,
          }),
          metadata: JSON.stringify({
            authorizedFinanceOfficer: user.name,
            officerEmail: user.email,
            timestamp: new Date().toISOString(),
          }),
        },
      });

      return {
        exception: updatedException,
        request: updatedRequest,
        commitment,
      };
    });

    emitEvent('dashboard.updated', {});

    return result;
  }

  /**
   * List pending and reviewed exceptions
   */
  public static async getExceptions(decision?: ExceptionDecision) {
    const where: any = {};
    if (decision) where.decision = decision;

    return prisma.exception.findMany({
      where,
      include: {
        spendingRequest: {
          include: {
            employee: { select: { id: true, name: true, email: true } },
            department: true,
            category: true,
            decisionSnapshot: true,
          },
        },
        requester: { select: { id: true, name: true, email: true } },
        reviewer: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
