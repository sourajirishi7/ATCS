import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Category, DecisionEvaluationOutput } from '../types';
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
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [amount, setAmount] = useState<number | string>(20000);
  const [vendor, setVendor] = useState('DataDog APM Cloud');
  const [description, setDescription] = useState('Monthly enterprise infrastructure observability licenses');
  
  const [preview, setPreview] = useState<DecisionEvaluationOutput | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    async function loadCategories() {
      try {
        const data = await api.get<Category[]>('/categories');
        setCategories(data);
        if (data.length > 0) setSelectedCategory(data[0].id);
      } catch (err) {
        console.error('Failed to load categories', err);
      }
    }
    loadCategories();
  }, []);

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
          requestedAmount: Number(amount),
          currency: 'INR',
          vendor: vendor || 'Vendor',
          description: description || 'Spend simulation',
        });
        setPreview(result);
      } catch (err: any) {
        console.error('Preview evaluation error:', err);
      } finally {
        setLoadingPreview(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [selectedCategory, amount, vendor, description]);

  // Submit actual authoritative request to database
  const handleSubmitAuthoritativeRequest = async () => {
    if (!selectedCategory || !amount || Number(amount) <= 0) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await api.post<any>('/spending-requests', {
        categoryId: selectedCategory,
        requestedAmount: Number(amount),
        currency: 'INR',
        vendor,
        description,
      });

      setFeedback({
        type: 'success',
        message: `Request created with verdict '${res.verdict.decision}'. Status: ${res.spendingRequest.status}`,
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
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          badge: 'bg-emerald-500 text-navy-950',
          icon: CheckCircle2,
          glow: 'shadow-glow-emerald',
          title: 'PRE-APPROVED BY RULES',
        };
      case 'APPROVAL_REQUIRED':
        return {
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
          badge: 'bg-amber-500 text-navy-950',
          icon: Clock,
          glow: 'shadow-glow-amber',
          title: 'APPROVAL REQUIRED',
        };
      case 'VIOLATION':
        return {
          bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
          badge: 'bg-rose-500 text-white',
          icon: XCircle,
          glow: 'shadow-glow-rose',
          title: 'BUDGET POLICY VIOLATION',
        };
      case 'WARNING':
        return {
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
          badge: 'bg-amber-500 text-navy-950',
          icon: AlertTriangle,
          glow: 'shadow-glow-amber',
          title: 'APPROVED WITH HIGH-UTILIZATION WARNING',
        };
      default:
        return {
          bg: 'bg-slate-800 border-slate-700 text-slate-300',
          badge: 'bg-slate-700 text-white',
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
        <div className="inline-flex items-center space-x-2 text-indigo-400 text-xs font-mono font-medium mb-1">
          <Sparkles className="w-4 h-4" />
          <span>SPEND BEFORE YOU SPEND ENGINE</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
          Spend Decision Preview Simulator
        </h1>
        <p className="text-xs md:text-sm text-slate-400 max-w-2xl">
          Test proposed spending in real-time. The central authoritative engine recalculates budget ceilings, existing actuals, outstanding commitments, and approval thresholds before money is spent.
        </p>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Form: Proposed Parameters (5 Cols) */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 lg:col-span-5 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Proposed Spend Parameters
            </h2>
            <span className="text-[11px] font-mono text-indigo-400">Department: {user?.department?.name || 'Assigned Scope'}</span>
          </div>

          <div className="space-y-4">
            {/* Category Select */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-slate-400" /> Expense Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-navy-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
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
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-slate-400" /> Proposed Amount (INR)
                </span>
                <span className="text-[11px] text-slate-400 font-mono">Numeric Precision</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-400 font-mono text-sm">₹</span>
                <input
                  type="number"
                  min="1"
                  step="1000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="20000"
                  className="w-full pl-8 pr-4 py-2.5 bg-navy-950 border border-slate-800 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-indigo-500 font-bold"
                />
              </div>
              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-2 mt-2">
                {[5000, 20000, 50000, 150000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmount(preset)}
                    className="text-[10px] font-mono px-2 py-1 rounded-md bg-navy-900 border border-slate-700/80 text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
                  >
                    ₹{preset.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Vendor Name */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-slate-400" /> Vendor / Payee
              </label>
              <input
                type="text"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="AWS, GitHub, Delta Air, etc."
                className="w-full px-3.5 py-2.5 bg-navy-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" /> Business Justification
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Specify the business purpose of this expenditure..."
                className="w-full px-3.5 py-2.5 bg-navy-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Submit Button */}
            <button
              type="button"
              onClick={handleSubmitAuthoritativeRequest}
              disabled={submitting || !preview || preview.decision === 'VIOLATION'}
              className={`w-full py-3 rounded-xl font-semibold text-xs transition-all flex items-center justify-center space-x-2 ${
                preview?.decision === 'VIOLATION'
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-glow'
              }`}
            >
              <span>{submitting ? 'Submitting Request...' : 'Commit Authoritative Spending Request'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            {preview?.decision === 'VIOLATION' && (
              <p className="text-[11px] text-rose-400 text-center">
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
                  <div className="p-3 rounded-2xl bg-navy-950 border border-slate-800 shadow-md">
                    <VerdictIcon className="w-8 h-8" />
                  </div>
                  <div>
                    <div className="text-[11px] font-mono uppercase tracking-wider font-semibold opacity-75">
                      Spend Decision Verdict
                    </div>
                    <div className="text-xl md:text-2xl font-black tracking-tight">{style.title}</div>
                  </div>
                </div>

                <span className={`text-[10px] font-mono uppercase font-bold px-2.5 py-1 rounded-full ${style.badge}`}>
                  {preview.decision}
                </span>
              </div>

              {/* Core Financial State Comparison Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-navy-950/80 border border-slate-800 text-xs">
                <div>
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Governing Budget</div>
                  <div className="text-sm font-bold text-white mt-0.5">₹{preview.budgetAmount.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Actual Settled</div>
                  <div className="text-sm font-bold text-cyan-400 mt-0.5">₹{preview.actualSpend.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Committed</div>
                  <div className="text-sm font-bold text-indigo-400 mt-0.5">₹{preview.committedSpend.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Available Before</div>
                  <div className="text-sm font-bold text-emerald-400 mt-0.5">₹{preview.availableBefore.toLocaleString()}</div>
                </div>
              </div>

              {/* Spend Impact & Utilization Progress */}
              <div className="space-y-3 p-4 rounded-xl bg-navy-900/60 border border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">Budget Utilization Impact</span>
                  <div className="font-mono text-right">
                    <span className="text-slate-400">{preview.utilizationBefore}%</span>
                    <span className="text-indigo-400 mx-1.5 font-bold">→</span>
                    <span className={`font-bold ${preview.utilizationAfter > 100 ? 'text-rose-400' : 'text-white'}`}>
                      {preview.utilizationAfter}%
                    </span>
                  </div>
                </div>

                {/* Visual Before vs After bar */}
                <div className="w-full h-3 bg-navy-950 rounded-full overflow-hidden p-0.5 border border-slate-800 flex">
                  {/* Current spend */}
                  <div
                    style={{ width: `${Math.min(preview.utilizationBefore, 100)}%` }}
                    className="bg-indigo-500 h-full rounded-l-full"
                    title={`Current: ${preview.utilizationBefore}%`}
                  />
                  {/* Incremental proposed spend */}
                  <div
                    style={{
                      width: `${Math.min(Math.max(preview.utilizationAfter - preview.utilizationBefore, 0), 100 - Math.min(preview.utilizationBefore, 100))}%`,
                    }}
                    className={`h-full ${preview.utilizationAfter > 100 ? 'bg-rose-500' : 'bg-emerald-400'}`}
                    title={`Proposed: +${(preview.utilizationAfter - preview.utilizationBefore).toFixed(1)}%`}
                  />
                </div>

                {/* Calculation formula display */}
                <div className="text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <span>Projected Spend: ₹{preview.projectedSpend.toLocaleString()}</span>
                  <span className={preview.remainingAfter < 0 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                    Remaining Headroom: ₹{preview.remainingAfter.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Explainable Reasoning & Rule Details */}
              <div className="space-y-2">
                <div className="text-xs font-mono uppercase text-slate-400 font-semibold tracking-wider">
                  Audit Decision Explanation
                </div>

                {preview.violations.length > 0 && (
                  <div className="space-y-1.5">
                    {preview.violations.map((v, i) => (
                      <div key={i} className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                        <AlertOctagon className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                        <div>{v}</div>
                      </div>
                    ))}
                  </div>
                )}

                {preview.warnings.length > 0 && (
                  <div className="space-y-1.5">
                    {preview.warnings.map((w, i) => (
                      <div key={i} className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                        <div>{w}</div>
                      </div>
                    ))}
                  </div>
                )}

                {preview.reasons.length > 0 && (
                  <div className="p-3 rounded-lg bg-navy-950/70 border border-slate-800 text-slate-300 text-xs space-y-1">
                    {preview.reasons.map((r, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Engine Timestamp Footer */}
              <div className="text-[10px] font-mono text-slate-400 pt-2 border-t border-slate-800 flex items-center justify-between">
                <span>Calculated At: {new Date(preview.calculatedAt).toLocaleTimeString()}</span>
                <span>SpendDecisionEngine v{preview.engineVersion}</span>
              </div>
            </div>
          ) : (
            <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center text-slate-400 space-y-3">
              <Sparkles className="w-10 h-10 text-indigo-400/50 mx-auto" />
              <div className="text-sm font-semibold text-slate-300">Awaiting Spend Parameters</div>
              <p className="text-xs max-w-sm mx-auto">
                Select a category and amount to run real-time backend decision logic and visualize financial impact.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
