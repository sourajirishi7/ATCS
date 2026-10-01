import React, { useEffect, useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  Users,
  TrendingUp,
  AlertTriangle,
  Award,
  Search,
  Filter,
  RefreshCw,
  Building,
  CreditCard,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useCurrency } from '../../context/CurrencyContext';
import { EmployeeAnalyticsSummary, EmployeeSpendRecord } from '../../types';

const CATEGORY_COLORS: Record<string, string> = {
  'Software & Cloud': '#2563eb', // Royal Blue
  'Hardware & Equipment': '#3b82f6', // Bright Blue
  'Travel & Entertainment': '#1d4ed8', // Deep Royal Blue
  'Professional Training': '#60a5fa', // Soft Blue
  'Office Supplies': '#64748b', // Neutral Slate
  'General': '#94a3b8', // Muted Slate
};

const DEFAULT_PALETTE = ['#2563eb', '#3b82f6', '#1d4ed8', '#60a5fa', '#64748b', '#94a3b8', '#475569'];

export const EmployeeSpendingAnalytics: React.FC = () => {
  const { formatCurrency, currencySymbol } = useCurrency();
  const [data, setData] = useState<EmployeeAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [selectedThreshold, setSelectedThreshold] = useState('ALL');

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<EmployeeAnalyticsSummary>('/spending/employee-analytics');
      setData(res);
    } catch (err: any) {
      console.error('Failed to load employee spending analytics', err);
      setError(err.message || 'Could not load analytics data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  // Filtered employees for table & chart
  const filteredEmployees = useMemo(() => {
    if (!data?.employees) return [];
    return data.employees.filter((emp) => {
      const matchesSearch =
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept = selectedDepartment === 'ALL' || emp.department === selectedDepartment;
      const matchesThreshold = selectedThreshold === 'ALL' || emp.thresholdStatus === selectedThreshold;
      return matchesSearch && matchesDept && matchesThreshold;
    });
  }, [data?.employees, searchQuery, selectedDepartment, selectedThreshold]);

  // Unique departments for filter dropdown
  const departments = useMemo(() => {
    if (!data?.employees) return [];
    const depts = new Set(data.employees.map((e) => e.department).filter(Boolean));
    return Array.from(depts);
  }, [data?.employees]);

  // Prepare chart dataset (Top 10 active spenders)
  const chartData = useMemo(() => {
    if (!filteredEmployees) return [];
    return filteredEmployees
      .filter((e) => e.obligatedSpend > 0)
      .slice(0, 10)
      .map((emp) => {
        const item: any = {
          name: emp.name.split(' (')[0], // Short display name
          fullName: emp.name,
          department: emp.department,
          obligated: emp.obligatedSpend,
          settled: emp.settledSpend,
          committed: emp.committedSpend,
          transactions: emp.transactionCount + emp.requestCount,
        };
        // Flatten category breakdown for stacked bars
        Object.entries(emp.categoryBreakdown || {}).forEach(([cat, amt]) => {
          item[cat] = amt;
        });
        return item;
      });
  }, [filteredEmployees]);

  // Distinct category keys present in the data
  const chartCategories = useMemo(() => {
    if (!data?.categoryList) return [];
    return data.categoryList;
  }, [data?.categoryList]);

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const row = payload[0].payload;
      return (
        <div className="bg-white dark:bg-navy-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-2 text-xs font-mono min-w-[240px]">
          <div className="font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-1.5 flex items-center justify-between">
            <span>{row.fullName}</span>
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 font-sans">
              {row.department}
            </span>
          </div>
          <div className="text-slate-600 dark:text-slate-300 space-y-1">
            <div className="flex justify-between">
              <span>Total Spend:</span>
              <strong className="text-slate-900 dark:text-white">{formatCurrency(row.obligated)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Settled (Incurred):</span>
              <strong className="text-blue-700">{formatCurrency(row.settled)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Obligated (Committed):</span>
              <strong className="text-blue-500">{formatCurrency(row.committed)}</strong>
            </div>
            <div className="flex justify-between text-slate-500 dark:text-slate-400 text-[10px]">
              <span>Activity Count:</span>
              <span>{row.transactions} items</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1 text-[11px]">
            <span className="text-[10px] uppercase font-sans font-bold text-slate-500 dark:text-slate-400 block mb-1">
              Category Breakdown:
            </span>
            {payload
              .filter((p: any) => p.value > 0)
              .map((p: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center">
                  <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="truncate max-w-[130px]">{p.dataKey}</span>
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(p.value)}</span>
                </div>
              ))}
          </div>
        </div>
      );
    }
    return null;
  };

  const getBadgeStyle = (status: string) => {
    switch (status) {
      case 'OUTLIER_THRESHOLD':
        return 'bg-red-50 text-red-700 border border-red-200 font-bold';
      case 'ELEVATED':
        return 'bg-slate-50 text-slate-700 border border-slate-300 font-medium';
      case 'WITHIN_TYPICAL':
      default:
        return 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold';
    }
  };

  const getBadgeLabel = (status: string) => {
    switch (status) {
      case 'OUTLIER_THRESHOLD':
        return 'OUTLIER (ANOMALY)';
      case 'ELEVATED':
        return 'ELEVATED SPEND';
      case 'WITHIN_TYPICAL':
      default:
        return 'WITHIN TYPICAL';
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 space-y-3 font-mono text-xs">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600" />
        <p>Calculating employee expenditure aggregations & policy variances...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center bg-red-50 border border-red-200 rounded-2xl text-xs space-y-3 text-red-700">
        <AlertTriangle className="w-6 h-6 mx-auto text-red-600" />
        <p className="font-semibold">{error || 'Failed to load employee analytics.'}</p>
        <button
          onClick={fetchAnalytics}
          className="px-4 py-2 rounded-xl bg-white border border-red-300 text-red-700 font-medium hover:bg-red-50 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* 1. Summary Cards (4 Core Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Top Spending Employee */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden bg-white">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-medium text-slate-500 uppercase tracking-wider">
              Top Spending Employee
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-slate-900 truncate">
            {data.topSpendingEmployee ? formatCurrency(data.topSpendingEmployee.amount) : '₹0'}
          </div>
          <div className="text-xs text-slate-600 mt-1 flex items-center justify-between">
            <span className="truncate max-w-[150px] font-medium text-slate-900">
              {data.topSpendingEmployee?.name || 'None'}
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
              {data.topSpendingEmployee?.department || 'N/A'}
            </span>
          </div>
        </div>

        {/* Average Spend Per Employee */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden bg-white">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-medium text-slate-500 uppercase tracking-wider">
              Average Spend / Employee
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-slate-900">
            {formatCurrency(data.averageSpendPerEmployee)}
          </div>
          <div className="text-xs text-slate-600 mt-1 flex items-center justify-between">
            <span>Corporate Benchmark</span>
            <span className="text-[11px] font-mono text-blue-700 font-semibold">
              {data.activeRequestersCount} active spenders
            </span>
          </div>
        </div>

        {/* Active Requesters Count */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden bg-white">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-medium text-slate-500 uppercase tracking-wider">
              Active Requesters Count
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-slate-900">
            {data.activeRequestersCount}{' '}
            <span className="text-xs font-normal text-slate-500">
              / {data.employees.length} Staff
            </span>
          </div>
          <div className="text-xs text-slate-600 mt-1 flex items-center justify-between">
            <span>Participation Rate</span>
            <span className="text-[11px] font-mono font-bold text-blue-700">
              {data.employees.length > 0
                ? Math.round((data.activeRequestersCount / data.employees.length) * 100)
                : 0}
              %
            </span>
          </div>
        </div>

        {/* Anomalous / Outlier Requests (Color 3: Crimson/Coral Red) */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden bg-white">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-medium text-slate-500 uppercase tracking-wider">
              Anomalous / Outliers
            </span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              data.anomalousRequestsCount > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-xl font-extrabold ${data.anomalousRequestsCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>
            {data.anomalousRequestsCount}
          </div>
          <div className="text-xs text-slate-600 mt-1 flex items-center justify-between">
            <span>Threshold Benchmark</span>
            <span className="text-[10px] font-mono font-bold text-red-700">
              &gt; {formatCurrency(60000, { compact: true })} cap
            </span>
          </div>
        </div>
      </div>

      {/* 2. Interactive Chart Section: "Employee Spending Breakdown by Category" */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              <span>Employee Spending Breakdown by Category</span>
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Ranked breakdown of settled transactions and committed obligations across categories per employee.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchAnalytics}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs text-slate-700 dark:bg-navy-950 dark:border-slate-800 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Telemetry</span>
            </button>
          </div>
        </div>

        {chartData.length > 0 ? (
          <div className="h-80 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={chartData}
                margin={{ top: 10, right: 30, left: 120, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
                <XAxis
                  type="number"
                  tickFormatter={(v) => formatCurrency(v, { compact: true })}
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  className="text-slate-500 dark:text-slate-400"
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12, fill: 'currentColor' }}
                  className="text-slate-700 dark:text-slate-300 font-medium"
                  width={110}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
                  formatter={(val) => <span className="text-slate-700 dark:text-slate-300 text-xs">{val}</span>}
                />
                {chartCategories.map((cat, idx) => (
                  <Bar
                    key={cat}
                    dataKey={cat}
                    name={cat}
                    stackId="a"
                    fill={CATEGORY_COLORS[cat] || DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length]}
                    radius={[0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-slate-500 dark:text-slate-400 text-xs font-mono">
            No active employee spend recorded for current filters.
          </div>
        )}
      </div>

      {/* 3. Employee Spend Breakdown & Thresholds Table */}
      <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm space-y-4 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
              Employee Expenditure Ledger & Governance Badges
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Individual obligated vs. settled finances, average transaction ticket size, and compliance classification.
            </p>
          </div>

          {/* Table Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search employee..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl text-xs bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-2xs"
              />
            </div>

            {/* Department Filter */}
            <div className="relative">
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="pl-3 pr-8 py-1.5 rounded-xl text-xs bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-2xs appearance-none font-medium"
              >
                <option value="ALL">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
              <Filter className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Threshold Filter */}
            <div className="relative">
              <select
                value={selectedThreshold}
                onChange={(e) => setSelectedThreshold(e.target.value)}
                className="pl-3 pr-8 py-1.5 rounded-xl text-xs bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-2xs appearance-none font-medium"
              >
                <option value="ALL">All Thresholds</option>
                <option value="WITHIN_TYPICAL">Within Typical</option>
                <option value="ELEVATED">Elevated</option>
                <option value="OUTLIER_THRESHOLD">Outlier Anomaly</option>
              </select>
              <Filter className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto -mx-6">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-navy-950/70 text-slate-600 dark:text-slate-400 font-mono uppercase text-[10px] tracking-wider border-y border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-3.5">Employee Name & Details</th>
                <th className="px-6 py-3.5">Department</th>
                <th className="px-6 py-3.5 text-right">Committed Spend</th>
                <th className="px-6 py-3.5 text-right">Settled Spend</th>
                <th className="px-6 py-3.5 text-right">Total Obligated</th>
                <th className="px-6 py-3.5 text-right">Avg Ticket</th>
                <th className="px-6 py-3.5 text-center">Threshold Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-navy-850/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 dark:text-white text-xs">{emp.name}</div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{emp.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-100 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                        <Building className="w-3 h-3 text-slate-400" />
                        <span>{emp.department}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-blue-500">
                      {formatCurrency(emp.committedSpend)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-blue-700">
                      {formatCurrency(emp.settledSpend)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-extrabold text-slate-900 dark:text-white text-sm">
                      {formatCurrency(emp.obligatedSpend)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-slate-600 dark:text-slate-300">
                      {formatCurrency(emp.averageTicketSize)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider ${getBadgeStyle(
                          emp.thresholdStatus
                        )}`}
                      >
                        {emp.thresholdStatus === 'WITHIN_TYPICAL' && <CheckCircle2 className="w-3 h-3" />}
                        {emp.thresholdStatus === 'OUTLIER_THRESHOLD' && <AlertTriangle className="w-3 h-3" />}
                        <span>{getBadgeLabel(emp.thresholdStatus)}</span>
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400 font-mono">
                    No matching employee records found.
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
