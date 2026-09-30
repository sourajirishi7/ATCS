import React, { useState } from 'react';
import { api } from '../lib/api';
import {
  FlaskConical,
  CheckCircle2,
  Clock,
  XCircle,
  Play,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  Lock,
  Wallet,
  AlertOctagon,
} from 'lucide-react';

export const SandboxPage: React.FC = () => {
  const [activeScenario, setActiveScenario] = useState<'A' | 'B' | 'C' | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [running, setRunning] = useState(false);

  const runScenario = async (type: 'A' | 'B' | 'C') => {
    setActiveScenario(type);
    setRunning(true);
    setResult(null);
    try {
      const res = await api.post<any>(`/sandbox/scenario/${type}`);
      setResult(res);
    } catch (err: any) {
      alert(err.message || 'Failed to execute scenario');
    } finally {
      setRunning(false);
    }
  };

  const scenarios = [
    {
      type: 'A' as const,
      badge: 'SCENARIO A — BEST CASE',
      title: 'Automatic Clean Approval',
      desc: 'Requested amount is comfortably within available budget and below the configured manager approval threshold.',
      params: {
        budget: 100000,
        actual: 20000,
        committed: 10000,
        request: 5000,
        projected: 35000,
        expectedVerdict: 'APPROVE',
      },
      color: 'border-emerald-500/30 hover:border-emerald-500/60 bg-emerald-500/5',
      btnColor: 'bg-emerald-600 hover:bg-emerald-500',
    },
    {
      type: 'B' as const,
      badge: 'SCENARIO B — AVERAGE CASE',
      title: 'Approval Required by Rule',
      desc: 'Requested spend is within budget, but request amount crosses the configured employee threshold (> ₹15,000).',
      params: {
        budget: 100000,
        actual: 50000,
        committed: 20000,
        request: 20000,
        projected: 90000,
        expectedVerdict: 'APPROVAL_REQUIRED',
      },
      color: 'border-amber-500/30 hover:border-amber-500/60 bg-amber-500/5',
      btnColor: 'bg-amber-600 hover:bg-amber-500',
    },
    {
      type: 'C' as const,
      badge: 'SCENARIO C — WORST CASE',
      title: 'Hard Budget Overrun Violation',
      desc: 'Actual spend + Committed spend + Proposed spend exceeds approved budget ceiling. Request is blocked.',
      params: {
        budget: 100000,
        actual: 60000,
        committed: 30000,
        request: 20000,
        projected: 110000,
        expectedVerdict: 'VIOLATION',
      },
      color: 'border-rose-500/30 hover:border-rose-500/60 bg-rose-500/5',
      btnColor: 'bg-rose-600 hover:bg-rose-500',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="inline-flex items-center space-x-2 text-indigo-400 text-xs font-mono font-medium mb-1">
          <FlaskConical className="w-4 h-4" />
          <span>VERIFICATION & EVALUATION SANDBOX</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
          Mandatory Demonstration Scenarios
        </h1>
        <p className="text-xs md:text-sm text-slate-400 max-w-3xl">
          Execute the 3 core financial governance scenarios defined in the master specification. Each test runs the authoritative backend SpendDecisionEngine and proves explainability, priority resolution, and decimal accuracy.
        </p>
      </div>

      {/* 3 Scenario Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {scenarios.map((sc) => (
          <div
            key={sc.type}
            className={`glass-panel p-6 rounded-2xl border transition-all ${sc.color} flex flex-col justify-between space-y-5`}
          >
            <div className="space-y-3">
              <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-navy-950 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300">
                {sc.badge}
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{sc.title}</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">{sc.desc}</p>

              {/* Parameter Table */}
              <div className="p-3.5 rounded-xl bg-slate-100/80 dark:bg-navy-950/80 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Budget:</span>
                  <span className="text-slate-900 dark:text-white font-bold">₹{sc.params.budget.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Actual Spend:</span>
                  <span className="text-cyan-600 dark:text-cyan-400 font-bold">₹{sc.params.actual.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Committed Spend:</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-bold">₹{sc.params.committed.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Proposed Request:</span>
                  <span className="text-slate-900 dark:text-white font-bold">₹{sc.params.request.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800">
                  <span>Projected Spend:</span>
                  <span className={sc.params.projected > sc.params.budget ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-700 dark:text-slate-200'}>
                    ₹{sc.params.projected.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => runScenario(sc.type)}
              disabled={running}
              className={`w-full py-3 rounded-xl text-white font-semibold text-xs shadow-md transition-all flex items-center justify-center space-x-2 ${sc.btnColor}`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{running && activeScenario === sc.type ? 'Evaluating...' : `Run ${sc.badge}`}</span>
            </button>
          </div>
        ))}
      </div>

      {/* Live Engine Output Card */}
      {result && (
        <div className="glass-panel p-6 rounded-2xl border border-indigo-500/30 space-y-6 bg-white dark:bg-navy-900/90 shadow-glow">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-2xl bg-slate-100 dark:bg-navy-950 border border-slate-200 dark:border-slate-800">
                <ShieldCheck className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase text-indigo-400 font-semibold">
                  SpendDecisionEngine Execution Result
                </span>
                <h3 className="text-xl font-bold text-white">{result.scenario.name}</h3>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-slate-400">Verdict Match:</span>
              <span
                className={`px-3 py-1 rounded-full font-mono text-xs font-bold ${
                  result.verdictMatchesExpectation
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                }`}
              >
                {result.verdictMatchesExpectation ? '✓ 100% SPEC VERIFIED' : 'MISMATCH'}
              </span>
            </div>
          </div>

          {/* Calculations Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-navy-950 border border-slate-800 text-xs font-mono">
            <div>
              <span className="text-slate-400">Approved Budget</span>
              <div className="text-base font-bold text-white mt-1">₹{result.evaluation.budgetAmount.toLocaleString()}</div>
            </div>
            <div>
              <span className="text-slate-400">Projected Total</span>
              <div className="text-base font-bold text-indigo-300 mt-1">₹{result.evaluation.projectedSpend.toLocaleString()}</div>
            </div>
            <div>
              <span className="text-slate-400">Utilization Impact</span>
              <div className="text-base font-bold text-white mt-1">
                {result.evaluation.utilizationBefore}% → {result.evaluation.utilizationAfter}%
              </div>
            </div>
            <div>
              <span className="text-slate-400">Engine Verdict</span>
              <div
                className={`text-base font-black mt-1 ${
                  result.evaluation.decision === 'APPROVE'
                    ? 'text-emerald-400'
                    : result.evaluation.decision === 'VIOLATION'
                    ? 'text-rose-400'
                    : 'text-amber-400'
                }`}
              >
                {result.evaluation.decision}
              </div>
            </div>
          </div>

          {/* Visual Formula Display for Scenario C */}
          {result.evaluation.decision === 'VIOLATION' && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-2">
              <div className="text-xs font-mono font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertOctagon className="w-4 h-4" /> Explainable Mathematical Breakdown
              </div>
              <div className="p-3 rounded-lg bg-navy-950 border border-slate-800 text-xs font-mono text-slate-200 space-y-1">
                <div>₹{result.evaluation.actualSpend.toLocaleString()} (Actual Settled)</div>
                <div>+ ₹{result.evaluation.committedSpend.toLocaleString()} (Existing Commitments)</div>
                <div>+ ₹{result.evaluation.requestedAmount.toLocaleString()} (Proposed Request)</div>
                <div className="pt-1 border-t border-slate-700 font-bold text-white">
                  = ₹{result.evaluation.projectedSpend.toLocaleString()} Projected Spend
                </div>
                <div className="text-rose-400 font-bold pt-1">
                  Budget = ₹{result.evaluation.budgetAmount.toLocaleString()} → OVER BUDGET BY ₹
                  {(result.evaluation.projectedSpend - result.evaluation.budgetAmount).toLocaleString()}
                </div>
              </div>
            </div>
          )}

          {/* Audit Reasons */}
          <div className="space-y-1.5 text-xs">
            <span className="font-semibold text-slate-300">Recorded Audit Reasons & Rules</span>
            <div className="p-3 rounded-lg bg-navy-950 border border-slate-800 text-slate-300 text-[11px] font-mono space-y-1">
              {result.evaluation.reasons.map((r: string, idx: number) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                  <span>{r}</span>
                </div>
              ))}
              {result.evaluation.violations.map((v: string, idx: number) => (
                <div key={`v-${idx}`} className="text-rose-400 font-medium">
                  • {v}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
