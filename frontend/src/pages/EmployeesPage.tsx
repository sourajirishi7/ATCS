import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useCurrency } from '../../context/CurrencyContext';
import { EmployeeSummary } from '../../types';
import {
  Users,
  Search,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  XCircle,
  FileText
} from 'lucide-react';

export const EmployeesPage: React.FC = () => {
  const { formatCurrency } = useCurrency();
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await api.get<EmployeeSummary[]>('/users/employees');
        setEmployees(data);
      } catch (err) {
        console.error('Failed to load employees', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredEmployees = employees.filter(
    emp =>
      emp.name.toLowerCase().includes(search.toLowerCase()) ||
      emp.email.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
      case 'COMMITTED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1 w-max"><CheckCircle2 className="w-3 h-3" /> APPROVED</span>;
      case 'REJECTED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 flex items-center gap-1 w-max"><XCircle className="w-3 h-3" /> REJECTED</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1 w-max"><Clock className="w-3 h-3" /> PENDING</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-7 h-7 text-blue-600" />
            Team & Employees
          </h1>
          <p className="text-xs md:text-sm text-slate-600 max-w-2xl font-medium mt-1">
            Directory of employees within your scope and their spending activities.
          </p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 w-full md:w-64 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-500 text-sm">Loading directory...</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] uppercase tracking-wider font-semibold">
                  <th className="p-4">Employee</th>
                  <th className="p-4">Department</th>
                  <th className="p-4 text-center">Requests</th>
                  <th className="p-4 text-right">Committed Spend</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100">
                {filteredEmployees.map((emp) => (
                  <React.Fragment key={emp.id}>
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-900">{emp.name}</div>
                        <div className="text-xs text-slate-500">{emp.email}</div>
                      </td>
                      <td className="p-4 text-slate-700 text-xs font-medium">{emp.department}</td>
                      <td className="p-4 text-center font-mono text-xs">{emp.totalRequests}</td>
                      <td className="p-4 text-right font-mono font-bold text-blue-600">
                        {formatCurrency(emp.totalCommitted)}
                      </td>
                      <td className="p-4 text-center">
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-green-50 text-green-700 border border-green-200">
                          {emp.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => setExpandedRow(expandedRow === emp.id ? null : emp.id)}
                          className="text-slate-400 hover:text-blue-600 p-1 rounded-md transition-colors"
                        >
                          {expandedRow === emp.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                      </td>
                    </tr>
                    {expandedRow === emp.id && (
                      <tr className="bg-slate-50/50 border-t border-slate-100">
                        <td colSpan={6} className="p-4">
                          <div className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                            Recent Spend Activity
                          </div>
                          {emp.recentActivity.length > 0 ? (
                            <div className="space-y-2">
                              {emp.recentActivity.map((act) => (
                                <div key={act.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                                      <FileText className="w-4 h-4 text-slate-500" />
                                    </div>
                                    <div>
                                      <div className="font-semibold text-slate-900 text-xs">{act.description}</div>
                                      <div className="text-[10px] text-slate-500 font-mono">
                                        {new Date(act.date).toLocaleDateString()}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-1">
                                    <div className="font-mono font-bold text-slate-900">{formatCurrency(act.amount)}</div>
                                    {getStatusBadge(act.status)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500 italic">No recent spend activity.</div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {filteredEmployees.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 text-sm">
                      No employees found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
