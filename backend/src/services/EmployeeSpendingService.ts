import { prisma, toDecimalNumber } from '../prisma';
import { AuthUser } from '../middleware/auth';
import { RoleType, TransactionStatus, CommitmentStatus, SpendingStatus } from '../models/types';

export interface EmployeeSpendRecord {
  id: string;
  name: string;
  email: string;
  department: string;
  departmentId: string;
  role: string;
  committedSpend: number;
  settledSpend: number;
  obligatedSpend: number;
  requestCount: number;
  transactionCount: number;
  averageTicketSize: number;
  thresholdStatus: 'WITHIN_TYPICAL' | 'ELEVATED' | 'OUTLIER_THRESHOLD';
  categoryBreakdown: Record<string, number>;
}

export interface EmployeeAnalyticsSummary {
  topSpendingEmployee: {
    name: string;
    amount: number;
    department: string;
  } | null;
  averageSpendPerEmployee: number;
  activeRequestersCount: number;
  anomalousRequestsCount: number;
  categoryList: string[];
  employees: EmployeeSpendRecord[];
  departmentBreakdown: Array<{
    department: string;
    spend: number;
  }>;
}

export class EmployeeSpendingService {
  /**
   * Aggregates authoritative spending analytics across employees,
   * calculating settled vs. committed spend, category distributions,
   * and threshold anomaly indicators.
   */
  public static async getAnalytics(user: AuthUser): Promise<EmployeeAnalyticsSummary> {
    // 1. Fetch categories
    const categories = await prisma.category.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
    const categoryList = categories.map((c) => c.name);

    // 2. Fetch users with departments and roles
    const userWhere: any = {};
    if (user.role === RoleType.MANAGER && user.departmentId) {
      userWhere.departmentId = user.departmentId;
    }

    const users = await prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        name: true,
        email: true,
        role: { select: { name: true } },
        departmentId: true,
        department: { select: { id: true, name: true, code: true } },
      },
    });

    // 3. Fetch active transactions (settled)
    const transactions = await prisma.transaction.findMany({
      where: {
        status: { not: TransactionStatus.REVERSED },
        ...(user.role === RoleType.MANAGER && user.departmentId ? { departmentId: user.departmentId } : {}),
      },
      include: {
        category: true,
      },
    });

    // 4. Fetch spending requests with commitments
    const spendingRequests = await prisma.spendingRequest.findMany({
      where: {
        status: { notIn: [SpendingStatus.REJECTED, SpendingStatus.CANCELLED] },
        ...(user.role === RoleType.MANAGER && user.departmentId ? { departmentId: user.departmentId } : {}),
      },
      include: {
        commitment: true,
        category: true,
      },
    });

    // 5. Build Aggregations per employee
    const employeeMap = new Map<string, {
      user: typeof users[0];
      settled: number;
      committed: number;
      reqCount: number;
      txCount: number;
      categoryTotals: Record<string, number>;
      maxSingleAmount: number;
    }>();

    for (const u of users) {
      const initialCatTotals: Record<string, number> = {};
      for (const cat of categoryList) {
        initialCatTotals[cat] = 0;
      }

      employeeMap.set(u.id, {
        user: u,
        settled: 0,
        committed: 0,
        reqCount: 0,
        txCount: 0,
        categoryTotals: initialCatTotals,
        maxSingleAmount: 0,
      });
    }

    // Accumulate Settled Transactions
    for (const tx of transactions) {
      const entry = employeeMap.get(tx.employeeId);
      const amt = toDecimalNumber(tx.amount);
      if (entry) {
        entry.settled += amt;
        entry.txCount += 1;
        const catName = tx.category?.name || 'General';
        entry.categoryTotals[catName] = (entry.categoryTotals[catName] || 0) + amt;
        if (amt > entry.maxSingleAmount) entry.maxSingleAmount = amt;
      }
    }

    // Accumulate Committed Spending Requests
    for (const req of spendingRequests) {
      const entry = employeeMap.get(req.employeeId);
      const reqAmt = toDecimalNumber(req.requestedAmount);
      if (entry) {
        entry.reqCount += 1;
        if (reqAmt > entry.maxSingleAmount) entry.maxSingleAmount = reqAmt;

        // If committed
        if (req.commitment && req.commitment.status === CommitmentStatus.ACTIVE) {
          const comAmt = toDecimalNumber(req.commitment.remainingAmount);
          entry.committed += comAmt;
          const catName = req.category?.name || 'General';
          entry.categoryTotals[catName] = (entry.categoryTotals[catName] || 0) + comAmt;
        }
      }
    }

    // 6. Format Employee Records
    const employeeRecords: EmployeeSpendRecord[] = [];
    let totalCorporateSpend = 0;
    let activeRequesters = 0;
    let anomalousCount = 0;

    for (const [_, data] of employeeMap.entries()) {
      const obligated = data.settled + data.committed;
      const totalActivities = data.reqCount + data.txCount;
      const avgTicket = totalActivities > 0 ? Math.round(obligated / totalActivities) : 0;

      if (totalActivities > 0 || obligated > 0) {
        activeRequesters++;
      }
      totalCorporateSpend += obligated;

      // Anomaly detection rules:
      // - Single item > ₹60,000 OR Total obligated > ₹120,000 -> OUTLIER_THRESHOLD
      // - Total obligated > ₹50,000 -> ELEVATED
      // - Otherwise -> WITHIN_TYPICAL
      let status: 'WITHIN_TYPICAL' | 'ELEVATED' | 'OUTLIER_THRESHOLD' = 'WITHIN_TYPICAL';
      if (data.maxSingleAmount > 60000 || obligated > 120000) {
        status = 'OUTLIER_THRESHOLD';
        anomalousCount++;
      } else if (obligated > 50000) {
        status = 'ELEVATED';
      }

      employeeRecords.push({
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        department: data.user.department?.name || 'Corporate',
        departmentId: data.user.departmentId || '',
        role: data.user.role?.name || 'EMPLOYEE',
        committedSpend: Math.round(data.committed),
        settledSpend: Math.round(data.settled),
        obligatedSpend: Math.round(obligated),
        requestCount: data.reqCount,
        transactionCount: data.txCount,
        averageTicketSize: avgTicket,
        thresholdStatus: status,
        categoryBreakdown: data.categoryTotals,
      });
    }

    // Sort by obligatedSpend descending (Top Spenders First)
    employeeRecords.sort((a, b) => b.obligatedSpend - a.obligatedSpend);

    // Compute Top Spender
    const topSpenderRecord = employeeRecords.length > 0 && employeeRecords[0].obligatedSpend > 0
      ? {
          name: employeeRecords[0].name,
          amount: employeeRecords[0].obligatedSpend,
          department: employeeRecords[0].department,
        }
      : null;

    // Compute Department Breakdown
    const deptTotals: Record<string, number> = {};
    for (const emp of employeeRecords) {
      deptTotals[emp.department] = (deptTotals[emp.department] || 0) + emp.obligatedSpend;
    }

    const departmentBreakdown = Object.entries(deptTotals).map(([dept, spend]) => ({
      department: dept,
      spend,
    }));

    const averageSpendPerEmployee = activeRequesters > 0
      ? Math.round(totalCorporateSpend / activeRequesters)
      : 0;

    return {
      topSpendingEmployee: topSpenderRecord,
      averageSpendPerEmployee,
      activeRequestersCount: activeRequesters,
      anomalousRequestsCount: anomalousCount,
      categoryList,
      employees: employeeRecords,
      departmentBreakdown,
    };
  }
}
