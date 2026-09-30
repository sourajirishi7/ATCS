import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useTheme } from '../../context/ThemeContext';
import { RoleType } from '../../types';
import { ShieldCheck, Radio, LogOut, User as UserIcon, RefreshCw, Zap, Sun, Moon } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, quickSwitchRole, logout, loading } = useAuth();
  const { connected } = useSocket();
  const { theme, toggleTheme } = useTheme();

  const rolePills: Array<{ role: RoleType; label: string; badge: string; inactive: string }> = [
    {
      role: 'ADMIN',
      label: 'Admin (Alex)',
      badge: 'Admin',
      inactive: 'border-purple-300 text-purple-800 bg-purple-50 hover:bg-purple-100 dark:border-purple-500/40 dark:text-purple-300 dark:bg-navy-900/60 dark:hover:bg-purple-500/10',
    },
    {
      role: 'FINANCE',
      label: 'Finance (Fiona)',
      badge: 'CFO',
      inactive: 'border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-500/40 dark:text-emerald-300 dark:bg-navy-900/60 dark:hover:bg-emerald-500/10',
    },
    {
      role: 'MANAGER',
      label: 'Manager (Marcus)',
      badge: 'ENG Mgr',
      inactive: 'border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 dark:border-amber-500/40 dark:text-amber-300 dark:bg-navy-900/60 dark:hover:bg-amber-500/10',
    },
    {
      role: 'EMPLOYEE',
      label: 'Employee (Devon)',
      badge: 'Staff Eng',
      inactive: 'border-cyan-300 text-cyan-800 bg-cyan-50 hover:bg-cyan-100 dark:border-cyan-500/40 dark:text-cyan-300 dark:bg-navy-900/60 dark:hover:bg-cyan-500/10',
    },
  ];

  return (
    <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-navy-900/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30 transition-colors shadow-xs">
      {/* Brand & Status */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 p-[1px] shadow-glow flex items-center justify-center">
            <div className="w-full h-full bg-white dark:bg-navy-950 rounded-[7px] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <div>
            <div className="font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>ATCS</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30">
                Core v1.0
              </span>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 tracking-wide font-medium">Audit Trailing & Control System</div>
          </div>
        </div>

        {/* Live Engine Status */}
        <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-xs">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
          <span className="text-slate-600 dark:text-slate-400 font-mono text-[11px]">
            {connected ? 'Socket: Synchronized' : 'Socket: Disconnected'}
          </span>
        </div>
      </div>

      {/* Role Switcher Pill Bar (Demonstration Mode) */}
      <div className="hidden lg:flex items-center space-x-2 bg-slate-100/90 dark:bg-navy-950/80 border border-slate-200 dark:border-slate-800/80 p-1 rounded-xl">
        <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 px-2 flex items-center gap-1">
          <Zap className="w-3 h-3 text-amber-500 dark:text-amber-400" /> Demo Switch:
        </span>
        {rolePills.map((pill) => {
          const isActive = user?.role === pill.role;
          return (
            <button
              key={pill.role}
              onClick={() => quickSwitchRole(pill.role)}
              disabled={loading || isActive}
              className={`text-xs px-2.5 py-1 rounded-lg transition-all duration-150 border font-semibold ${
                isActive
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : pill.inactive
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
          <div className="flex items-center space-x-3 border-l border-slate-200 dark:border-slate-800 pl-4">
            <div className="text-right">
              <div className="text-xs font-semibold text-slate-900 dark:text-white">{user.name}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-end gap-1 font-mono">
                <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{user.role}</span>
                {user.department && <span>• {user.department.code}</span>}
              </div>
            </div>
            <button
              onClick={toggleTheme}
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-slate-700 flex items-center justify-center"
            >
              {theme === 'light' ? (
                <Moon className="w-4 h-4 text-indigo-600" />
              ) : (
                <Sun className="w-4 h-4 text-amber-400" />
              )}
            </button>
            <button
              onClick={logout}
              title="Sign Out"
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-slate-700 flex items-center justify-center"
            >
              <LogOut className="w-4 h-4 text-slate-500 dark:text-slate-300" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
