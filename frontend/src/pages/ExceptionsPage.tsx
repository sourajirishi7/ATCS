import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, CheckCircle2, XCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';

export const ExceptionsPage: React.FC = () => {
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
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
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-red-600" />
            <span>Policy Exception Overrides</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Emergency financial overrides for hard-rule violations. Overrides require CFO / Finance authorization and are recorded permanently in the audit trail.
          </p>
        </div>

        <button
          onClick={fetchExceptions}
          className="self-start sm:self-auto flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-blue-600 border border-slate-200 shadow-sm transition-all text-xs font-medium"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-navy-950/70 text-slate-600 dark:text-slate-400 font-mono uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
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
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                    Loading exceptions...
                  </td>
                </tr>
              ) : exceptions.length > 0 ? (
                exceptions.map((ex) => (
                  <tr key={ex.id} className="hover:bg-slate-50 dark:hover:bg-navy-850/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 dark:text-white text-sm">{ex.spendingRequest?.vendor}</div>
                      <div className="text-slate-500 dark:text-slate-400 text-xs truncate max-w-xs">{ex.spendingRequest?.description}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                      <div>{ex.requester?.name}</div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{ex.requester?.email}</div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-sm text-slate-900 dark:text-white">
                      {formatCurrency(ex.spendingRequest?.requestedAmount || 0)}
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300 text-xs max-w-xs">
                      {ex.reason}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                          ex.decision === 'APPROVED'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : ex.decision === 'REJECTED'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-slate-50 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {ex.decision}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
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
                            className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-mono transition-colors font-medium shadow-sm"
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
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4 bg-white dark:bg-navy-900 shadow-2xl">
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-600" /> Review Policy Exception Override
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Authorized Finance decision. Approving will atomically create a commitment and record your officer signature.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Decision</label>
                <div className="flex items-center space-x-3">
                  <label className="flex items-center space-x-1.5 text-xs text-blue-700 font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="decision"
                      checked={reviewDecision === 'APPROVED'}
                      onChange={() => setReviewDecision('APPROVED')}
                      className="accent-blue-600"
                    />
                    <span>Authorize Override</span>
                  </label>
                  <label className="flex items-center space-x-1.5 text-xs text-red-700 font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="decision"
                      checked={reviewDecision === 'REJECTED'}
                      onChange={() => setReviewDecision('REJECTED')}
                      className="accent-red-600"
                    />
                    <span>Reject Override</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Mandatory Officer Justification</label>
                <textarea
                  rows={3}
                  required
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Explain why this exception is authorized or denied..."
                  className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setReviewId(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:border-transparent dark:text-slate-300 dark:hover:text-white text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReview}
                disabled={!justification}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50 transition-all"
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
