import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Sliders, ShieldCheck, CheckCircle2, Plus, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';

export const RulesPage: React.FC = () => {
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const [budgetRules, setBudgetRules] = useState<any[]>([]);
  const [approvalRules, setApprovalRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Rule Form State
  const [ruleName, setRuleName] = useState('');
  const [threshold, setThreshold] = useState<number>(85);
  const [action, setAction] = useState<'WARNING' | 'BLOCK' | 'APPROVAL_REQUIRED'>('WARNING');
  const [showModal, setShowModal] = useState(false);

  const fetchRules = async () => {
    try {
      const data = await api.get<{ budgetRules: any[]; approvalRules: any[] }>('/rules');
      setBudgetRules(data.budgetRules);
      setApprovalRules(data.approvalRules);
    } catch (err) {
      console.error('Failed to load rules', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleToggleBudgetRule = async (id: string, current: boolean) => {
    try {
      await api.put(`/rules/budget/${id}`, { enabled: !current });
      fetchRules();
    } catch (err) {
      console.error('Failed to toggle rule', err);
    }
  };

  const handleToggleApprovalRule = async (id: string, current: boolean) => {
    try {
      await api.put(`/rules/approval/${id}`, { enabled: !current });
      fetchRules();
    } catch (err) {
      console.error('Failed to toggle approval rule', err);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/rules/budget', {
        ruleName,
        ruleType: 'UTILIZATION_WARNING',
        threshold: Number(threshold),
        action,
        enabled: true,
        priority: 50,
      });
      setShowModal(false);
      setRuleName('');
      fetchRules();
    } catch (err: any) {
      alert(err.message || 'Failed to create rule');
    }
  };

  const isFinanceOrAdmin = user?.role === 'FINANCE' || user?.role === 'ADMIN';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Sliders className="w-6 h-6 text-blue-600" />
            <span>Governance & Policy Rules</span>
          </h1>
          <p className="text-xs text-slate-500">
            Database-configured financial thresholds. The SpendDecisionEngine evaluates these policies dynamically without hardcoded constants.
          </p>
        </div>

        {isFinanceOrAdmin && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Budget Policy</span>
          </button>
        )}
      </div>

      {/* Budget Rules Section */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider font-mono">
          1. Budget Utilization & Cap Rules
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {budgetRules.map((rule) => (
            <div
              key={rule.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 relative overflow-hidden shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono text-blue-600 font-bold uppercase">{rule.ruleType}</span>
                  <h3 className="text-sm font-bold text-slate-900 mt-1">{rule.ruleName}</h3>
                </div>
                {isFinanceOrAdmin && (
                  <button
                    onClick={() => handleToggleBudgetRule(rule.id, rule.enabled)}
                    className="text-slate-400 hover:text-slate-700"
                  >
                    {rule.enabled ? (
                      <ToggleRight className="w-6 h-6 text-blue-600" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-slate-400" />
                    )}
                  </button>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-600">Threshold Cap</span>
                <span className="text-slate-900 font-bold">{rule.threshold}%</span>
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono pt-2 border-t border-slate-200">
                <span className="text-slate-600">Enforcement:</span>
                <span
                  className={`px-2 py-0.5 rounded font-bold border ${
                    rule.action === 'BLOCK'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  {rule.action}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Approval Rules Section */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider font-mono">
          2. Tiered Approval Thresholds
        </h2>
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-mono uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">Policy Name</th>
                <th className="px-6 py-3.5 text-right">Minimum Spend</th>
                <th className="px-6 py-3.5 text-right">Maximum Spend</th>
                <th className="px-6 py-3.5">Required Reviewer</th>
                <th className="px-6 py-3.5 text-center">Status</th>
                {isFinanceOrAdmin && <th className="px-6 py-3.5 text-center">Toggle</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {approvalRules.map((rule) => (
                <tr key={rule.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-900">{rule.name}</td>
                  <td className="px-6 py-4 text-right font-mono text-slate-700">{formatCurrency(Number(rule.minimumAmount))}</td>
                  <td className="px-6 py-4 text-right font-mono text-slate-700">
                    {rule.maximumAmount ? formatCurrency(Number(rule.maximumAmount)) : 'No Limit (Executive)'}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-mono font-bold">
                      {rule.requiredRole}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                        rule.enabled
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {rule.enabled ? 'ACTIVE' : 'DISABLED'}
                    </span>
                  </td>
                  {isFinanceOrAdmin && (
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleToggleApprovalRule(rule.id, rule.enabled)}
                        className="text-slate-400 hover:text-slate-700"
                      >
                        {rule.enabled ? (
                          <ToggleRight className="w-5 h-5 text-blue-600" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-slate-400" />
                        )}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: New Budget Policy */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-2xl border border-slate-200 space-y-4 bg-white shadow-xl">
            <h3 className="font-bold text-slate-900 text-base">Create Database Budget Policy</h3>

            <form onSubmit={handleCreateRule} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Rule Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q3_EARLY_WARNING_75"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Utilization Threshold (%)</label>
                <input
                  type="number"
                  required
                  min="1"
                  max="150"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Triggered Action</label>
                <select
                  value={action}
                  onChange={(e: any) => setAction(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="WARNING">WARNING (Alert Notification)</option>
                  <option value="BLOCK">BLOCK (Hard Ceiling Rejection)</option>
                  <option value="APPROVAL_REQUIRED">APPROVAL_REQUIRED (Force Review)</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
                >
                  Save Policy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
