import React, { useState } from 'react';
import { api } from '../lib/api';
import { useCurrency } from '../context/CurrencyContext';
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
  const { formatCurrency } = useCurrency();
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
      color: 'border-slate-200 hover:border-blue-400 bg-white shadow-sm',
      btnColor: 'bg-blue-600 hover:bg-blue-700',
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
      color: 'border-slate-200 hover:border-slate-400 bg-white shadow-sm',
      btnColor: 'bg-slate-700 hover:bg-slate-800',
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
      color: 'border-slate-200 hover:border-red-400 bg-white shadow-sm',
      btnColor: 'bg-red-600 hover:bg-red-700',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="inline-flex items-center space-x-2 text-blue-600 text-xs font-mono font-medium mb-1">
          <FlaskConical className="w-4 h-4" />
          <span>VERIFICATION & EVALUATION SANDBOX</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
          Mandatory Demonstration Scenarios
        </h1>
        <p className="text-xs md:text-sm text-slate-600 max-w-3xl">
          Execute the 3 core financial governance scenarios defined in the master specification. Each test runs the authoritative backend SpendDecisionEngine and proves explainability, priority resolution, and decimal accuracy.
        </p>
      </div>

      {/* 3 Scenario Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {scenarios.map((sc) => (
          <div
            key={sc.type}
            className={`p-6 rounded-2xl border transition-all ${sc.color} flex flex-col justify-between space-y-5`}
          >
            <div className="space-y-3">
              <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700">
                {sc.badge}
              </span>
              <h2 className="text-lg font-bold text-slate-900">{sc.title}</h2>
              <p className="text-xs text-slate-600">{sc.desc}</p>

              {/* Parameter Table */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-slate-600">
                  <span>Budget:</span>
                  <span className="text-slate-900 font-bold">{formatCurrency(sc.params.budget)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Actual Spend:</span>
                  <span className="text-blue-700 font-bold">{formatCurrency(sc.params.actual)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Committed Spend:</span>
                  <span className="text-blue-600 font-bold">{formatCurrency(sc.params.committed)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Proposed Request:</span>
                  <span className="text-slate-900 font-bold">{formatCurrency(sc.params.request)}</span>
                </div>
                <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-200">
                  <span>Projected Spend:</span>
                  <span className={sc.params.projected > sc.params.budget ? 'text-red-600 font-bold' : 'text-slate-700'}>
                    {formatCurrency(sc.params.projected)}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => runScenario(sc.type)}
              disabled={running}
              className={`w-full py-3 rounded-xl text-white font-semibold text-xs shadow-sm transition-all flex items-center justify-center space-x-2 ${sc.btnColor}`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{running && activeScenario === sc.type ? 'Evaluating...' : `Run ${sc.badge}`}</span>
            </button>
          </div>
        ))}
      </div>

      {/* Live Engine Output Card */}
      {result && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200">
                <ShieldCheck className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase text-blue-600 font-semibold">
                  SpendDecisionEngine Execution Result
                </span>
                <h3 className="text-xl font-bold text-slate-900">{result.scenario.name}</h3>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-slate-600">Verdict Match:</span>
              <span
                className={`px-3 py-1 rounded-full font-mono text-xs font-bold border ${
                  result.verdictMatchesExpectation
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}
              >
                {result.verdictMatchesExpectation ? '✓ 100% SPEC VERIFIED' : 'MISMATCH'}
              </span>
            </div>
          </div>

          {/* Calculations Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono">
            <div>
              <span className="text-slate-500">Approved Budget</span>
              <div className="text-base font-bold text-slate-900 mt-1">{formatCurrency(result.evaluation.budgetAmount)}</div>
            </div>
            <div>
              <span className="text-slate-500">Projected Total</span>
              <div className="text-base font-bold text-blue-700 mt-1">{formatCurrency(result.evaluation.projectedSpend)}</div>
            </div>
            <div>
              <span className="text-slate-500">Utilization Impact</span>
              <div className="text-base font-bold text-slate-900 mt-1">
                {result.evaluation.utilizationBefore}% → {result.evaluation.utilizationAfter}%
              </div>
            </div>
            <div>
              <span className="text-slate-500">Engine Verdict</span>
              <div
                className={`text-base font-black mt-1 ${
                  result.evaluation.decision === 'APPROVE'
                    ? 'text-blue-700'
                    : result.evaluation.decision === 'VIOLATION'
                    ? 'text-red-600'
                    : 'text-slate-800'
                }`}
              >
                {result.evaluation.decision}
              </div>
            </div>
          </div>

          {/* Visual Formula Display for Scenario C */}
          {result.evaluation.decision === 'VIOLATION' && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 space-y-2">
              <div className="text-xs font-mono font-bold text-red-700 uppercase tracking-wider flex items-center gap-1.5">
                <AlertOctagon className="w-4 h-4" /> Explainable Mathematical Breakdown
              </div>
              <div className="p-3 rounded-lg bg-white border border-red-100 text-xs font-mono text-slate-700 space-y-1">
                <div>{formatCurrency(result.evaluation.actualSpend)} (Actual Settled)</div>
                <div>+ {formatCurrency(result.evaluation.committedSpend)} (Existing Commitments)</div>
                <div>+ {formatCurrency(result.evaluation.requestedAmount)} (Proposed Request)</div>
                <div className="pt-1 border-t border-slate-200 font-bold text-slate-900">
                  = {formatCurrency(result.evaluation.projectedSpend)} Projected Spend
                </div>
                <div className="text-red-700 font-bold pt-1">
                  Budget = {formatCurrency(result.evaluation.budgetAmount)} → OVER BUDGET BY{' '}
                  {formatCurrency(result.evaluation.projectedSpend - result.evaluation.budgetAmount)}
                </div>
              </div>
            </div>
          )}

          {/* Audit Reasons */}
          <div className="space-y-1.5 text-xs">
            <span className="font-semibold text-slate-700">Recorded Audit Reasons & Rules</span>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-mono space-y-1">
              {result.evaluation.reasons.map((r: string, idx: number) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                  <span>{r}</span>
                </div>
              ))}
              {result.evaluation.violations.map((v: string, idx: number) => (
                <div key={`v-${idx}`} className="text-red-600 font-medium">
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
