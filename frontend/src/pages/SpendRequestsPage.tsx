import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { SpendingRequest, DecisionSnapshot } from '../types';
import { useCurrency } from '../context/CurrencyContext';
import {
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Eye,
  Plus,
  RefreshCw,
  Users,
  BarChart3,
  AlertOctagon,
  ShieldAlert,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmployeeSpendingAnalytics } from '../components/analytics/EmployeeSpendingAnalytics';

export const SpendRequestsPage: React.FC = () => {
  const { formatCurrency } = useCurrency();
  const [requests, setRequests] = useState<SpendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSnapshot, setSelectedSnapshot] = useState<DecisionSnapshot | null>(null);
  const [activeTab, setActiveTab] = useState<'ledger' | 'analytics'>('ledger');

  const fetchRequests = async () => {
    try {
      const data = await api.get<SpendingRequest[]>('/spending-requests');
      setRequests(data);
    } catch (err) {
      console.error('Failed to load spending requests', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMMITTED':
      case 'APPROVED':
        return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'PENDING_EXCEPTION_REVIEW':
      case 'REJECTED':
      case 'VIOLATION':
        return 'bg-red-50 text-red-700 border border-red-200 font-bold';
      case 'UNDER_REVIEW':
      case 'DRAFT':
      case 'SUBMITTED':
      default:
        return 'bg-slate-50 text-slate-700 border border-slate-200';
    }
  };

  const getComplianceBadgeStyle = (badge?: string) => {
    switch (badge) {
      case 'EXCEPTION_FLAGGED':
      case 'OVERRIDE_REQUIRED':
        return 'bg-red-50 text-red-700 border border-red-200 font-bold';
      case 'AUTO_COMPLIANT':
        return 'bg-blue-50 text-blue-700 border border-blue-200';
      default:
        return 'bg-slate-50 text-slate-700 border border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <FileSpreadsheet className="w-6 h-6 text-blue-600" />
            <span>Spending Requests & Analytics</span>
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
            Spend requests evaluated by the SpendDecisionEngine with budget exception rule enforcement and employee analytics.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchRequests}
            className="p-2.5 rounded-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-white transition-colors"
            title="Refresh Ledger"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            to="/spend/preview"
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Spend Simulation</span>
          </Link>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('ledger')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'ledger'
              ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-900'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Spending Requests Ledger</span>
          <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-200 dark:bg-navy-800 text-slate-700 dark:text-slate-300 font-mono">
            {requests.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'analytics'
              ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Employee Spending Analytics</span>
          <span className="ml-1 px-2 py-0.5 rounded text-[9px] uppercase tracking-wider bg-blue-100 text-blue-700 font-mono font-bold">
            Interactive Charts
          </span>
        </button>
      </div>

      {/* Main Content Area */}
      {activeTab === 'analytics' ? (
        <EmployeeSpendingAnalytics />
      ) : (
        /* Requests Table */
        <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-navy-950/70 text-slate-600 dark:text-slate-400 font-mono uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Vendor & Description</th>
                  <th className="px-6 py-3.5">Employee</th>
                  <th className="px-6 py-3.5">Category</th>
                  <th className="px-6 py-3.5 text-right">Amount</th>
                  <th className="px-6 py-3.5 text-center">Route & Compliance</th>
                  <th className="px-6 py-3.5">Requested Date</th>
                  <th className="px-6 py-3.5 text-center">Decision Snapshot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                      Loading spending requests...
                    </td>
                  </tr>
                ) : requests.length > 0 ? (
                  requests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/80 dark:hover:bg-navy-850/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 dark:text-white text-sm">{req.vendor}</div>
                        <div className="text-slate-500 dark:text-slate-400 text-xs truncate max-w-xs">{req.description}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                        <div className="font-medium text-slate-900 dark:text-white">{req.employee?.name}</div>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{req.department?.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200 dark:bg-navy-950 dark:border-slate-800 dark:text-slate-300 text-[11px] font-mono font-medium">
                          {req.category?.name}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-sm text-slate-900 dark:text-white">
                        {formatCurrency(req.requestedAmount)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${getStatusBadge(req.routeStatus || req.status)}`}>
                            {req.routeStatus || req.status}
                          </span>
                          {req.complianceBadge && (
                            <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${getComplianceBadgeStyle(req.complianceBadge)}`}>
                              {req.complianceBadge.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {req.decisionSnapshot ? (
                          <button
                            onClick={() => setSelectedSnapshot(req.decisionSnapshot!)}
                            className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 hover:text-blue-600 border border-slate-200 shadow-xs dark:bg-navy-900 dark:border-slate-700/80 dark:text-slate-300 dark:hover:text-white dark:hover:border-blue-500 transition-colors text-[11px] font-mono inline-flex items-center gap-1.5 font-medium"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Snapshot</span>
                          </button>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-600 text-[11px] font-mono">None</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                      No spending requests found. Run a simulation to create the first request!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Decision Snapshot Inspection Modal */}
      {selectedSnapshot && (() => {
        const rawReasons = selectedSnapshot.reasons;
        const parsedReasons = typeof rawReasons === 'object' && rawReasons !== null
          ? (rawReasons as any)
          : (typeof rawReasons === 'string' && rawReasons.startsWith('{')
              ? (() => { try { return JSON.parse(rawReasons); } catch { return null; } })()
              : null);

        const triggeredRules = selectedSnapshot.triggeredRules || parsedReasons?.triggeredRules || [];
        const complianceBadge = selectedSnapshot.complianceBadge || parsedReasons?.complianceBadge || 'AUTO_COMPLIANT';
        const hasExceptions = selectedSnapshot.exceptionTriggered || parsedReasons?.exceptionTriggered || triggeredRules.length > 0;
        const routeStatus = selectedSnapshot.routeStatus || parsedReasons?.routeStatus || 'UNDER_REVIEW';

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="glass-panel w-full max-w-2xl p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-5 bg-white dark:bg-navy-900 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-slate-900 text-base">Immutable Decision Snapshot</h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${getComplianceBadgeStyle(complianceBadge)}`}>
                    {complianceBadge.replace(/_/g, ' ')}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedSnapshot(null)}
                  className="text-slate-500 hover:text-slate-900 text-sm font-semibold"
                >
                  ✕ Close
                </button>
              </div>

              {/* Exception Rule Alert Callout if Triggered (Color 3: Crimson/Coral Red) */}
              {hasExceptions && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 space-y-2.5">
                  <div className="flex items-center gap-2 text-red-900 font-bold text-xs">
                    <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Active Budget Exception Rule Triggered</span>
                    <span className="ml-auto font-mono text-[10px] px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-200 font-bold">
                      Route: {routeStatus}
                    </span>
                  </div>

                  {triggeredRules.length > 0 ? (
                    <div className="space-y-2 pt-1">
                      {triggeredRules.map((rule: any, idx: number) => (
                        <div key={idx} className="p-2.5 rounded-lg bg-white border border-red-200 text-xs space-y-1">
                          <div className="flex items-center justify-between font-mono font-bold text-slate-900">
                            <span>{rule.code || rule.ruleCode}: {rule.name || rule.ruleName}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 font-bold">
                              {rule.action || 'EXCEPTION'}
                            </span>
                          </div>
                          <p className="text-slate-600 text-[11px]">
                            {rule.message || rule.description || 'Threshold exceeded; requires managerial override or multi-tier director sign-off.'}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-red-800 text-xs">
                      This request violated active governance exception limits. Straight-through approval was blocked, and multi-tier exception review has been flagged.
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs p-4 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 font-mono">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 text-[10px]">Budget At Decision</span>
                  <div className="text-slate-900 dark:text-white font-bold mt-0.5">{formatCurrency(selectedSnapshot.budgetAmount)}</div>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 text-[10px]">Actual Spend</span>
                  <div className="text-slate-900 dark:text-white font-bold mt-0.5">{formatCurrency(selectedSnapshot.actualSpend)}</div>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 text-[10px]">Committed Spend</span>
                  <div className="text-blue-600 dark:text-blue-400 font-bold mt-0.5">{formatCurrency(selectedSnapshot.committedSpend)}</div>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 text-[10px]">Requested</span>
                  <div className="text-slate-900 dark:text-white font-bold mt-0.5">{formatCurrency(selectedSnapshot.requestedAmount)}</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Utilization Impact</span>
                  <span className="font-mono text-slate-900 dark:text-white">
                    {selectedSnapshot.utilizationBefore}% → {selectedSnapshot.utilizationAfter}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Final Verdict</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{selectedSnapshot.decision}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Engine Version</span>
                  <span className="font-mono text-slate-500 dark:text-slate-400">{selectedSnapshot.engineVersion}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Calculated Timestamp</span>
                  <span className="font-mono text-slate-500 dark:text-slate-400">{new Date(selectedSnapshot.calculatedAt).toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="font-semibold text-slate-700 dark:text-slate-300">Recorded Reasons / Violations</div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-mono whitespace-pre-wrap">
                  {parsedReasons?.summary && Array.isArray(parsedReasons.summary)
                    ? parsedReasons.summary.join('\n')
                    : (selectedSnapshot.reasons && typeof selectedSnapshot.reasons === 'string'
                        ? selectedSnapshot.reasons
                        : JSON.stringify(selectedSnapshot.reasons, null, 2))}
                </div>
              </div>

              <div className="pt-2 text-right">
                <button
                  onClick={() => setSelectedSnapshot(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white text-xs font-medium transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
