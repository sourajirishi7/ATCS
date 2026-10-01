import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, LogOut } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setDropdownOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setDropdownOpen(false);
    }, 200);
  };

  // Get user initials for avatar
  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 border-b border-slate-200 bg-white/95 backdrop-blur-md px-6 flex items-center justify-between z-30 transition-colors shadow-xs">
      {/* Brand & Title */}
      <div className="flex items-center space-x-5">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm shrink-0">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold tracking-tight text-slate-900 flex items-center gap-1.5 leading-tight">
              <span>ATCS</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                Core v1.0
              </span>
            </div>
            <div className="text-[10px] text-slate-500 tracking-wide font-medium">Audit Trailing & Control System</div>
          </div>
        </div>
      </div>

      {/* Right-most Section: Profile Icon Only with Hover Dropdown */}
      {user && (
        <div
          className="relative py-2"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* User Icon Avatar Only */}
          <button
            type="button"
            className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs tracking-wider flex items-center justify-center shadow-sm border-2 border-white ring-2 ring-slate-200 transition-all focus:outline-none"
            aria-label="User profile and session options"
          >
            {getInitials(user.name)}
          </button>

          {/* Hover Dropdown Menu */}
          {dropdownOpen && (
            <div
              className="absolute right-0 top-full mt-1 w-64 rounded-2xl bg-white border border-slate-200 shadow-xl p-3 z-50 animate-in fade-in slide-in-from-top-1 duration-150 space-y-3"
            >
              {/* User Identity Info */}
              <div className="px-2 py-1.5">
                <div className="text-sm font-bold text-slate-900 leading-tight">{user.name}</div>
                <div className="text-xs text-slate-500 truncate mt-0.5 font-mono">{user.email}</div>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    {user.role}
                  </span>
                  {user.department && (
                    <span className="text-[10px] text-slate-600 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                      {user.department.code}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Divider */}
              <div className="border-t border-slate-100 pt-1">
                <button
                  type="button"
                  onClick={logout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors text-left"
                >
                  <LogOut className="w-4 h-4 text-red-600" />
                  <span>Sign Out of Platform</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
