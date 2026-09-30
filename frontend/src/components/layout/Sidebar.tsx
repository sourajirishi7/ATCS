import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Sparkles,
  FileSpreadsheet,
  CheckCircle2,
  PieChart,
  Receipt,
  Lock,
  TrendingUp,
  AlertTriangle,
  History,
  ShieldAlert,
  Sliders,
  FlaskConical,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Sidebar: React.FC = () => {
  const { user } = useAuth();

  const navSections = [
    {
      title: 'SPEND & DECISION',
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/spend/preview', label: 'Spend Simulator', icon: Sparkles, badge: 'Flagship' },
        { to: '/spend', label: 'Spend Requests', icon: FileSpreadsheet },
        { to: '/approvals', label: 'Approvals Queue', icon: CheckCircle2 },
      ],
    },
    {
      title: 'FINANCIAL CONTROL',
      items: [
        { to: '/budgets', label: 'Budgets & Allocations', icon: PieChart },
        { to: '/transactions', label: 'Transaction Ledger', icon: Receipt },
        { to: '/commitments', label: 'Active Commitments', icon: Lock },
      ],
    },
    {
      title: 'INTELLIGENCE & AUDIT',
      items: [
        { to: '/forecasts', label: 'Python Forecasts', icon: TrendingUp },
        { to: '/alerts', label: 'Real-Time Alerts', icon: AlertTriangle },
        { to: '/audit', label: 'Audit Trail & Snapshots', icon: History },
        { to: '/exceptions', label: 'Exception Overrides', icon: ShieldAlert },
        { to: '/rules', label: 'Governance Rules', icon: Sliders },
      ],
    },
    {
      title: 'SANDBOX DEMO',
      items: [
        { to: '/sandbox', label: 'Mandatory Scenarios', icon: FlaskConical, badge: 'Scenarios A/B/C' },
      ],
    },
  ];

  return (
    <aside className="w-64 border-r border-slate-800/80 bg-navy-900/60 backdrop-blur-md flex flex-col justify-between shrink-0 min-h-[calc(100vh-4rem)]">
      <div className="p-4 space-y-6 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-1">
            <div className="text-[10px] font-mono tracking-wider font-semibold text-slate-400 px-3 uppercase mb-2">
              {section.title}
            </div>
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-navy-800/50'
                    }`
                  }
                >
                  <div className="flex items-center space-x-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer System Info */}
      <div className="p-4 border-t border-slate-800/60 bg-navy-950/40">
        <div className="text-[11px] text-slate-400 font-mono">PostgreSQL Financial Engine</div>
        <div className="text-[10px] text-slate-400 mt-0.5">Authoritative Backend Ledger</div>
      </div>
    </aside>
  );
};
