import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { History, ShieldCheck, Search, Filter, Eye, RefreshCw } from 'lucide-react';

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const url = actionFilter ? `/audit-logs?action=${actionFilter}` : '/audit-logs';
      const res = await api.get<{ logs: any[]; total: number }>(url);
      setLogs(res.logs);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  const actionTypes = [
    '',
    'USER_LOGIN',
    'BUDGET_CREATED',
    'SPEND_REQUEST_CREATED',
    'SPEND_APPROVED',
    'SPEND_REJECTED',
    'TRANSACTION_CREATED',
    'TRANSACTION_REVERSED',
    'COMMITMENT_CANCELLED',
    'EXCEPTION_CREATED',
    'EXCEPTION_OVERRIDE_APPROVED',
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <History className="w-6 h-6 text-indigo-400" />
            <span>Financial Audit Trail</span>
          </h1>
          <p className="text-xs text-slate-400">
            Append-only tamper-proof ledger recording all financial evaluations, mutations, overrides, and actor signatures.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3.5 py-2 bg-navy-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
          >
            <option value="">All Action Types</option>
            {actionTypes.slice(1).map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
          <button
            onClick={fetchLogs}
            className="p-2.5 rounded-xl bg-navy-900 border border-slate-700/80 text-slate-300 hover:text-white"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-navy-950/70 text-slate-400 font-mono uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">Timestamp</th>
                <th className="px-6 py-3.5">Actor</th>
                <th className="px-6 py-3.5">Action Event</th>
                <th className="px-6 py-3.5">Entity</th>
                <th className="px-6 py-3.5">Summary Payload</th>
                <th className="px-6 py-3.5 text-center">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    Loading immutable audit trail...
                  </td>
                </tr>
              ) : logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-navy-850/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{log.user?.name || 'System Engine'}</div>
                      <div className="text-[10px] font-mono text-slate-400">{log.user?.role?.name || 'CORE'}</div>
                    </td>
                    <td className="px-6 py-4 font-mono">
                      <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 text-[10px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-300 text-[11px]">
                      {log.entityType} ({log.entityId.slice(0, 8)}...)
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs truncate max-w-xs font-mono">
                      {log.newValue || log.previousValue || '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 rounded-lg bg-navy-900 border border-slate-700 text-indigo-300 hover:text-white hover:border-indigo-400 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    No audit records matching filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-2xl p-6 rounded-2xl border border-slate-700 space-y-4 bg-navy-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base font-mono flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" /> Audit Event Record: {selectedLog.action}
              </h3>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs p-4 rounded-xl bg-navy-950 border border-slate-800 font-mono">
              <div>
                <span className="text-slate-400">Actor</span>
                <div className="text-white font-bold">{selectedLog.user?.name} ({selectedLog.user?.email})</div>
              </div>
              <div>
                <span className="text-slate-400">Timestamp</span>
                <div className="text-slate-300">{new Date(selectedLog.timestamp).toISOString()}</div>
              </div>
              <div>
                <span className="text-slate-400">Entity Scope</span>
                <div className="text-indigo-300">{selectedLog.entityType} ({selectedLog.entityId})</div>
              </div>
              <div>
                <span className="text-slate-400">Record ID</span>
                <div className="text-slate-400">{selectedLog.id}</div>
              </div>
            </div>

            {selectedLog.previousValue && (
              <div className="space-y-1">
                <div className="text-xs font-semibold text-amber-400 font-mono">Previous State</div>
                <pre className="p-3 rounded-lg bg-navy-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
                  {selectedLog.previousValue}
                </pre>
              </div>
            )}

            {selectedLog.newValue && (
              <div className="space-y-1">
                <div className="text-xs font-semibold text-emerald-400 font-mono">New State</div>
                <pre className="p-3 rounded-lg bg-navy-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
                  {selectedLog.newValue}
                </pre>
              </div>
            )}

            {selectedLog.metadata && (
              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-400 font-mono">Metadata / Context</div>
                <pre className="p-3 rounded-lg bg-navy-950 border border-slate-800 text-[11px] font-mono text-slate-400 overflow-x-auto">
                  {selectedLog.metadata}
                </pre>
              </div>
            )}

            <div className="pt-2 text-right">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs"
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
