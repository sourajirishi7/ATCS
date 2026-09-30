import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Transaction } from '../types';
import {
  Receipt,
  UploadCloud,
  FileCheck,
  AlertOctagon,
  RotateCcw,
  RefreshCw,
  Plus,
  CheckCircle2,
  FileText,
} from 'lucide-react';

export const TransactionsPage: React.FC = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ledger' | 'import'>('ledger');

  // CSV Import State
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  // Reversal Modal State
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [reversalReason, setReversalReason] = useState('');

  const fetchTransactions = async () => {
    try {
      const data = await api.get<{ transactions: Transaction[]; total: number }>('/transactions');
      setTransactions(data.transactions);
    } catch (err) {
      console.error('Failed to load transactions', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setImportMessage(null);

      // Upload for preview validation
      const formData = new FormData();
      formData.append('file', selectedFile);

      setImporting(true);
      try {
        const previewResult = await api.post<any>('/transactions/import-preview', formData);
        setPreview(previewResult);
      } catch (err: any) {
        setImportMessage(err.message || 'CSV validation failed.');
      } finally {
        setImporting(false);
      }
    }
  };

  const handleCommitImport = async () => {
    if (!preview || !preview.validRows || preview.validRows.length === 0) return;
    setImporting(true);
    try {
      const res = await api.post<any>('/transactions/import-commit', {
        validRows: preview.validRows,
      });
      setImportMessage(`Successfully imported ${res.importedCount} transactions!`);
      setPreview(null);
      setFile(null);
      fetchTransactions();
      setTimeout(() => setActiveTab('ledger'), 1500);
    } catch (err: any) {
      setImportMessage(err.message || 'Import commit failed.');
    } finally {
      setImporting(false);
    }
  };

  const handleReverseTransaction = async () => {
    if (!reversingId || !reversalReason) return;
    try {
      await api.post(`/transactions/${reversingId}/reverse`, { reason: reversalReason });
      setReversingId(null);
      setReversalReason('');
      fetchTransactions();
    } catch (err: any) {
      alert(err.message || 'Reversal failed');
    }
  };

  const isFinanceOrAdmin = user?.role === 'FINANCE' || user?.role === 'ADMIN';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Receipt className="w-6 h-6 text-cyan-400" />
            <span>Actual Transaction Ledger</span>
          </h1>
          <p className="text-xs text-slate-400">
            Authoritative settlements reconciled with commitments. Transactions are never silently deleted.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center space-x-2 bg-navy-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('ledger')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'ledger' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Settled Ledger
          </button>
          {isFinanceOrAdmin && (
            <button
              onClick={() => setActiveTab('import')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'import' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>CSV Ingestion</span>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'ledger' ? (
        /* Transactions Ledger Table */
        <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-navy-950/70 text-slate-400 font-mono uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Reference #</th>
                  <th className="px-6 py-3.5">Vendor</th>
                  <th className="px-6 py-3.5">Employee & Dept</th>
                  <th className="px-6 py-3.5">Category</th>
                  <th className="px-6 py-3.5 text-right">Amount</th>
                  <th className="px-6 py-3.5 text-center">Status</th>
                  <th className="px-6 py-3.5">Date</th>
                  {isFinanceOrAdmin && <th className="px-6 py-3.5 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-400">
                      Loading transaction records...
                    </td>
                  </tr>
                ) : transactions.length > 0 ? (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-navy-850/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-semibold text-white">{tx.referenceNumber}</td>
                      <td className="px-6 py-4 text-slate-200">{tx.vendor}</td>
                      <td className="px-6 py-4 text-slate-300">
                        <div>{tx.employee?.name}</div>
                        <div className="text-[11px] font-mono text-slate-400">{tx.department?.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded bg-navy-950 border border-slate-800 text-[11px] font-mono text-slate-300">
                          {tx.category?.name}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-sm text-cyan-400">
                        ₹{tx.amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                            tx.status === 'REVERSED'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400 font-mono text-[11px]">
                        {new Date(tx.transactionDate).toLocaleDateString()}
                      </td>
                      {isFinanceOrAdmin && (
                        <td className="px-6 py-4 text-center">
                          {tx.status !== 'REVERSED' && (
                            <button
                              onClick={() => setReversingId(tx.id)}
                              className="px-2 py-1 rounded bg-navy-900 border border-slate-700/80 text-rose-300 hover:text-white hover:border-rose-500 transition-colors text-[11px] font-mono inline-flex items-center gap-1"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Reverse</span>
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                      No settled transactions recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CSV Ingestion Engine */
        <div className="space-y-6">
          <div className="glass-panel p-8 rounded-2xl border border-dashed border-slate-700 text-center space-y-4">
            <UploadCloud className="w-12 h-12 text-indigo-400 mx-auto" />
            <div>
              <h3 className="text-base font-bold text-white">Upload Bank or Vendor Transaction CSV</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                Required Columns: <code>employeeEmail, departmentCode, categoryCode, amount, currency, transactionDate, vendor, referenceNumber</code>
              </p>
            </div>

            <label className="inline-block cursor-pointer px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-glow transition-all">
              <span>Select CSV File</span>
              <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
            </label>
            {file && <div className="text-xs font-mono text-indigo-300">Selected: {file.name}</div>}
          </div>

          {importMessage && (
            <div className="p-4 rounded-xl bg-navy-900 border border-indigo-500/30 text-indigo-300 text-xs font-medium">
              {importMessage}
            </div>
          )}

          {/* Validation Preview Card */}
          {preview && (
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white font-mono uppercase">
                  CSV Ingestion Pre-flight Summary
                </h3>
                <span className="text-xs text-slate-400">Row-level Audit Verification</span>
              </div>

              {/* Stats Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-navy-950 border border-slate-800 text-center">
                  <div className="text-xs text-slate-400 font-mono">Total Rows</div>
                  <div className="text-2xl font-black text-white mt-1">{preview.totalRows}</div>
                </div>
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                  <div className="text-xs text-emerald-400 font-mono">Valid & Ready</div>
                  <div className="text-2xl font-black text-emerald-400 mt-1">{preview.validCount}</div>
                </div>
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-center">
                  <div className="text-xs text-rose-400 font-mono">Schema/Lookup Errors</div>
                  <div className="text-2xl font-black text-rose-400 mt-1">{preview.invalidCount}</div>
                </div>
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center">
                  <div className="text-xs text-amber-400 font-mono">Duplicates Blocked</div>
                  <div className="text-2xl font-black text-amber-400 mt-1">{preview.duplicateCount}</div>
                </div>
              </div>

              {/* Errors List */}
              {preview.errors && preview.errors.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
                    <AlertOctagon className="w-4 h-4" /> Row-Level Validation Errors ({preview.errors.length})
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                    {preview.errors.map((err: any, i: number) => (
                      <div key={i} className="p-2.5 rounded-lg bg-navy-950 border border-rose-500/20 text-xs text-slate-300 flex items-center justify-between">
                        <span className="font-mono text-rose-400 font-bold">Row #{err.rowNumber}</span>
                        <span className="text-slate-400 font-mono text-[11px]">{err.field}</span>
                        <span>{err.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Commit Button */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs hover:text-white"
                >
                  Discard Batch
                </button>
                <button
                  type="button"
                  onClick={handleCommitImport}
                  disabled={importing || preview.validCount === 0}
                  className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-glow-emerald disabled:opacity-50"
                >
                  {importing ? 'Committing Ingestion...' : `Confirm & Commit (${preview.validCount} Rows)`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transaction Reversal Reason Modal */}
      {reversingId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-slate-700 space-y-4 bg-navy-900">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-rose-400" /> Confirm Transaction Reversal
            </h3>
            <p className="text-xs text-slate-300">
              Financial transactions cannot be deleted. Reversals create an immutable negative adjustment in the audit log and restore commitment balances.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Mandatory Reversal Justification</label>
              <textarea
                rows={3}
                required
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="State reason for transaction cancellation or refund..."
                className="w-full px-3 py-2 bg-navy-950 border border-slate-800 rounded-xl text-xs text-white"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setReversingId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleReverseTransaction}
                disabled={!reversalReason}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-glow-rose disabled:opacity-50"
              >
                Execute Reversal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
