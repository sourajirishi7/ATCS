import { prisma, toDecimal, toDecimalNumber } from '../prisma';
import {
  ApprovalDecision,
  SpendingStatus,
  CommitmentStatus,
  RoleType,
} from '../models/types';
import { AppError } from '../middleware/errorHandler';
import { AuthUser } from '../middleware/auth';
import { emitEvent } from '../socket';

export class ApprovalService {
  /**
   * Retrieves pending spending requests awaiting review
   */
  public static async getPendingApprovals(user: AuthUser) {
    const where: any = {
      status: SpendingStatus.UNDER_REVIEW,
    };

    // Department isolation: Managers only see requests from their department
    if (user.role === RoleType.MANAGER && user.departmentId) {
      where.departmentId = user.departmentId;
    }

    return prisma.spendingRequest.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, email: true } },
        department: true,
        category: true,
        decisionSnapshot: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Authoritative decision processing (APPROVE / REJECT) inside an atomic PostgreSQL transaction
   */
  public static async processDecision(
    spendingRequestId: string,
    decision: ApprovalDecision,
    comments: string,
    user: AuthUser
  ) {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch spending request with relations
      const request = await tx.spendingRequest.findUnique({
        where: { id: spendingRequestId },
        include: { employee: true, department: true },
      });

      if (!request) {
        throw new AppError('Spending request not found.', 404, 'REQUEST_NOT_FOUND');
      }

      if (request.status !== SpendingStatus.UNDER_REVIEW) {
        throw new AppError(
          `Request cannot be reviewed because it is in '${request.status}' status (must be UNDER_REVIEW).`,
          400,
          'INVALID_STATUS_FOR_APPROVAL'
        );
      }

      // 2. Strict Self-Approval Prevention (Enforced for all roles)
      if (request.employeeId === user.id) {
        throw new AppError(
          'Self-approval violation: Users cannot approve their own spending requests under ATCS corporate governance.',
          403,
          'SELF_APPROVAL_PROHIBITED',
          'A separate manager or authorized finance officer must review this request.'
        );
      }

      // 3. Department scope check for Managers
      if (user.role === RoleType.MANAGER && request.departmentId !== user.departmentId) {
        throw new AppError(
          'Department authorization violation: Managers can only review requests within their assigned department.',
          403,
          'CROSS_DEPARTMENT_FORBIDDEN'
        );
      }

      // 4. Create Approval record
      const approval = await tx.approval.create({
        data: {
          spendingRequestId: request.id,
          approverId: user.id,
          decision,
          comments,
        },
      });

      let commitment = null;
      let newStatus: SpendingStatus;

      if (decision === ApprovalDecision.APPROVED) {
        newStatus = SpendingStatus.COMMITTED;

        // Atomically create Commitment
        commitment = await tx.commitment.create({
          data: {
            spendingRequestId: request.id,
            committedAmount: request.requestedAmount,
            remainingAmount: request.requestedAmount,
            status: CommitmentStatus.ACTIVE,
          },
        });
      } else {
        newStatus = SpendingStatus.REJECTED;
      }

      // Update spending request status
      const updatedRequest = await tx.spendingRequest.update({
        where: { id: request.id },
        data: { status: newStatus },
      });

      // Immutable Audit Log
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: decision === ApprovalDecision.APPROVED ? 'SPEND_APPROVED' : 'SPEND_REJECTED',
          entityType: 'SpendingRequest',
          entityId: request.id,
          previousValue: JSON.stringify({ status: request.status }),
          newValue: JSON.stringify({
            status: newStatus,
            decision,
            comments,
            committedAmount: commitment ? toDecimalNumber(commitment.committedAmount) : 0,
          }),
          metadata: JSON.stringify({
            approver: user.name,
            approverRole: user.role,
          }),
        },
      });

      return {
        approval,
        request: updatedRequest,
        commitment,
      };
    });

    // Real-time notification
    emitEvent('approval.completed', result, result.request.departmentId);
    emitEvent('dashboard.updated', { departmentId: result.request.departmentId });

    return result;
  }
}
