import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { ForecastData, Department } from '../types';
import {
  TrendingUp,
  Cpu,
  AlertOctagon,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Building,
  Activity,
  Zap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export const ForecastsPage: React.FC = () => {
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<Department[]>('/departments').then((depts) => {
      setDepartments(depts);
      const defaultDept = user?.departmentId || (depts.length > 0 ? depts[0].id : '');
      setSelectedDept(defaultDept);
    });
  }, [user]);

  const loadForecast = async (deptId: string) => {
    if (!deptId) return;
    setLoading(true);
    try {
      const res = await api.get<ForecastData>(`/forecast?departmentId=${deptId}`);
      setForecast(res);
    } catch (err) {
      console.error('Failed to load forecast', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDept) {
      loadForecast(selectedDept);
    }
  }, [selectedDept]);

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'PROJECTED_VIOLATION':
        return {
          bg: 'bg-red-50 text-red-700 border border-red-200',
          title: 'PROJECTED VIOLATION DETECTED',
          desc: 'Current spend velocity will cause an overrun before period end.',
        };
      case 'NEAR_FORECAST_LIMIT':
        return {
          bg: 'bg-red-50 text-red-700 border border-red-200',
          title: 'NEAR ALLOCATION CEILING',
          desc: 'Projected spend reaches >85% of allocated period budget.',
        };
      case 'INSUFFICIENT_DATA':
        return {
          bg: 'bg-slate-50 text-slate-700 border border-slate-200',
          title: 'INSUFFICIENT HISTORICAL DATA',
          desc: 'At least 3 distinct transaction records are required to project statistical trends.',
        };
      default:
        return {
          bg: 'bg-blue-50 text-blue-700 border border-blue-200',
          title: 'WITHIN FORECAST RUNWAY',
          desc: 'Spend trajectory is healthy and within approved budget boundaries.',
        };
    }
  };

  const statusInfo = getStatusBadge(forecast?.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Cpu className="w-6 h-6 text-blue-600" />
            <span>Python Spending Forecast Engine</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Microservice executing Exponential Weighted Moving Average (EWMA) and velocity runway projections.
          </p>
        </div>

        {/* Department Selector */}
        <div className="flex items-center space-x-3">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3.5 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white shadow-2xs focus:border-blue-600"
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>
          <button
            onClick={() => loadForecast(selectedDept)}
            disabled={loading}
            className="p-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-blue-600 border border-slate-200 shadow-sm transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-500 dark:text-slate-400 text-xs">
          Computing statistical projection models...
        </div>
      ) : forecast ? (
        <div className="space-y-6">
          {/* Status Alert Banner */}
          <div className={`p-5 rounded-2xl border ${statusInfo.bg} flex items-start space-x-3`}>
            {forecast.status === 'PROJECTED_VIOLATION' ? (
              <AlertOctagon className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
            ) : forecast.status === 'NEAR_FORECAST_LIMIT' ? (
              <AlertTriangle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-blue-600 mt-0.5" />
            )}
            <div>
              <div className="text-xs font-mono font-bold tracking-wider">{statusInfo.title}</div>
              <p className="text-xs mt-1 text-slate-700 dark:text-slate-300">{forecast.reason}</p>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">Current Velocity</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{formatCurrency(forecast.currentBurnRate)}<span className="text-xs text-slate-500 dark:text-slate-400 font-normal">/day</span></div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">Blended EWMA Daily Burn</div>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">Projected Period Spend</span>
              <div className={`text-2xl font-black mt-1 ${forecast.projectedAmount > forecast.budgetAmount ? 'text-red-600' : 'text-blue-600'}`}>
                {formatCurrency(forecast.projectedAmount)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">Period: {forecast.period}</div>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">Period Budget</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{formatCurrency(forecast.budgetAmount)}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">Approved Ceiling</div>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">Model Confidence</span>
              <div className="text-2xl font-black text-blue-600 mt-1">{forecast.confidence}%</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">R-Squared & Sample Sizing</div>
            </div>
          </div>

          {/* Visual Trend Chart */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-600" /> Historical Velocity & Cumulative Runway
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">Methodology: {forecast.methodology}</p>
              </div>
            </div>

            {forecast.trendData && forecast.trendData.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={forecast.trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="#94a3b8" strokeOpacity={0.2} strokeDasharray="3 3" />
                    <XAxis dataKey="date" stroke="#64748B" fontSize={11} />
                    <YAxis stroke="#64748B" fontSize={11} tickFormatter={(v) => formatCurrency(v, { compact: true })} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: '10px', fontSize: '12px' }}
                      formatter={(val: any) => [formatCurrency(Number(val)), 'Cumulative Spend']}
                    />
                    <Line type="monotone" dataKey="cumulativeSpend" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                Insufficient transaction trend points for chart rendering.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="glass-panel p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center text-slate-500 dark:text-slate-400">
          No forecast data available for selected department.
        </div>
      )}
    </div>
  );
};
