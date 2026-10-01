import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { DashboardSummary } from '../types';
import { useSocket } from '../context/SocketContext';
import { useCurrency } from '../context/CurrencyContext';
import {
  Wallet,
  TrendingUp,
  Lock,
  CheckCircle2,
  AlertOctagon,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  Layers,
  RefreshCw,
  Briefcase,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();
  const { formatCurrency, currencySymbol } = useCurrency();

  const fetchDashboardData = async () => {
    try {
      const res = await api.get<DashboardSummary>('/dashboard/summary');
      setData(res);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    if (socket) {
      socket.on('dashboard.updated', () => {
        fetchDashboardData();
      });
      socket.on('transaction.created', () => {
        fetchDashboardData();
      });
      socket.on('spending.created', () => {
        fetchDashboardData();
      });
      socket.on('approval.completed', () => {
        fetchDashboardData();
      });
    }

    return () => {
      if (socket) {
        socket.off('dashboard.updated');
        socket.off('transaction.created');
        socket.off('spending.created');
        socket.off('approval.completed');
      }
    };
  }, [socket]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-3">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          <div className="text-xs font-mono text-slate-400">Loading Authoritative Financial Ledger...</div>
        </div>
      </div>
    );
  }

  const kpis = data?.kpis || {
    totalBudget: 0,
    actualSpend: 0,
    committedSpend: 0,
    availableBudget: 0,
    overallUtilization: 0,
    projectedSpend: 0,
    activeViolationsCount: 0,
    pendingApprovalsCount: 0,
    transactionCount: 0,
    commitmentCount: 0,
  };

  const COLORS = ['#2563eb', '#3b82f6', '#1d4ed8', '#60a5fa', '#64748b', '#94a3b8'];

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center space-x-2 text-blue-600 text-xs font-mono font-bold mb-1">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>CENTRAL FINANCIAL CONTROL DESK</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Financial Health & Utilization
          </h1>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 font-medium">
            Real-time authoritative calculations backed by PostgreSQL ACID transactions and row-level serialization.
          </p>
        </div>

        <button
          onClick={fetchDashboardData}
          className="self-start md:self-auto flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-blue-600 border border-slate-200 text-xs font-medium shadow-sm transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* 8 Core Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Approved Budget */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Budget</span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">{formatCurrency(kpis.totalBudget)}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">Approved Corporate Ceilings</div>
        </div>

        {/* Actual Spend */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">Actual Settled</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-blue-600">{formatCurrency(kpis.actualSpend)}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">{kpis.transactionCount} Settled Transactions</div>
        </div>

        {/* Committed Spend */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">Committed Spend</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200">
              <Lock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">{formatCurrency(kpis.committedSpend)}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">{kpis.commitmentCount} Active Obligations</div>
        </div>

        {/* Available Budget */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">Available Headroom</span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-extrabold ${kpis.availableBudget < 0 ? 'text-red-600' : 'text-blue-600'}`}>
            {formatCurrency(kpis.availableBudget)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
            {kpis.overallUtilization}% Overall Utilization
          </div>
        </div>
      </div>

      {/* Secondary Status Row (Active Violations & Pending Approvals) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Overall Utilization Bar Card */}
        <div className="glass-panel p-4 rounded-xl border border-slate-200 dark:border-slate-800 lg:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Total Obligated Spend (Actual + Committed)</span>
            <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
              {formatCurrency(kpis.actualSpend + kpis.committedSpend)} / {formatCurrency(kpis.totalBudget)}
            </span>
          </div>
          <div className="w-full h-3.5 bg-slate-100 dark:bg-navy-950 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-slate-800 flex">
            <div
              style={{ width: `${Math.min((kpis.actualSpend / (kpis.totalBudget || 1)) * 100, 100)}%` }}
              className="bg-blue-600 h-full rounded-l-full transition-all duration-500"
              title="Actual Settled"
            />
            <div
              style={{ width: `${Math.min((kpis.committedSpend / (kpis.totalBudget || 1)) * 100, 100)}%` }}
              className="bg-blue-400 h-full transition-all duration-500"
              title="Committed Obligations"
            />
          </div>
          <div className="flex items-center space-x-4 text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span> Actual Settled
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span> Committed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-200 border border-slate-300"></span> Available
            </span>
          </div>
        </div>

        {/* Active Violations Count */}
        <div className="glass-panel p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-mono uppercase text-slate-500 dark:text-slate-400">Active Violations</div>
            <div className="text-2xl font-extrabold text-red-600 mt-1">{kpis.activeViolationsCount}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Blocked / Overrun Events</div>
          </div>
          <div className="p-3 rounded-xl bg-red-50 text-red-700 border border-red-200">
            <AlertOctagon className="w-5 h-5" />
          </div>
        </div>

        {/* Pending Approvals Count */}
        <div className="glass-panel p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-mono uppercase text-slate-500 dark:text-slate-400">Pending Approvals</div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{kpis.pendingApprovalsCount}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Awaiting Manager / Finance Review</div>
          </div>
          <div className="p-3 rounded-xl bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Client Proposed Budget & Quotation Performance Callout */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 shrink-0">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold uppercase text-slate-900 dark:text-white">
                Client Quotation & Proposed Budget Performance
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                Live Telemetry
              </span>
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
              Track client quotations (Gross, Net, Leftover Budget, Profit % & Completion Estimates) across all departments.
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Compare quoted departmental allocation against real-time incurred expenses.
            </p>
          </div>
        </div>

        <Link
          to="/client-budget"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center space-x-1.5 shrink-0 self-start md:self-auto"
        >
          <span>Open Client Quotation Hub</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Visual Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Department Utilization Bar Chart (7 Cols) */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800 lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" /> Department Utilization Comparison
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Budget vs (Actual + Committed) by Department</p>
            </div>
          </div>

          {data?.departments && data.departments.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.departments} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="departmentName" stroke="#64748B" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={11} tickLine={false} tickFormatter={(v) => formatCurrency(v, { compact: true })} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: '10px', fontSize: '12px' }}
                    formatter={(val: any) => [formatCurrency(Number(val)), '']}
                  />
                  <Bar dataKey="budget" name="Approved Budget" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actual" name="Actual Settled" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="committed" name="Committed" fill="#60A5FA" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
              No departmental budget data recorded yet.
            </div>
          )}
        </div>

        {/* Category Breakdown Donut Chart (5 Cols) */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800 lg:col-span-5 space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" /> Category Spend Distribution
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Obligated spend across active expense categories</p>
          </div>

          {data?.categories && data.categories.length > 0 ? (
            <div className="h-64 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.categories}
                    dataKey="total"
                    nameKey="categoryName"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                  >
                    {data.categories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: '10px', fontSize: '12px' }}
                    formatter={(val: any) => [formatCurrency(Number(val)), 'Total Spend']}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', color: '#64748B' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
              No category spending recorded yet.
            </div>
          )}
        </div>
      </div>

      {/* Department Financial Ledger Table */}
      <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
            Departmental Utilization Ledger
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">Live PostgreSQL Aggregates</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-navy-950/60 text-slate-600 dark:text-slate-400 font-mono uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-3">Department</th>
                <th className="px-6 py-3">Code</th>
                <th className="px-6 py-3 text-right">Budget</th>
                <th className="px-6 py-3 text-right">Actual</th>
                <th className="px-6 py-3 text-right">Committed</th>
                <th className="px-6 py-3 text-right">Available</th>
                <th className="px-6 py-3 text-center">Utilization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-medium">
              {data?.departments && data.departments.length > 0 ? (
                data.departments.map((dept) => (
                  <tr key={dept.departmentId} className="hover:bg-slate-50/80 dark:hover:bg-navy-850/50 transition-colors">
                    <td className="px-6 py-3.5 text-slate-900 dark:text-white font-semibold">{dept.departmentName}</td>
                    <td className="px-6 py-3.5 font-mono text-slate-500 dark:text-slate-400">{dept.departmentCode}</td>
                    <td className="px-6 py-3.5 text-right font-mono text-slate-700 dark:text-slate-300">{formatCurrency(dept.budget)}</td>
                    <td className="px-6 py-3.5 text-right font-mono text-slate-900 dark:text-white">{formatCurrency(dept.actual)}</td>
                    <td className="px-6 py-3.5 text-right font-mono text-blue-600 font-semibold">{formatCurrency(dept.committed)}</td>
                    <td className={`px-6 py-3.5 text-right font-mono font-bold ${dept.available < 0 ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>
                      {formatCurrency(dept.available)}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                          dept.utilization >= 100
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : dept.utilization >= 80
                            ? 'bg-slate-50 text-slate-700 border border-slate-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {dept.utilization}%
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                    No active departments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
