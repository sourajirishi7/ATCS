import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { SpendingRequest, DecisionSnapshot } from '../types';
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
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const SpendRequestsPage: React.FC = () => {
  const [requests, setRequests] = useState<SpendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSnapshot, setSelectedSnapshot] = useState<DecisionSnapshot | null>(null);

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
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
      case 'UNDER_REVIEW':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/30';
      case 'REJECTED':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/30';
      default:
        return 'bg-slate-500/10 text-slate-300 border border-slate-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-black dark:text-white tracking-tight flex items-center gap-2.5">
            <FileSpreadsheet className="w-6 h-6 text-blue-600 dark:text-indigo-400" />
            <span>Spending Requests Ledger</span>
          </h1>
          <p className="text-xs text-black dark:text-slate-400 font-medium">
            Every proposed spend evaluated by the SpendDecisionEngine with an immutable calculation snapshot.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchRequests}
            className="p-2.5 rounded-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-700/80 text-black dark:text-slate-300 hover:text-blue-600 dark:hover:text-white"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            to="/spend/preview"
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-glow transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Spend Simulation</span>
          </Link>
        </div>
      </div>

      {/* Requests Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-navy-950/70 text-slate-400 font-mono uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">Vendor & Description</th>
                <th className="px-6 py-3.5">Employee</th>
                <th className="px-6 py-3.5">Category</th>
                <th className="px-6 py-3.5 text-right">Amount</th>
                <th className="px-6 py-3.5 text-center">Status</th>
                <th className="px-6 py-3.5">Requested Date</th>
                <th className="px-6 py-3.5 text-center">Decision Snapshot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    Loading spending requests...
                  </td>
                </tr>
              ) : requests.length > 0 ? (
                requests.map((req) => (
                  <tr key={req.id} className="hover:bg-navy-850/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-white text-sm">{req.vendor}</div>
                      <div className="text-slate-400 text-xs truncate max-w-xs">{req.description}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      <div>{req.employee?.name}</div>
                      <div className="text-[11px] font-mono text-slate-400">{req.department?.name}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      <span className="px-2 py-1 rounded bg-navy-950 border border-slate-800 text-[11px] font-mono">
                        {req.category?.name}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-sm text-white">
                      ₹{req.requestedAmount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${getStatusBadge(req.status)}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 font-mono text-[11px]">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {req.decisionSnapshot ? (
                        <button
                          onClick={() => setSelectedSnapshot(req.decisionSnapshot!)}
                          className="px-2.5 py-1 rounded-lg bg-navy-900 border border-slate-700/80 text-indigo-300 hover:text-white hover:border-indigo-500 transition-colors text-[11px] font-mono inline-flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Snapshot</span>
                        </button>
                      ) : (
                        <span className="text-slate-600 text-[11px] font-mono">None</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No spending requests found. Run a simulation to create the first request!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Decision Snapshot Inspection Modal */}
      {selectedSnapshot && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-2xl p-6 rounded-2xl border border-slate-700 space-y-5 bg-navy-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-base">Immutable Decision Snapshot</h3>
              </div>
              <button
                onClick={() => setSelectedSnapshot(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕ Close
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs p-4 rounded-xl bg-navy-950 border border-slate-800 font-mono">
              <div>
                <span className="text-slate-400 text-[10px]">Budget At Decision</span>
                <div className="text-white font-bold mt-0.5">₹{selectedSnapshot.budgetAmount.toLocaleString()}</div>
              </div>
              <div>
                <span className="text-slate-400 text-[10px]">Actual Spend</span>
                <div className="text-cyan-400 font-bold mt-0.5">₹{selectedSnapshot.actualSpend.toLocaleString()}</div>
              </div>
              <div>
                <span className="text-slate-400 text-[10px]">Committed Spend</span>
                <div className="text-indigo-400 font-bold mt-0.5">₹{selectedSnapshot.committedSpend.toLocaleString()}</div>
              </div>
              <div>
                <span className="text-slate-400 text-[10px]">Requested</span>
                <div className="text-white font-bold mt-0.5">₹{selectedSnapshot.requestedAmount.toLocaleString()}</div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-navy-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Utilization Impact</span>
                <span className="font-mono text-white">
                  {selectedSnapshot.utilizationBefore}% → {selectedSnapshot.utilizationAfter}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Final Verdict</span>
                <span className="font-mono font-bold text-indigo-300">{selectedSnapshot.decision}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Engine Version</span>
                <span className="font-mono text-slate-400">{selectedSnapshot.engineVersion}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Calculated Timestamp</span>
                <span className="font-mono text-slate-400">{new Date(selectedSnapshot.calculatedAt).toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="font-semibold text-slate-300">Recorded Reasons / Violations</div>
              <div className="p-3 rounded-lg bg-navy-950 border border-slate-800 text-slate-300 text-[11px] font-mono whitespace-pre-wrap">
                {selectedSnapshot.reasons && typeof selectedSnapshot.reasons === 'string'
                  ? selectedSnapshot.reasons
                  : JSON.stringify(selectedSnapshot.reasons, null, 2)}
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setSelectedSnapshot(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
