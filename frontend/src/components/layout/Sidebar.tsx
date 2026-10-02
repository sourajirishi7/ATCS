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
  Briefcase,
  Users,
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
        ...(user?.role === 'MANAGER' || user?.role === 'ADMIN'
          ? [{ to: '/employees', label: 'Team & Employees', icon: Users }]
          : []),
      ],
    },
    {
      title: 'FINANCIAL CONTROL',
      items: [
        { to: '/budgets', label: 'Budgets & Allocations', icon: PieChart },
        { to: '/client-budget', label: 'Client Quotation & Budget', icon: Briefcase, badge: 'New' },
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
    <aside className="fixed top-16 left-0 bottom-0 w-64 border-r border-slate-200 bg-white flex flex-col justify-between shrink-0 z-20 overflow-y-auto">
      <div className="p-4 space-y-6 flex-1">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-1">
            <div className="text-[10px] font-mono tracking-wider font-semibold text-slate-500 px-3 uppercase mb-2">
              {section.title}
            </div>
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all duration-150 border ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 border-blue-200 font-bold shadow-xs'
                        : 'border-transparent text-slate-700 hover:text-slate-900 hover:bg-slate-100 font-medium'
                    }`
                  }
                >
                  <div className="flex items-center space-x-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold border bg-blue-50 text-blue-700 border-blue-200">
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
      <div className="p-4 border-t border-slate-200 bg-slate-50">
        <div className="text-[11px] text-slate-600 font-mono font-medium">PostgreSQL Financial Engine</div>
        <div className="text-[10px] text-slate-500 mt-0.5">Authoritative Backend Ledger</div>
      </div>
    </aside>
  );
};
