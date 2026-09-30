import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Sliders, ShieldCheck, CheckCircle2, Plus, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';

export const RulesPage: React.FC = () => {
  const { user } = useAuth();
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
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Sliders className="w-6 h-6 text-indigo-400" />
            <span>Governance & Policy Rules</span>
          </h1>
          <p className="text-xs text-slate-400">
            Database-configured financial thresholds. The SpendDecisionEngine evaluates these policies dynamically without hardcoded constants.
          </p>
        </div>

        {isFinanceOrAdmin && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-glow transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Budget Policy</span>
          </button>
        )}
      </div>

      {/* Budget Rules Section */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-white uppercase tracking-wider font-mono">
          1. Budget Utilization & Cap Rules
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {budgetRules.map((rule) => (
            <div
              key={rule.id}
              className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4 relative overflow-hidden"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase">{rule.ruleType}</span>
                  <h3 className="text-sm font-bold text-white mt-1">{rule.ruleName}</h3>
                </div>
                {isFinanceOrAdmin && (
                  <button
                    onClick={() => handleToggleBudgetRule(rule.id, rule.enabled)}
                    className="text-slate-400 hover:text-white"
                  >
                    {rule.enabled ? (
                      <ToggleRight className="w-6 h-6 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-slate-600" />
                    )}
                  </button>
                )}
              </div>

              <div className="p-3 rounded-xl bg-navy-950/80 border border-slate-800 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Threshold Cap</span>
                <span className="text-white font-bold">{rule.threshold}%</span>
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono pt-2 border-t border-slate-800">
                <span className="text-slate-400">Enforcement:</span>
                <span
                  className={`px-2 py-0.5 rounded font-bold ${
                    rule.action === 'BLOCK'
                      ? 'bg-rose-500/10 text-rose-400'
                      : 'bg-amber-500/10 text-amber-400'
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
        <h2 className="text-base font-bold text-white uppercase tracking-wider font-mono">
          2. Tiered Approval Thresholds
        </h2>
        <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-navy-950/70 text-slate-400 font-mono uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">Policy Name</th>
                <th className="px-6 py-3.5 text-right">Minimum Spend</th>
                <th className="px-6 py-3.5 text-right">Maximum Spend</th>
                <th className="px-6 py-3.5">Required Reviewer</th>
                <th className="px-6 py-3.5 text-center">Status</th>
                {isFinanceOrAdmin && <th className="px-6 py-3.5 text-center">Toggle</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {approvalRules.map((rule) => (
                <tr key={rule.id} className="hover:bg-navy-850/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-white">{rule.name}</td>
                  <td className="px-6 py-4 text-right font-mono text-slate-300">₹{Number(rule.minimumAmount).toLocaleString()}</td>
                  <td className="px-6 py-4 text-right font-mono text-slate-300">
                    {rule.maximumAmount ? `₹${Number(rule.maximumAmount).toLocaleString()}` : 'No Limit (Executive)'}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 text-[10px] font-mono font-bold">
                      {rule.requiredRole}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        rule.enabled
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-500/10 text-slate-400 border border-slate-500/30'
                      }`}
                    >
                      {rule.enabled ? 'ACTIVE' : 'DISABLED'}
                    </span>
                  </td>
                  {isFinanceOrAdmin && (
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleToggleApprovalRule(rule.id, rule.enabled)}
                        className="text-slate-400 hover:text-white"
                      >
                        {rule.enabled ? (
                          <ToggleRight className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-slate-600" />
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-slate-700 space-y-4 bg-navy-900">
            <h3 className="font-bold text-white text-base">Create Database Budget Policy</h3>

            <form onSubmit={handleCreateRule} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Rule Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q3_EARLY_WARNING_75"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  className="w-full px-3 py-2 bg-navy-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Utilization Threshold (%)</label>
                <input
                  type="number"
                  required
                  min="1"
                  max="150"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-navy-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Triggered Action</label>
                <select
                  value={action}
                  onChange={(e: any) => setAction(e.target.value)}
                  className="w-full px-3 py-2 bg-navy-950 border border-slate-800 rounded-xl text-xs text-white"
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
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-glow"
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
