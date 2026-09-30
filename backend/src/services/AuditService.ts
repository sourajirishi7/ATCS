import { prisma, toDecimalNumber } from '../prisma';

export interface AuditLogInput {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  previousValue?: string | null;
  newValue?: string | null;
  metadata?: string | null;
}

export class AuditService {
  /**
   * Append-only financial audit log entry
   */
  public static async createLog(input: AuditLogInput) {
    try {
      return await prisma.auditLog.create({
        data: {
          userId: input.userId,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          previousValue: input.previousValue,
          newValue: input.newValue,
          metadata: input.metadata,
        },
      });
    } catch (err) {
      console.error('[AuditService Error]: Failed to persist audit event:', err);
      return null;
    }
  }

  /**
   * Fetch audit logs with extensive filters
   */
  public static async getLogs(filters: {
    userId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: { select: { name: true } },
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }

  /**
   * Inspect the exact historical DecisionSnapshot for any spending request
   */
  public static async getDecisionSnapshot(spendingRequestId: string) {
    const snapshot = await prisma.decisionSnapshot.findUnique({
      where: { spendingRequestId },
      include: {
        spendingRequest: {
          include: {
            employee: { select: { id: true, name: true, email: true } },
            department: true,
            category: true,
          },
        },
      },
    });

    if (!snapshot) return null;

    return {
      ...snapshot,
      budgetAmount: toDecimalNumber(snapshot.budgetAmount),
      actualSpend: toDecimalNumber(snapshot.actualSpend),
      committedSpend: toDecimalNumber(snapshot.committedSpend),
      requestedAmount: toDecimalNumber(snapshot.requestedAmount),
      utilizationBefore: toDecimalNumber(snapshot.utilizationBefore),
      utilizationAfter: toDecimalNumber(snapshot.utilizationAfter),
      remainingBefore: toDecimalNumber(snapshot.remainingBefore),
      remainingAfter: toDecimalNumber(snapshot.remainingAfter),
      violations: JSON.parse(snapshot.violations || '[]'),
      warnings: JSON.parse(snapshot.warnings || '[]'),
      reasons: JSON.parse(snapshot.reasons || '[]'),
    };
  }
}
