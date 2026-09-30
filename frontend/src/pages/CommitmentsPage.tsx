import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Commitment } from '../types';
import { Lock, RefreshCw, XCircle, CheckCircle2, ShieldCheck, Building } from 'lucide-react';

export const CommitmentsPage: React.FC = () => {
  const { user } = useAuth();
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCommitments = async () => {
    try {
      const data = await api.get<Commitment[]>('/commitments');
      setCommitments(data);
    } catch (err) {
      console.error('Failed to load commitments', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommitments();
  }, []);

  const handleCancelCommitment = async (id: string) => {
    const reason = prompt('Enter mandatory commitment cancellation reason:');
    if (!reason) return;

    try {
      await api.post(`/commitments/${id}/cancel`, { reason });
      fetchCommitments();
    } catch (err: any) {
      alert(err.message || 'Cancellation failed');
    }
  };

  const isFinanceOrAdmin = user?.role === 'FINANCE' || user?.role === 'ADMIN';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Lock className="w-6 h-6 text-indigo-400" />
            <span>Active Financial Commitments</span>
          </h1>
          <p className="text-xs text-slate-400">
            Obligated company funds reserved against approved requests. Prevents duplicate allocation and race conditions.
          </p>
        </div>

        <button
          onClick={fetchCommitments}
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
                <th className="px-6 py-3.5">Vendor & Purpose</th>
                <th className="px-6 py-3.5">Department</th>
                <th className="px-6 py-3.5 text-right">Committed Amount</th>
                <th className="px-6 py-3.5 text-right">Remaining Obligation</th>
                <th className="px-6 py-3.5 text-center">Status</th>
                <th className="px-6 py-3.5">Created</th>
                {isFinanceOrAdmin && <th className="px-6 py-3.5 text-center">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    Loading commitments...
                  </td>
                </tr>
              ) : commitments.length > 0 ? (
                commitments.map((c) => (
                  <tr key={c.id} className="hover:bg-navy-850/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-white text-sm">{c.spendingRequest?.vendor || 'PO Obligation'}</div>
                      <div className="text-slate-400 text-xs truncate max-w-xs">{c.spendingRequest?.description}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      {c.spendingRequest?.department?.name || 'Department'}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-sm text-slate-300">
                      ₹{c.committedAmount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-sm text-indigo-400">
                      ₹{c.remainingAmount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                          c.status === 'SETTLED'
                            ? 'bg-slate-500/10 text-slate-400 border border-slate-500/30'
                            : c.status === 'CANCELLED'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 font-mono text-[11px]">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    {isFinanceOrAdmin && (
                      <td className="px-6 py-4 text-center">
                        {c.status === 'ACTIVE' && (
                          <button
                            onClick={() => handleCancelCommitment(c.id)}
                            className="px-2 py-1 rounded bg-navy-900 border border-slate-700/80 text-rose-300 hover:text-white hover:border-rose-500 text-[11px] font-mono"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No active commitments found. Approved requests automatically create commitments.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
