import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useSocket } from '../context/SocketContext';
import { Alert } from '../types';
import {
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle2,
  RefreshCw,
  Bell,
  Clock,
  Building,
} from 'lucide-react';

export const AlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const { socket } = useSocket();

  const fetchAlerts = async () => {
    try {
      const data = await api.get<Alert[]>('/alerts');
      setAlerts(data);
    } catch (err) {
      console.error('Failed to load alerts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();

    if (socket) {
      socket.on('alert.created', (newAlert: Alert) => {
        setAlerts((prev) => [newAlert, ...prev]);
      });
    }

    return () => {
      if (socket) socket.off('alert.created');
    };
  }, [socket]);

  const handleResolve = async (id: string) => {
    try {
      await api.post(`/alerts/${id}/resolve`);
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'RESOLVED' } : a)));
    } catch (err) {
      console.error('Failed to resolve alert', err);
    }
  };

  const filteredAlerts = alerts.filter((a) => {
    if (severityFilter === 'ALL') return true;
    return a.severity === severityFilter;
  });

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return {
          border: 'border-rose-500/30',
          bg: 'bg-rose-500/5',
          text: 'text-rose-400',
          badge: 'bg-rose-500/10 text-rose-400 border border-rose-500/30',
          icon: AlertOctagon,
        };
      case 'WARNING':
        return {
          border: 'border-amber-500/30',
          bg: 'bg-amber-500/5',
          text: 'text-amber-400',
          badge: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
          icon: AlertTriangle,
        };
      default:
        return {
          border: 'border-indigo-500/30',
          bg: 'bg-indigo-500/5',
          text: 'text-indigo-400',
          badge: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30',
          icon: Info,
        };
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Bell className="w-6 h-6 text-amber-400" />
            <span>Real-Time Alert Center</span>
          </h1>
          <p className="text-xs text-slate-400">
            Automated alerts dispatched on budget threshold breaches, unauthorized overages, or forecast violations.
          </p>
        </div>

        {/* Severity Filter Pills */}
        <div className="flex items-center space-x-2 bg-navy-900 p-1 rounded-xl border border-slate-800">
          {['ALL', 'CRITICAL', 'WARNING', 'INFO'].map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium font-mono transition-all ${
                severityFilter === sev ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-xs">Loading financial alerts...</div>
      ) : filteredAlerts.length > 0 ? (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const style = getSeverityStyle(alert.severity);
            const Icon = style.icon;
            const isResolved = alert.status === 'RESOLVED';

            return (
              <div
                key={alert.id}
                className={`glass-panel p-5 rounded-2xl border ${style.border} ${style.bg} transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
              >
                <div className="flex items-start space-x-3.5">
                  <div className="p-2.5 rounded-xl bg-navy-950 border border-slate-800 shadow-sm shrink-0">
                    <Icon className={`w-5 h-5 ${style.text}`} />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded ${style.badge}`}>
                        {alert.type}
                      </span>
                      {isResolved && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                          RESOLVED
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-white mt-1.5">{alert.message}</div>
                    <div className="flex items-center space-x-3 text-[11px] text-slate-400 font-mono mt-1">
                      <span>Dept: {alert.department?.name}</span>
                      <span>•</span>
                      <span>{new Date(alert.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {!isResolved && (
                  <button
                    onClick={() => handleResolve(alert.id)}
                    className="self-end sm:self-center px-3.5 py-1.5 rounded-xl bg-navy-900 hover:bg-navy-850 text-slate-300 hover:text-white text-xs font-medium border border-slate-700/80 transition-colors"
                  >
                    Acknowledge & Resolve
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center text-slate-400 space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-400/50 mx-auto" />
          <div className="text-sm font-semibold text-white">No Active Alerts</div>
          <p className="text-xs">All departmental metrics are operating within configured policy thresholds.</p>
        </div>
      )}
    </div>
  );
};
