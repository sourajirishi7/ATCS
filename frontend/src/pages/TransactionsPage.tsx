import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
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
  const { formatCurrency } = useCurrency();
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
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Receipt className="w-6 h-6 text-blue-600" />
            <span>Actual Transaction Ledger</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Authoritative settlements reconciled with commitments. Transactions are never silently deleted.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-navy-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
          <button
            onClick={() => setActiveTab('ledger')}
            className={`px-3.5 py-1.5 rounded-md text-xs transition-all ${
              activeTab === 'ledger'
                ? 'bg-blue-600 text-white shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-medium'
            }`}
          >
            Settled Ledger
          </button>
          {isFinanceOrAdmin && (
            <button
              onClick={() => setActiveTab('import')}
              className={`px-3.5 py-1.5 rounded-md text-xs transition-all flex items-center gap-1.5 ${
                activeTab === 'import'
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-medium'
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
        <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-navy-950/70 text-slate-600 dark:text-slate-400 font-mono uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
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
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                      Loading transaction records...
                    </td>
                  </tr>
                ) : transactions.length > 0 ? (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/80 dark:hover:bg-navy-850/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-semibold text-slate-900 dark:text-white">{tx.referenceNumber}</td>
                      <td className="px-6 py-4 text-slate-900 dark:text-slate-200">{tx.vendor}</td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                        <div>{tx.employee?.name}</div>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{tx.department?.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 dark:bg-navy-950 dark:border-slate-800 dark:text-slate-300 text-[11px] font-mono font-medium">
                          {tx.category?.name}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-sm text-slate-900 dark:text-white">
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                            tx.status === 'REVERSED'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        {new Date(tx.transactionDate).toLocaleDateString()}
                      </td>
                      {isFinanceOrAdmin && (
                        <td className="px-6 py-4 text-center">
                          {tx.status !== 'REVERSED' && (
                            <button
                              onClick={() => setReversingId(tx.id)}
                              className="px-2.5 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors text-[11px] font-mono inline-flex items-center gap-1 font-medium"
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
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
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
          <div className="glass-panel p-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-navy-900/60 text-center space-y-4">
            <UploadCloud className="w-12 h-12 text-blue-600 mx-auto" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Upload Bank or Vendor Transaction CSV</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                Required Columns: <code>employeeEmail, departmentCode, categoryCode, amount, currency, transactionDate, vendor, referenceNumber</code>
              </p>
            </div>

            <label className="inline-block cursor-pointer px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all">
              <span>Select CSV File</span>
              <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
            </label>
            {file && <div className="text-xs font-mono text-blue-600 font-semibold">Selected: {file.name}</div>}
          </div>

          {importMessage && (
            <div className="p-4 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium">
              {importMessage}
            </div>
          )}

          {/* Validation Preview Card */}
          {preview && (
            <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-mono uppercase">
                  CSV Ingestion Pre-flight Summary
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">Row-level Audit Verification</span>
              </div>

              {/* Stats Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-center">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">Total Rows</div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{preview.totalRows}</div>
                </div>
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-center">
                  <div className="text-xs text-blue-700 font-mono font-semibold">Valid & Ready</div>
                  <div className="text-2xl font-black text-blue-600 mt-1">{preview.validCount}</div>
                </div>
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-center">
                  <div className="text-xs text-red-700 font-mono font-semibold">Schema/Lookup Errors</div>
                  <div className="text-2xl font-black text-red-600 mt-1">{preview.invalidCount}</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-center">
                  <div className="text-xs text-slate-600 dark:text-slate-400 font-mono">Duplicates Blocked</div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{preview.duplicateCount}</div>
                </div>
              </div>

              {/* Errors List */}
              {preview.errors && preview.errors.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
                    <AlertOctagon className="w-4 h-4" /> Row-Level Validation Errors ({preview.errors.length})
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                    {preview.errors.map((err: any, i: number) => (
                      <div key={i} className="p-2.5 rounded-lg bg-slate-50 dark:bg-navy-950 border border-red-200 text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between">
                        <span className="font-mono text-red-600 font-bold">Row #{err.rowNumber}</span>
                        <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">{err.field}</span>
                        <span>{err.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Commit Button */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:border-transparent dark:text-slate-300 dark:hover:text-white text-xs font-medium transition-colors"
                >
                  Discard Batch
                </button>
                <button
                  type="button"
                  onClick={handleCommitImport}
                  disabled={importing || preview.validCount === 0}
                  className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50 transition-all"
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4 bg-white dark:bg-navy-900 shadow-2xl">
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-red-600" /> Confirm Transaction Reversal
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Financial transactions cannot be deleted. Reversals create an immutable negative adjustment in the audit log and restore commitment balances.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Mandatory Reversal Justification</label>
              <textarea
                rows={3}
                required
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="State reason for transaction cancellation or refund..."
                className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setReversingId(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:border-transparent dark:text-slate-300 dark:hover:text-white text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReverseTransaction}
                disabled={!reversalReason}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50 transition-all"
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
