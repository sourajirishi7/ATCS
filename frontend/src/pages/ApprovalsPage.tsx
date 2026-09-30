import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { SpendingRequest } from '../types';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Building,
  User as UserIcon,
  Tag,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

export const ApprovalsPage: React.FC = () => {
  const { user } = useAuth();
  const [pendingRequests, setPendingRequests] = useState<SpendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchPending = async () => {
    try {
      const data = await api.get<SpendingRequest[]>('/approvals');
      setPendingRequests(data);
    } catch (err) {
      console.error('Failed to load pending approvals', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleDecision = async (id: string, decision: 'approve' | 'reject') => {
    setProcessingId(id);
    setMessage(null);
    try {
      const commentText = comments[id] || (decision === 'approve' ? 'Approved per financial authority' : 'Rejected');
      await api.post(`/approvals/${id}/${decision}`, { comments: commentText });

      setMessage({
        type: 'success',
        text: `Request was successfully ${decision === 'approve' ? 'APPROVED & COMMITTED' : 'REJECTED'}.`,
      });

      // Remove from local list
      setPendingRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || `Failed to ${decision} request.`,
      });
    } finally {
      setProcessingId(null);
    }
  };

  const isSelf = (req: SpendingRequest) => {
    return req.employeeId === user?.id && user?.role !== 'ADMIN';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            <span>Manager & Finance Approvals Queue</span>
          </h1>
          <p className="text-xs text-slate-400">
            Authoritative approval decisions create immutable commitments in PostgreSQL. Self-approval is strictly forbidden.
          </p>
        </div>

        <button
          onClick={fetchPending}
          className="self-start sm:self-auto flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-navy-900 border border-slate-700/80 text-xs text-slate-300 hover:text-white"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Queue</span>
        </button>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl border text-xs font-medium ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}
        >
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-xs">Loading pending approvals...</div>
      ) : pendingRequests.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {pendingRequests.map((req) => {
            const selfApprovalBlocked = isSelf(req);
            return (
              <div
                key={req.id}
                className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4 hover:border-slate-700 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                  <div>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold">
                      AWAITING REVIEW
                    </span>
                    <h3 className="text-lg font-bold text-white mt-1.5">{req.vendor}</h3>
                    <p className="text-xs text-slate-400">{req.description}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="text-2xl font-black text-white font-mono">
                      ₹{req.requestedAmount.toLocaleString()}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">Currency: {req.currency}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs p-3.5 rounded-xl bg-navy-950/70 border border-slate-800">
                  <div className="flex items-center space-x-2">
                    <UserIcon className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div>
                      <div className="text-[10px] text-slate-400">Requestor</div>
                      <div className="font-semibold text-white truncate">{req.employee?.name}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Building className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div>
                      <div className="text-[10px] text-slate-400">Department</div>
                      <div className="font-semibold text-white">{req.department?.name}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Tag className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <div className="text-[10px] text-slate-400">Category</div>
                      <div className="font-semibold text-white">{req.category?.name}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <div className="text-[10px] text-slate-400">Date</div>
                      <div className="font-mono text-white text-[11px]">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Self Approval Warning */}
                {selfApprovalBlocked && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      Self-Approval Policy: You cannot approve your own request. Another manager or Finance must review.
                    </span>
                  </div>
                )}

                {/* Actions & Comment Input */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                  <input
                    type="text"
                    disabled={selfApprovalBlocked || processingId === req.id}
                    placeholder="Enter approval rationale or rejection comments..."
                    value={comments[req.id] || ''}
                    onChange={(e) => setComments({ ...comments, [req.id]: e.target.value })}
                    className="flex-1 w-full px-3.5 py-2.5 bg-navy-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                  />
                  <div className="flex items-center space-x-2 w-full sm:w-auto">
                    <button
                      onClick={() => handleDecision(req.id, 'reject')}
                      disabled={selfApprovalBlocked || processingId === req.id}
                      className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-semibold transition-all disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleDecision(req.id, 'approve')}
                      disabled={selfApprovalBlocked || processingId === req.id}
                      className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-glow-emerald text-xs font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approve & Commit</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center text-slate-400 space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-400/50 mx-auto" />
          <div className="text-sm font-semibold text-white">Approvals Queue is Clear</div>
          <p className="text-xs">There are no pending spending requests awaiting your review.</p>
        </div>
      )}
    </div>
  );
};
