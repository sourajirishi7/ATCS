import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Budget, Department, Category } from '../types';
import { PieChart, Plus, Wallet, ShieldCheck, Building2, Tag, Layers, CheckCircle2 } from 'lucide-react';

export const BudgetsPage: React.FC = () => {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // New Budget Form State
  const [showModal, setShowModal] = useState(false);
  const [deptId, setDeptId] = useState('');
  const [fiscalPeriod, setFiscalPeriod] = useState('FY2026-Q4');
  const [budgetAmount, setBudgetAmount] = useState<number>(500000);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const fetchBudgets = async () => {
    try {
      const data = await api.get<Budget[]>('/budgets');
      setBudgets(data);
    } catch (err) {
      console.error('Failed to load budgets', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgets();
    api.get<Department[]>('/departments').then((res) => {
      setDepartments(res);
      if (res.length > 0) setDeptId(res[0].id);
    });
    api.get<Category[]>('/categories').then((res) => {
      setCategories(res);
      const initAlloc: Record<string, number> = {};
      res.forEach((c) => (initAlloc[c.id] = 0));
      setAllocations(initAlloc);
    });
  }, []);

  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const allocArray = Object.entries(allocations)
      .filter(([_, amt]) => Number(amt) > 0)
      .map(([catId, amt]) => ({ categoryId: catId, allocatedAmount: Number(amt) }));

    const sumAlloc = allocArray.reduce((acc, a) => acc + a.allocatedAmount, 0);
    if (sumAlloc > Number(budgetAmount)) {
      setFormError(`Sum of category allocations (₹${sumAlloc.toLocaleString()}) cannot exceed total departmental budget (₹${Number(budgetAmount).toLocaleString()}).`);
      return;
    }

    try {
      await api.post('/budgets', {
        departmentId: deptId,
        fiscalPeriod,
        budgetAmount: Number(budgetAmount),
        currency: 'INR',
        allocations: allocArray,
      });
      setShowModal(false);
      fetchBudgets();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create budget.');
    }
  };

  const isFinanceOrAdmin = user?.role === 'FINANCE' || user?.role === 'ADMIN';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <PieChart className="w-6 h-6 text-indigo-400" />
            <span>Budgets & Allocations</span>
          </h1>
          <p className="text-xs text-slate-400">
            Authoritative financial ceilings and category line-item allocations by fiscal period.
          </p>
        </div>

        {isFinanceOrAdmin && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-glow transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Period Budget</span>
          </button>
        )}
      </div>

      {/* Budgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-2 text-center py-12 text-slate-400 text-xs">Loading budgets...</div>
        ) : budgets.length > 0 ? (
          budgets.map((b) => (
            <div
              key={b.id}
              className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-5 hover:border-slate-700 transition-all"
            >
              <div className="flex items-start justify-between pb-3 border-b border-slate-800">
                <div>
                  <div className="flex items-center space-x-2">
                    <Building2 className="w-4 h-4 text-indigo-400" />
                    <span className="font-bold text-white text-base">{b.department?.name}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Period: <span className="font-mono text-indigo-300 font-semibold">{b.fiscalPeriod}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                    {b.status}
                  </span>
                  <div className="text-xl font-black text-white font-mono mt-1">
                    ₹{b.budgetAmount.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Category Allocations */}
              <div className="space-y-3">
                <div className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Category Allocations</span>
                  <span>{b.allocations?.length || 0} Line Items</span>
                </div>

                {b.allocations && b.allocations.length > 0 ? (
                  <div className="space-y-2">
                    {b.allocations.map((alloc) => (
                      <div
                        key={alloc.id}
                        className="p-3 rounded-xl bg-navy-950/60 border border-slate-800/80 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center space-x-2">
                          <Tag className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-slate-200 font-medium">{alloc.category?.name}</span>
                        </div>
                        <span className="font-mono font-bold text-white">
                          ₹{alloc.allocatedAmount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-navy-950/40 text-center text-xs text-slate-400">
                    No specific category allocations (Governed by Department total).
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-2 glass-panel p-12 rounded-2xl border border-slate-800 text-center text-slate-400">
            No budgets configured yet.
          </div>
        )}
      </div>

      {/* Modal: Create Budget */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-xl p-6 rounded-2xl border border-slate-700 space-y-5 bg-navy-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Wallet className="w-5 h-5 text-indigo-400" /> Create Departmental Budget
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateBudget} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Department</label>
                  <select
                    value={deptId}
                    onChange={(e) => setDeptId(e.target.value)}
                    className="w-full px-3 py-2 bg-navy-950 border border-slate-800 rounded-xl text-xs text-white"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Fiscal Period</label>
                  <input
                    type="text"
                    required
                    value={fiscalPeriod}
                    onChange={(e) => setFiscalPeriod(e.target.value)}
                    placeholder="FY2026-Q4"
                    className="w-full px-3 py-2 bg-navy-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Total Budget Amount (INR)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-navy-950 border border-slate-800 rounded-xl text-xs text-white font-mono font-bold"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="block text-xs font-medium text-slate-300">Category Allocations (Optional line-item caps)</label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {categories.map((cat) => (
                    <div key={cat.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-slate-300 truncate">{cat.name}</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={allocations[cat.id] || ''}
                        onChange={(e) => setAllocations({ ...allocations, [cat.id]: Number(e.target.value) })}
                        className="w-32 px-2 py-1 bg-navy-950 border border-slate-800 rounded-lg text-xs font-mono text-white text-right"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-glow"
                >
                  Save Budget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
