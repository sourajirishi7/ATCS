import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { RoleType } from '../../types';
import { ShieldCheck, Radio, LogOut, User as UserIcon, RefreshCw, Zap } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, quickSwitchRole, logout, loading } = useAuth();
  const { connected } = useSocket();

  const rolePills: Array<{ role: RoleType; label: string; badge: string; color: string }> = [
    { role: 'ADMIN', label: 'Admin (Alex)', badge: 'Admin', color: 'border-purple-500/40 text-purple-300 hover:bg-purple-500/10' },
    { role: 'FINANCE', label: 'Finance (Fiona)', badge: 'CFO', color: 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10' },
    { role: 'MANAGER', label: 'Manager (Marcus)', badge: 'ENG Mgr', color: 'border-amber-500/40 text-amber-300 hover:bg-amber-500/10' },
    { role: 'EMPLOYEE', label: 'Employee (Devon)', badge: 'Staff Eng', color: 'border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10' },
  ];

  return (
    <header className="h-16 border-b border-slate-800 bg-navy-900/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Brand & Status */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 p-[1px] shadow-glow flex items-center justify-center">
            <div className="w-full h-full bg-navy-950 rounded-[7px] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div>
            <div className="font-bold tracking-tight text-white flex items-center gap-1.5">
              <span>ATCS</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Core v1.0
              </span>
            </div>
            <div className="text-[10px] text-slate-400 tracking-wide font-medium">Audit Trailing & Control System</div>
          </div>
        </div>

        {/* Live Engine Status */}
        <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-navy-950 border border-slate-800 text-xs">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
          <span className="text-slate-400 font-mono text-[11px]">
            {connected ? 'Socket: Synchronized' : 'Socket: Disconnected'}
          </span>
        </div>
      </div>

      {/* Role Switcher Pill Bar (Demonstration Mode) */}
      <div className="hidden lg:flex items-center space-x-2 bg-navy-950/80 border border-slate-800/80 p-1 rounded-xl">
        <span className="text-[11px] font-medium text-slate-400 px-2 flex items-center gap-1">
          <Zap className="w-3 h-3 text-amber-400" /> Demo Switch:
        </span>
        {rolePills.map((pill) => {
          const isActive = user?.role === pill.role;
          return (
            <button
              key={pill.role}
              onClick={() => quickSwitchRole(pill.role)}
              disabled={loading || isActive}
              className={`text-xs px-2.5 py-1 rounded-lg transition-all duration-150 border font-medium ${
                isActive
                  ? 'bg-indigo-600/30 border-indigo-400 text-white shadow-sm'
                  : `${pill.color} bg-navy-900/50`
              }`}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      {/* User Info & Actions */}
      <div className="flex items-center space-x-4">
        {user && (
          <div className="flex items-center space-x-3 border-l border-slate-800 pl-4">
            <div className="text-right">
              <div className="text-xs font-semibold text-white">{user.name}</div>
              <div className="text-[11px] text-slate-400 flex items-center justify-end gap-1 font-mono">
                <span className="text-indigo-400 font-semibold">{user.role}</span>
                {user.department && <span>• {user.department.code}</span>}
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              className="p-2 rounded-lg bg-navy-800 hover:bg-navy-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
            >
              <LogOut className="w-4 h-4 text-slate-300" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
