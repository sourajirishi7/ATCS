import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { Category, Department, DecisionEvaluationOutput } from '../types';
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  Lock,
  Wallet,
  Building,
  Tag,
  FileText,
  DollarSign,
  AlertOctagon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const SpendPreviewPage: React.FC = () => {
  const { user } = useAuth();
  const { formatCurrency, currencySymbol, currency } = useCurrency();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>(user?.departmentId || '');
  const [amount, setAmount] = useState<number | string>('');
  const [vendor, setVendor] = useState('');
  const [description, setDescription] = useState('');
  const [overrideToken, setOverrideToken] = useState('');
  const [showOverrideInput, setShowOverrideInput] = useState(false);
  
  const [preview, setPreview] = useState<DecisionEvaluationOutput | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    async function loadMetadata() {
      try {
        const [cats, depts] = await Promise.all([
          api.get<Category[]>('/categories'),
          api.get<Department[]>('/departments'),
        ]);
        setCategories(cats);
        if (cats.length > 0) setSelectedCategory(cats[0].id);

        setDepartments(depts);
        if (user?.departmentId) {
          setSelectedDepartment(user.departmentId);
        } else if (depts.length > 0) {
          setSelectedDepartment(depts[0].id);
        }
      } catch (err) {
        console.error('Failed to load form metadata', err);
      }
    }
    loadMetadata();
  }, [user]);

  // Debounced live evaluation call to SpendDecisionEngine
  useEffect(() => {
    if (!selectedCategory || !amount || Number(amount) <= 0) {
      setPreview(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingPreview(true);
      try {
        const result = await api.post<DecisionEvaluationOutput>('/spending-requests/preview', {
          categoryId: selectedCategory,
          departmentId: selectedDepartment || user?.departmentId || undefined,
          requestedAmount: Number(amount),
          currency: 'INR',
          vendor: vendor || 'Vendor',
          description: description || 'Spend simulation',
          overrideToken: overrideToken.trim() || undefined,
        });
        setPreview(result);
      } catch (err: any) {
        console.error('Preview evaluation error:', err);
      } finally {
        setLoadingPreview(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [selectedCategory, selectedDepartment, amount, vendor, description, overrideToken, user]);

  // Submit actual authoritative request to database
  const handleSubmitAuthoritativeRequest = async () => {
    if (!selectedCategory || !amount || Number(amount) <= 0) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await api.post<any>('/spending-requests', {
        categoryId: selectedCategory,
        departmentId: selectedDepartment || user?.departmentId || undefined,
        requestedAmount: Number(amount),
        currency: 'INR',
        vendor,
        description,
        overrideToken: overrideToken.trim() || undefined,
      });

      setFeedback({
        type: 'success',
        message: `Request created with verdict '${res.verdict.decision}'. Route: ${res.spendingRequest.routeStatus || res.spendingRequest.status}`,
      });

      setTimeout(() => {
        navigate('/spend');
      }, 1500);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to submit authoritative spending request.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getVerdictStyle = (decision?: string) => {
    switch (decision) {
      case 'APPROVE':
        return {
          bg: 'bg-blue-50 border-blue-200 text-blue-900',
          badge: 'bg-blue-600 text-white',
          icon: CheckCircle2,
          glow: '',
          title: 'PRE-APPROVED BY RULES',
        };
      case 'APPROVAL_REQUIRED':
        return {
          bg: 'bg-slate-50 border-slate-300 text-slate-900',
          badge: 'bg-slate-700 text-white',
          icon: Clock,
          glow: '',
          title: 'APPROVAL REQUIRED',
        };
      case 'VIOLATION':
        return {
          bg: 'bg-red-50 border-red-200 text-red-900',
          badge: 'bg-red-600 text-white',
          icon: XCircle,
          glow: '',
          title: 'BUDGET POLICY VIOLATION',
        };
      case 'WARNING':
        return {
          bg: 'bg-red-50 border-red-200 text-red-900',
          badge: 'bg-red-600 text-white',
          icon: AlertTriangle,
          glow: '',
          title: 'APPROVED WITH HIGH-UTILIZATION WARNING',
        };
      default:
        return {
          bg: 'bg-slate-50 border-slate-200 text-slate-800',
          badge: 'bg-slate-200 text-slate-800',
          icon: ShieldCheck,
          glow: '',
          title: 'CALCULATING VERDICT...',
        };
    }
  };

  const style = getVerdictStyle(preview?.decision);
  const VerdictIcon = style.icon;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <div className="inline-flex items-center space-x-2 text-blue-600 text-xs font-mono font-bold mb-1">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <span>SPEND BEFORE YOU SPEND ENGINE</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
          Spend Decision Preview Simulator
        </h1>
        <p className="text-xs md:text-sm text-slate-600 max-w-2xl font-medium">
          Test proposed spending in real-time. The central authoritative engine recalculates budget ceilings, existing actuals, outstanding commitments, and approval thresholds before money is spent.
        </p>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs font-medium ${
            feedback.type === 'success'
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Form: Proposed Parameters (5 Cols) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 lg:col-span-5 space-y-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-mono">
              Proposed Spend Parameters
            </h2>
            <span className="text-[11px] font-mono text-blue-600 font-bold">Department: {user?.department?.name || 'Assigned Scope'}</span>
          </div>

          <div className="space-y-4">
            {/* Department Select if Admin/Finance */}
            {(!user?.departmentId || user.role === 'ADMIN' || user.role === 'FINANCE') && departments.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-slate-500" /> Target Department
                </label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Category Select */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-slate-500" /> Expense Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Requested Amount */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-slate-500" /> Proposed Amount ({currency})
                </span>
                <span className="text-[11px] text-slate-500 font-mono">Numeric Precision</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-400 font-mono text-sm">{currencySymbol}</span>
                <input
                  type="number"
                  min="1"
                  step="1000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="20000"
                  className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-bold"
                />
              </div>
              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-2 mt-2">
                {[5000, 20000, 50000, 150000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmount(preset)}
                    className="text-[10px] font-mono px-2 py-1 rounded-md bg-slate-100 border border-slate-300 text-slate-700 hover:text-slate-900 hover:border-slate-400 transition-colors"
                  >
                    {formatCurrency(preset)}
                  </button>
                ))}
              </div>
            </div>

            {/* Vendor Name */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-slate-500" /> Vendor / Payee
              </label>
              <input
                type="text"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="AWS, GitHub, Delta Air, etc."
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" /> Business Justification
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Specify the business purpose of this expenditure..."
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Override Token Input */}
            <div className="pt-1 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowOverrideInput(!showOverrideInput)}
                className="text-[11px] font-mono text-blue-600 hover:underline flex items-center gap-1 font-semibold"
              >
                <Lock className="w-3 h-3" />
                <span>{showOverrideInput ? 'Hide Managerial Override Token' : 'Have a Managerial Override Token?'}</span>
              </button>

              {(showOverrideInput || preview?.complianceBadge === 'OVERRIDE_REQUIRED' || preview?.violations?.some(v => v.includes('Hard budget cap'))) && (
                <div className="mt-2 p-3 rounded-xl bg-slate-50 dark:bg-navy-950/40 border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-800 dark:text-slate-200">
                    Managerial Override Token
                  </label>
                  <input
                    type="text"
                    value={overrideToken}
                    onChange={(e) => setOverrideToken(e.target.value)}
                    placeholder="e.g. OVERRIDE-VP-7782"
                    className="w-full px-3 py-1.5 bg-white dark:bg-navy-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                  />
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Required to unlock hard-capped ceilings or mandatory override policies.
                  </p>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="button"
              onClick={handleSubmitAuthoritativeRequest}
              disabled={submitting || !preview || preview.decision === 'VIOLATION'}
              className={`w-full py-3 rounded-xl font-semibold text-xs transition-all flex items-center justify-center space-x-2 ${
                preview?.decision === 'VIOLATION'
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
              }`}
            >
              <span>{submitting ? 'Submitting Request...' : 'Commit Authoritative Spending Request'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            {preview?.decision === 'VIOLATION' && (
              <p className="text-[11px] text-red-600 text-center">
                Submissions that violate budget policy are blocked. File an exception override if urgent.
              </p>
            )}
          </div>
        </div>

        {/* Right Preview Card: The Flagship Verdict Display (7 Cols) */}
        <div className="space-y-6 lg:col-span-7">
          {preview ? (
            <div className={`glass-panel p-6 rounded-2xl border ${style.bg} ${style.glow} transition-all space-y-6 relative`}>
              {loadingPreview && (
                <div className="absolute top-4 right-4 text-[10px] font-mono text-slate-400 animate-pulse">
                  Recalculating...
                </div>
              )}

              {/* Verdict Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-2xl bg-slate-100 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 shadow-md">
                    <VerdictIcon className="w-8 h-8" />
                  </div>
                  <div>
                    <div className="text-[11px] font-mono uppercase tracking-wider font-semibold opacity-75">
                      Spend Decision Verdict
                    </div>
                    <div className="text-xl md:text-2xl font-black tracking-tight">{style.title}</div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <span className={`text-[10px] font-mono uppercase font-bold px-2.5 py-1 rounded-full ${style.badge}`}>
                    {preview.decision}
                  </span>
                  {preview.complianceBadge && (
                    <span className={`text-[9px] font-mono uppercase font-bold px-2 py-0.5 rounded border ${
                      preview.complianceBadge === 'EXCEPTION_FLAGGED' || preview.complianceBadge === 'OVERRIDE_REQUIRED'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      {preview.complianceBadge.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
              </div>

              {/* Active Exception Rules Interception Callout (Color 3: Crimson/Coral Red) */}
              {(preview.exceptionTriggered || (preview.triggeredRules && preview.triggeredRules.length > 0)) && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 space-y-2.5">
                  <div className="flex items-center gap-2 text-red-900 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Budget Exception Rule Intercepted</span>
                    <span className="ml-auto font-mono text-[10px] px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-200 font-bold">
                      Route: {preview.routeStatus || 'PENDING_EXCEPTION_REVIEW'}
                    </span>
                  </div>

                  {preview.triggeredRules && preview.triggeredRules.length > 0 ? (
                    <div className="space-y-2 pt-1">
                      {preview.triggeredRules.map((rule, idx) => (
                        <div key={idx} className="p-2.5 rounded-lg bg-white border border-red-200 text-xs space-y-1">
                          <div className="flex items-center justify-between font-mono font-bold text-slate-900">
                            <span>{rule.ruleCode || rule.code}: {rule.ruleName || rule.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 font-bold">
                              {rule.action}
                            </span>
                          </div>
                          <p className="text-slate-600 text-[11px]">{rule.description || rule.message}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <p className="text-[11px] text-red-800 font-medium">
                    Automated straight-through approval is blocked by policy. This spend will require multi-tier authorization by department leadership or finance.
                  </p>
                </div>
              )}

              {/* Core Financial State Comparison Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-navy-950/80 border border-slate-200 dark:border-slate-800 text-xs">
                <div>
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase">Governing Budget</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{formatCurrency(preview.budgetAmount)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase">Actual Settled</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{formatCurrency(preview.actualSpend)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase">Committed</div>
                  <div className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-0.5">{formatCurrency(preview.committedSpend)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase">Available Before</div>
                  <div className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-0.5">{formatCurrency(preview.availableBefore)}</div>
                </div>
              </div>

              {/* Spend Impact & Utilization Progress */}
              <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-navy-900/60 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Budget Utilization Impact</span>
                  <div className="font-mono text-right">
                    <span className="text-slate-500 dark:text-slate-400">{preview.utilizationBefore}%</span>
                    <span className="text-blue-600 dark:text-blue-400 mx-1.5 font-bold">→</span>
                    <span className={`font-bold ${preview.utilizationAfter > 100 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                      {preview.utilizationAfter}%
                    </span>
                  </div>
                </div>

                {/* Visual Before vs After bar */}
                <div className="w-full h-3 bg-slate-200 dark:bg-navy-950 rounded-full overflow-hidden p-0.5 border border-slate-300 dark:border-slate-800 flex">
                  {/* Current spend */}
                  <div
                    style={{ width: `${Math.min(preview.utilizationBefore, 100)}%` }}
                    className="bg-blue-600 h-full rounded-l-full"
                    title={`Current: ${preview.utilizationBefore}%`}
                  />
                  {/* Incremental proposed spend */}
                  <div
                    style={{
                      width: `${Math.min(Math.max(preview.utilizationAfter - preview.utilizationBefore, 0), 100 - Math.min(preview.utilizationBefore, 100))}%`,
                    }}
                    className={`h-full ${preview.utilizationAfter > 100 ? 'bg-red-500' : 'bg-blue-400'}`}
                    title={`Proposed: +${(preview.utilizationAfter - preview.utilizationBefore).toFixed(1)}%`}
                  />
                </div>

                {/* Calculation formula display */}
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
                  <span>Projected Spend: {formatCurrency(preview.projectedSpend)}</span>
                  <span className={preview.remainingAfter < 0 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-700 dark:text-slate-300'}>
                    Remaining Headroom: {formatCurrency(preview.remainingAfter)}
                  </span>
                </div>
              </div>

              {/* Explainable Reasoning & Rule Details */}
              <div className="space-y-2">
                <div className="text-xs font-mono uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wider">
                  Audit Decision Explanation
                </div>

                {preview.violations.length > 0 && (
                  <div className="space-y-1.5">
                    {preview.violations.map((v, i) => (
                      <div key={i} className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                        <AlertOctagon className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                        <div>{v}</div>
                      </div>
                    ))}
                  </div>
                )}

                {preview.warnings.length > 0 && (
                  <div className="space-y-1.5">
                    {preview.warnings.map((w, i) => (
                      <div key={i} className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                        <div>{w}</div>
                      </div>
                    ))}
                  </div>
                )}

                {preview.reasons.length > 0 && (
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-navy-950/70 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs space-y-1">
                    {preview.reasons.map((r, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Engine Timestamp Footer */}
              <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span>Calculated At: {new Date(preview.calculatedAt).toLocaleTimeString()}</span>
                <span>SpendDecisionEngine v{preview.engineVersion}</span>
              </div>
            </div>
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-500 space-y-3 shadow-sm">
              <Sparkles className="w-10 h-10 text-blue-600/50 mx-auto" />
              <div className="text-sm font-semibold text-slate-800">Awaiting Spend Parameters</div>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                Select a category and amount to run real-time backend decision logic and visualize financial impact.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
