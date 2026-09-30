import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, CheckCircle2, XCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react';

export const ExceptionsPage: React.FC = () => {
  const { user } = useAuth();
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Review Modal State
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [justification, setJustification] = useState('');
  const [reviewDecision, setReviewDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');

  const fetchExceptions = async () => {
    try {
      const data = await api.get<any[]>('/exceptions');
      setExceptions(data);
    } catch (err) {
      console.error('Failed to load exceptions', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExceptions();
  }, []);

  const handleReview = async () => {
    if (!reviewId || !justification) return;
    try {
      await api.post(`/exceptions/${reviewId}/review`, {
        decision: reviewDecision,
        justification,
      });
      setReviewId(null);
      setJustification('');
      fetchExceptions();
    } catch (err: any) {
      alert(err.message || 'Review failed');
    }
  };

  const isFinanceOrAdmin = user?.role === 'FINANCE' || user?.role === 'ADMIN';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-amber-400" />
            <span>Policy Exception Overrides</span>
          </h1>
          <p className="text-xs text-slate-400">
            Emergency financial overrides for hard-rule violations. Overrides require CFO / Finance authorization and are recorded permanently in the audit trail.
          </p>
        </div>

        <button
          onClick={fetchExceptions}
          className="self-start sm:self-auto flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-navy-900 border border-slate-700/80 text-xs text-slate-300 hover:text-white"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-navy-950/70 text-slate-400 font-mono uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">Vendor & Request</th>
                <th className="px-6 py-3.5">Requester</th>
                <th className="px-6 py-3.5 text-right">Amount</th>
                <th className="px-6 py-3.5">Override Reason</th>
                <th className="px-6 py-3.5 text-center">Status</th>
                <th className="px-6 py-3.5">Reviewer</th>
                {isFinanceOrAdmin && <th className="px-6 py-3.5 text-center">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    Loading exceptions...
                  </td>
                </tr>
              ) : exceptions.length > 0 ? (
                exceptions.map((ex) => (
                  <tr key={ex.id} className="hover:bg-navy-850/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-white text-sm">{ex.spendingRequest?.vendor}</div>
                      <div className="text-slate-400 text-xs truncate max-w-xs">{ex.spendingRequest?.description}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      <div>{ex.requester?.name}</div>
                      <div className="text-[11px] font-mono text-slate-400">{ex.requester?.email}</div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-sm text-white">
                      ₹{ex.spendingRequest?.requestedAmount?.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-slate-300 text-xs max-w-xs">
                      {ex.reason}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                          ex.decision === 'APPROVED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : ex.decision === 'REJECTED'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {ex.decision}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 font-mono text-[11px]">
                      {ex.reviewer ? `${ex.reviewer.name} (${new Date(ex.reviewedAt).toLocaleDateString()})` : '-'}
                    </td>
                    {isFinanceOrAdmin && (
                      <td className="px-6 py-4 text-center">
                        {ex.decision === 'PENDING' && (
                          <button
                            onClick={() => {
                              setReviewId(ex.id);
                              setJustification('');
                            }}
                            className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-mono transition-colors"
                          >
                            Review
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No exception override requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Modal */}
      {reviewId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-slate-700 space-y-4 bg-navy-900">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-400" /> Review Policy Exception Override
            </h3>
            <p className="text-xs text-slate-300">
              Authorized Finance decision. Approving will atomically create a commitment and record your officer signature.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Decision</label>
                <div className="flex items-center space-x-3">
                  <label className="flex items-center space-x-1.5 text-xs text-emerald-400 font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="decision"
                      checked={reviewDecision === 'APPROVED'}
                      onChange={() => setReviewDecision('APPROVED')}
                    />
                    <span>Authorize Override</span>
                  </label>
                  <label className="flex items-center space-x-1.5 text-xs text-rose-400 font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="decision"
                      checked={reviewDecision === 'REJECTED'}
                      onChange={() => setReviewDecision('REJECTED')}
                    />
                    <span>Reject Override</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Mandatory Officer Justification</label>
                <textarea
                  rows={3}
                  required
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Explain why this exception is authorized or denied..."
                  className="w-full px-3 py-2 bg-navy-950 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setReviewId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleReview}
                disabled={!justification}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-glow disabled:opacity-50"
              >
                Submit Decision
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
