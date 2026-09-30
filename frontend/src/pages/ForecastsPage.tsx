import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
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
          bg: 'bg-rose-500/10 text-rose-400 border border-rose-500/30',
          title: 'PROJECTED VIOLATION DETECTED',
          desc: 'Current spend velocity will cause an overrun before period end.',
        };
      case 'NEAR_FORECAST_LIMIT':
        return {
          bg: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
          title: 'NEAR ALLOCATION CEILING',
          desc: 'Projected spend reaches >85% of allocated period budget.',
        };
      case 'INSUFFICIENT_DATA':
        return {
          bg: 'bg-slate-500/10 text-slate-400 border border-slate-500/30',
          title: 'INSUFFICIENT HISTORICAL DATA',
          desc: 'At least 3 distinct transaction records are required to project statistical trends.',
        };
      default:
        return {
          bg: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
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
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Cpu className="w-6 h-6 text-indigo-400" />
            <span>Python Spending Forecast Engine</span>
          </h1>
          <p className="text-xs text-slate-400">
            Microservice executing Exponential Weighted Moving Average (EWMA) and velocity runway projections.
          </p>
        </div>

        {/* Department Selector */}
        <div className="flex items-center space-x-3">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3.5 py-2 bg-navy-900 border border-slate-700 rounded-xl text-xs text-white"
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
            className="p-2.5 rounded-xl bg-navy-900 border border-slate-700/80 text-slate-300 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400 text-xs">
          Computing statistical projection models...
        </div>
      ) : forecast ? (
        <div className="space-y-6">
          {/* Status Alert Banner */}
          <div className={`p-5 rounded-2xl border ${statusInfo.bg} flex items-start space-x-3`}>
            {forecast.status === 'PROJECTED_VIOLATION' ? (
              <AlertOctagon className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            ) : forecast.status === 'NEAR_FORECAST_LIMIT' ? (
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
            )}
            <div>
              <div className="text-xs font-mono font-bold tracking-wider">{statusInfo.title}</div>
              <p className="text-xs mt-1 text-slate-300">{forecast.reason}</p>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="glass-panel p-5 rounded-2xl border border-slate-800">
              <span className="text-[10px] font-mono uppercase text-slate-400">Current Velocity</span>
              <div className="text-2xl font-black text-white mt-1">₹{forecast.currentBurnRate.toLocaleString()}<span className="text-xs text-slate-400 font-normal">/day</span></div>
              <div className="text-[11px] text-slate-400 mt-0.5 font-mono">Blended EWMA Daily Burn</div>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-slate-800">
              <span className="text-[10px] font-mono uppercase text-slate-400">Projected Period Spend</span>
              <div className={`text-2xl font-black mt-1 ${forecast.projectedAmount > forecast.budgetAmount ? 'text-rose-400' : 'text-indigo-300'}`}>
                ₹{forecast.projectedAmount.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5 font-mono">Period: {forecast.period}</div>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-slate-800">
              <span className="text-[10px] font-mono uppercase text-slate-400">Period Budget</span>
              <div className="text-2xl font-black text-white mt-1">₹{forecast.budgetAmount.toLocaleString()}</div>
              <div className="text-[11px] text-slate-400 mt-0.5 font-mono">Approved Ceiling</div>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-slate-800">
              <span className="text-[10px] font-mono uppercase text-slate-400">Model Confidence</span>
              <div className="text-2xl font-black text-cyan-400 mt-1">{forecast.confidence}%</div>
              <div className="text-[11px] text-slate-400 mt-0.5 font-mono">R-Squared & Sample Sizing</div>
            </div>
          </div>

          {/* Visual Trend Chart */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" /> Historical Velocity & Cumulative Runway
                </h3>
                <p className="text-xs text-slate-400 font-mono">Methodology: {forecast.methodology}</p>
              </div>
            </div>

            {forecast.trendData && forecast.trendData.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={forecast.trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" />
                    <XAxis dataKey="date" stroke="#64748B" fontSize={11} />
                    <YAxis stroke="#64748B" fontSize={11} tickFormatter={(v) => `₹${v / 1000}k`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0B1120', borderColor: '#334155', borderRadius: '10px', fontSize: '12px' }}
                      formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, 'Cumulative Spend']}
                    />
                    <Line type="monotone" dataKey="cumulativeSpend" stroke="#06B6D4" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-xs text-slate-400">
                Insufficient transaction trend points for chart rendering.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center text-slate-400">
          No forecast data available for selected department.
        </div>
      )}
    </div>
  );
};
