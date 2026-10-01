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
          border: 'border-red-200',
          bg: 'bg-red-50/60',
          text: 'text-red-600',
          badge: 'bg-red-50 text-red-700 border border-red-200',
          icon: AlertOctagon,
        };
      case 'WARNING':
        return {
          border: 'border-slate-300',
          bg: 'bg-slate-50',
          text: 'text-slate-800',
          badge: 'bg-slate-100 text-slate-800 border border-slate-300',
          icon: AlertTriangle,
        };
      default:
        return {
          border: 'border-blue-200',
          bg: 'bg-blue-50/50',
          text: 'text-blue-700',
          badge: 'bg-blue-50 text-blue-700 border border-blue-200',
          icon: Info,
        };
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Bell className="w-6 h-6 text-blue-600" />
            <span>Real-Time Alert Center</span>
          </h1>
          <p className="text-xs text-slate-500">
            Automated alerts dispatched on budget threshold breaches, unauthorized overages, or forecast violations.
          </p>
        </div>

        {/* Severity Filter Pills */}
        <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs">
          {['ALL', 'CRITICAL', 'WARNING', 'INFO'].map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                severityFilter === sev
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 text-xs">Loading financial alerts...</div>
      ) : filteredAlerts.length > 0 ? (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const style = getSeverityStyle(alert.severity);
            const Icon = style.icon;
            const isResolved = alert.status === 'RESOLVED';

            return (
              <div
                key={alert.id}
                className={`p-5 rounded-2xl border ${style.border} ${style.bg} transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm`}
              >
                <div className="flex items-start space-x-3.5">
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-xs shrink-0">
                    <Icon className={`w-5 h-5 ${style.text}`} />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded ${style.badge}`}>
                        {alert.type}
                      </span>
                      {isResolved && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                          RESOLVED
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-slate-900 mt-1.5">{alert.message}</div>
                    <div className="flex items-center space-x-3 text-[11px] text-slate-500 font-mono mt-1">
                      <span>Dept: {alert.department?.name}</span>
                      <span>•</span>
                      <span>{new Date(alert.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {!isResolved && (
                  <button
                    onClick={() => handleResolve(alert.id)}
                    className="self-end sm:self-center px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-medium border border-slate-200 shadow-xs transition-colors"
                  >
                    Acknowledge & Resolve
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-12 rounded-2xl border border-slate-200 bg-white text-center text-slate-500 space-y-2 shadow-sm">
          <CheckCircle2 className="w-10 h-10 text-blue-600 mx-auto" />
          <div className="text-sm font-semibold text-slate-900">No Active Alerts</div>
          <p className="text-xs">All departmental metrics are operating within configured policy thresholds.</p>
        </div>
      )}
    </div>
  );
};
