import { prisma } from '../prisma';
import { AlertSeverity, AlertStatus } from '@prisma/client';
import { emitEvent } from '../socket';

export interface CreateAlertInput {
  type: string;
  severity: AlertSeverity;
  departmentId: string;
  categoryId?: string | null;
  relatedTransactionId?: string | null;
  relatedRequestId?: string | null;
  message: string;
}

export class AlertService {
  /**
   * Dispatch and persist financial alerts
   */
  public static async createAlert(input: CreateAlertInput) {
    try {
      const alert = await prisma.alert.create({
        data: {
          type: input.type,
          severity: input.severity,
          departmentId: input.departmentId,
          categoryId: input.categoryId,
          relatedTransactionId: input.relatedTransactionId,
          relatedRequestId: input.relatedRequestId,
          message: input.message,
          status: AlertStatus.ACTIVE,
        },
        include: {
          department: true,
          category: true,
        },
      });

      // Real-time broadcast
      emitEvent('alert.created', alert, input.departmentId);

      return alert;
    } catch (err) {
      console.error('[AlertService Error]: Failed to create alert:', err);
      return null;
    }
  }

  /**
   * Fetch active and historical alerts
   */
  public static async getAlerts(filters: {
    departmentId?: string;
    severity?: AlertSeverity;
    status?: AlertStatus;
  }) {
    const where: any = {};
    if (filters.departmentId) where.departmentId = filters.departmentId;
    if (filters.severity) where.severity = filters.severity;
    if (filters.status) where.status = filters.status;

    return prisma.alert.findMany({
      where,
      include: {
        department: true,
        category: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Mark alert as resolved
   */
  public static async resolveAlert(alertId: string) {
    return prisma.alert.update({
      where: { id: alertId },
      data: {
        status: AlertStatus.RESOLVED,
        resolvedAt: new Date(),
      },
    });
  }
}
