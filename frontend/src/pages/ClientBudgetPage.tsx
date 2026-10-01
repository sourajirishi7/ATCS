import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Calculator,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Building2,
  Percent,
  ShieldCheck,
  AlertCircle,
  ArrowUpRight,
  Layers,
  RefreshCw,
  Sliders,
  CheckCircle,
  Sparkles,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { api } from '../lib/api';
import { useCurrency } from '../context/CurrencyContext';

interface DepartmentQuotationMetric {
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  costCenter: string;
  allocatedAmount: number;
  actualSpend: number;
  committedSpend: number;
  totalIncurredExpenses: number;
  leftoverBudget: number;
  netFinances: number;
  profitMarginPct: number;
  burnRatePct: number;
  costSharePct: number;
  estimatedCostAtCompletion: number;
  varianceAtCompletion: number;
  status: string;
  transactionCount?: number;
  commitmentCount?: number;
}

interface ClientQuotationData {
  quotation: {
    id: string;
    clientName: string;
    projectName: string;
    quotationReference: string;
    status: string;
    currency: string;
    validUntil?: string;
    notes?: string;
    createdAt: string;
  };
  financialSummary: {
    grossProposedBudget: number;
    totalActualSpend: number;
    totalCommittedSpend: number;
    totalIncurredExpenses: number;
    leftoverBudget: number;
    netFinances: number;
    profitMarginPct: number;
    targetProfitMarginPct: number;
    targetProfitAmount: number;
    profitVarianceFromTarget: number;
    grossCostRatio: number;
  };
  estimationOfCompletion: {
    budgetBurnRate: number;
    estimatedCostAtCompletion: number;
    varianceAtCompletion: number;
    estimatedProfitAtCompletion: number;
    estimatedCompletionMarginPct: number;
    status: string;
    narrative: string;
  };
  departments: DepartmentQuotationMetric[];
  calculatedAt: string;
}

export const ClientBudgetPage: React.FC = () => {
  const { formatCurrency, currencySymbol } = useCurrency();
  const [data, setData] = useState<ClientQuotationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Simulation State
  const [simulating, setSimulating] = useState(false);
  const [proposedBudgetInput, setProposedBudgetInput] = useState<number>(2500000);
  const [targetMarginInput, setTargetMarginInput] = useState<number>(25);
  const [isSimulatedView, setIsSimulatedView] = useState(false);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<ClientQuotationData>('/client-budget');
      setData(res);
      setProposedBudgetInput(res.financialSummary.grossProposedBudget);
      setTargetMarginInput(res.financialSummary.targetProfitMarginPct);
      setIsSimulatedView(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load client quotation analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleSimulate = async (customBudget?: number, customMargin?: number) => {
    try {
      setSimulating(true);
      const budget = customBudget !== undefined ? customBudget : proposedBudgetInput;
      const margin = customMargin !== undefined ? customMargin : targetMarginInput;

      const res = await api.post<any>('/client-budget/simulate', {
        proposedBudget: Number(budget),
        targetProfitMarginPct: Number(margin),
      });

      // Transform simulation response to display
      setData((prev) =>
        prev
          ? {
              ...prev,
              financialSummary: res.financialSummary,
              estimationOfCompletion: res.estimationOfCompletion,
              departments: res.departments,
            }
          : null
      );
      setIsSimulatedView(true);
    } catch (err: any) {
      alert(`Simulation failed: ${err.message}`);
    } finally {
      setSimulating(false);
    }
  };

  const handleApplyPreset = (amount: number, margin = 25) => {
    setProposedBudgetInput(amount);
    setTargetMarginInput(margin);
    handleSimulate(amount, margin);
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
        <div className="text-sm font-mono text-slate-500">Loading Client Quotation Intelligence...</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-8 text-center bg-red-50 border border-red-200 rounded-2xl max-w-xl mx-auto my-12">
        <AlertCircle className="w-10 h-10 text-red-600 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-900 mb-1">Failed to Load Quotation Analytics</h3>
        <p className="text-sm text-slate-600 mb-4">{error}</p>
        <button
          onClick={fetchAnalytics}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { financialSummary, estimationOfCompletion, departments, quotation } = data;

  // Department chart comparison data
  const chartData = departments.map((d) => ({
    name: d.departmentCode,
    fullName: d.departmentName,
    Proposed: d.allocatedAmount,
    Actual: d.actualSpend,
    Committed: d.committedSpend,
    Incurred: d.totalIncurredExpenses,
    Leftover: Math.max(0, d.leftoverBudget),
  }));

  return (
    <div className="space-y-8 pb-16">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200 flex items-center space-x-1.5">
                <Briefcase className="w-3.5 h-3.5" />
                <span>Client Contract & Quotation Hub</span>
              </span>
              {isSimulatedView ? (
                <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-slate-50 text-slate-700 border border-slate-200 flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Simulated What-If Mode</span>
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200 flex items-center space-x-1.5">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Contract Source of Truth</span>
                </span>
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {quotation?.clientName || 'Apex Global Enterprises'} —{' '}
              <span className="text-slate-600 dark:text-slate-400 font-medium text-xl md:text-2xl">
                {quotation?.projectName || 'Project Quotation'}
              </span>
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-1 flex items-center gap-3">
              <span>
                Ref: <strong className="text-slate-900 dark:text-slate-200 font-mono">{quotation?.quotationReference}</strong>
              </span>
              <span>•</span>
              <span>
                Target Margin:{' '}
                <strong className="text-blue-600 font-mono">
                  {financialSummary.targetProfitMarginPct}%
                </strong>
              </span>
              <span>•</span>
              <span>
                Status: <strong className="text-slate-900 dark:text-white font-semibold">{quotation?.status}</strong>
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isSimulatedView && (
              <button
                onClick={fetchAnalytics}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs transition-all flex items-center space-x-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset to Contract</span>
              </button>
            )}
            <button
              onClick={() => handleSimulate()}
              disabled={simulating}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all flex items-center space-x-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${simulating ? 'animate-spin' : ''}`} />
              <span>Recalculate Telemetry</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Primary Financial Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Gross Proposed Budget */}
        <div className="glass-panel rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Gross Proposed Budget
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {formatCurrency(financialSummary.grossProposedBudget)}
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between border-t border-slate-200 dark:border-slate-800/80 pt-2">
            <span>Client Quotation Value</span>
            <span className="font-mono text-blue-600 font-semibold">100% Gross</span>
          </div>
        </div>

        {/* Total Incurred Expenses */}
        <div className="glass-panel rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Incurred Expenses
            </span>
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 border border-red-200 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {formatCurrency(financialSummary.totalIncurredExpenses)}
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between border-t border-slate-200 dark:border-slate-800/80 pt-2 font-mono">
            <span>Actual: {formatCurrency(financialSummary.totalActualSpend)}</span>
            <span className="text-blue-600 font-semibold">Commit: {formatCurrency(financialSummary.totalCommittedSpend)}</span>
          </div>
        </div>

        {/* Leftover Budget / Net Finances */}
        <div className="glass-panel rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Leftover / Net Finances
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-blue-600 tracking-tight">
            {formatCurrency(financialSummary.leftoverBudget)}
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between border-t border-slate-200 dark:border-slate-800/80 pt-2">
            <span>Remaining Reserve</span>
            <span className="font-mono text-blue-600 font-semibold">
              {(100 - financialSummary.grossCostRatio).toFixed(1)}% Leftover
            </span>
          </div>
        </div>

        {/* Profit Margin % */}
        <div className="glass-panel rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Profit Margin %
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-baseline gap-2">
            <span>{financialSummary.profitMarginPct}%</span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                financialSummary.profitMarginPct >= financialSummary.targetProfitMarginPct
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              Target: {financialSummary.targetProfitMarginPct}%
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between border-t border-slate-200 dark:border-slate-800/80 pt-2">
            <span>Profit Variance</span>
            <span
              className={`font-mono font-medium ${
                financialSummary.profitVarianceFromTarget >= 0 ? 'text-blue-600' : 'text-red-600'
              }`}
            >
              {financialSummary.profitVarianceFromTarget >= 0 ? '+' : ''}
              {formatCurrency(financialSummary.profitVarianceFromTarget)}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Estimation of Completion & Burn Velocity Banner */}
      <div className="glass-panel rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-blue-600">
                Estimation of Completion Relative to Proposed Budget
              </span>
              <span
                className={`text-[11px] font-mono px-2 py-0.5 rounded-md font-semibold border ${
                  estimationOfCompletion.status === 'HEALTHY_PROFIT'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}
              >
                {estimationOfCompletion.status}
              </span>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {estimationOfCompletion.narrative}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full lg:w-auto">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-950/70 border border-slate-200 dark:border-slate-800/80">
              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 uppercase">Budget Burn Rate</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                {estimationOfCompletion.budgetBurnRate}%
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, estimationOfCompletion.budgetBurnRate)}%` }}
                />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-950/70 border border-slate-200 dark:border-slate-800/80">
              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 uppercase">Estimated Cost (EAC)</div>
              <div className="text-lg font-bold text-blue-600 mt-1">
                {formatCurrency(estimationOfCompletion.estimatedCostAtCompletion)}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Projected at finish</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-950/70 border border-slate-200 dark:border-slate-800/80 col-span-2 sm:col-span-1">
              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 uppercase">Est. Completion Margin</div>
              <div className="text-lg font-bold text-blue-600 mt-1">
                {estimationOfCompletion.estimatedCompletionMarginPct}%
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                Surplus: {formatCurrency(estimationOfCompletion.varianceAtCompletion)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Interactive "What-If" Quotation Simulator */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-blue-600" />
              <span>Interactive Proposed Budget / Quotation Simulator</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              Simulate any proposed budget quotation from a client to evaluate leftover budget, gross/net finances, and departmental distributions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">Quick Presets:</span>
            <button
              onClick={() => handleApplyPreset(1500000, 20)}
              className="px-2.5 py-1 rounded-lg text-xs font-mono bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all shadow-2xs"
            >
              {formatCurrency(1500000, { compact: true })} (Strained)
            </button>
            <button
              onClick={() => handleApplyPreset(2500000, 25)}
              className="px-2.5 py-1 rounded-lg text-xs font-mono bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-all shadow-2xs font-semibold"
            >
              {formatCurrency(2500000, { compact: true })} (Base)
            </button>
            <button
              onClick={() => handleApplyPreset(5000000, 30)}
              className="px-2.5 py-1 rounded-lg text-xs font-mono bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all shadow-2xs"
            >
              {formatCurrency(5000000, { compact: true })} (Enterprise)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-mono text-slate-600 dark:text-slate-400 mb-1.5 font-medium">
              Proposed Budget (Quotation Gross)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-mono text-sm">
                {currencySymbol}
              </span>
              <input
                type="number"
                value={proposedBudgetInput}
                onChange={(e) => setProposedBudgetInput(Number(e.target.value))}
                className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-white dark:bg-navy-950/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-sm focus:border-blue-600 focus:outline-none shadow-2xs"
                placeholder="2500000"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-600 dark:text-slate-400 mb-1.5 font-medium">
              Target Margin Percentage (%)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                value={targetMarginInput}
                onChange={(e) => setTargetMarginInput(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-navy-950/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-sm focus:border-blue-600 focus:outline-none shadow-2xs"
                placeholder="25"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-mono text-sm">
                %
              </span>
            </div>
          </div>

          <div>
            <button
              onClick={() => handleSimulate()}
              disabled={simulating || proposedBudgetInput <= 0}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${simulating ? 'animate-spin' : ''}`} />
              <span>Simulate Proposed Quotation</span>
            </button>
          </div>
        </div>
      </div>

      {/* 5. Department-by-Department Expense Analytics Grid & Table */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <span>Departmental Expense & Budget Breakdown</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Individual expense tracking, allocations, leftover budgets, and estimated completion for each and every department.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Accounting for {departments.length} Enterprise Departments
          </span>
        </div>

        {/* Visual Comparison Chart */}
        <div className="glass-panel rounded-3xl p-6 shadow-sm">
          <h4 className="text-xs font-mono font-semibold uppercase text-slate-500 dark:text-slate-400 mb-4 tracking-wider">
            Quoted Allocation vs Incurred Expenses per Department ({currencySymbol})
          </h4>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 12 }} />
                <YAxis
                  stroke="#64748b"
                  tickFormatter={(val) => formatCurrency(val, { compact: true })}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    borderColor: 'var(--border)',
                    borderRadius: '0.75rem',
                    color: 'var(--foreground)',
                    fontSize: '12px',
                  }}
                  formatter={(value: any) => formatCurrency(Number(value))}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="Proposed" name="Quoted Allocation" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Actual" name="Actual Spend" fill="#EF4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Committed" name="Committed Spend" fill="#60A5FA" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Leftover" name="Leftover Budget" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Comprehensive Department Table */}
        <div className="glass-panel overflow-x-auto rounded-3xl shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-navy-950/80 text-[11px] font-mono text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-5 py-4">Department</th>
                <th className="px-4 py-4 text-right">Quoted Allocation</th>
                <th className="px-4 py-4 text-right">Actual Spend</th>
                <th className="px-4 py-4 text-right">Committed Spend</th>
                <th className="px-4 py-4 text-right">Total Incurred</th>
                <th className="px-4 py-4 text-right">Leftover Budget</th>
                <th className="px-4 py-4 text-right">Profit Margin %</th>
                <th className="px-4 py-4 text-right">Est. Cost (EAC)</th>
                <th className="px-5 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-xs">
              {departments.map((dept) => {
                return (
                  <tr key={dept.departmentId} className="hover:bg-slate-50 dark:hover:bg-navy-800/40 transition-colors">
                    <td className="px-5 py-4 font-sans font-medium text-slate-900 dark:text-white">
                      <div className="flex items-center space-x-2">
                        <span>{dept.departmentName}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {dept.departmentCode}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        {dept.costCenter}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right font-semibold text-slate-700 dark:text-slate-200">
                      {formatCurrency(dept.allocatedAmount)}
                    </td>
                    <td className="px-4 py-4 text-right text-red-600">
                      {formatCurrency(dept.actualSpend)}
                    </td>
                    <td className="px-4 py-4 text-right text-blue-600 font-medium">
                      {formatCurrency(dept.committedSpend)}
                    </td>
                    <td className="px-4 py-4 text-right font-bold text-slate-900 dark:text-white">
                      {formatCurrency(dept.totalIncurredExpenses)}
                    </td>
                    <td
                      className={`px-4 py-4 text-right font-bold ${
                        dept.leftoverBudget >= 0 ? 'text-blue-600' : 'text-red-600'
                      }`}
                    >
                      {formatCurrency(dept.leftoverBudget)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span
                        className={`px-2 py-0.5 rounded font-semibold ${
                          dept.profitMarginPct >= 20
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : dept.profitMarginPct > 0
                            ? 'bg-slate-50 text-slate-700 border border-slate-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {dept.profitMarginPct}%
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right text-slate-900 dark:text-slate-200">
                      {formatCurrency(dept.estimatedCostAtCompletion)}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                          dept.status === 'HEALTHY'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : dept.status === 'NEARING_LIMIT'
                            ? 'bg-slate-50 text-slate-700 border-slate-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}
                      >
                        {dept.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
