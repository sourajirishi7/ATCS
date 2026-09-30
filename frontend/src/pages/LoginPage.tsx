import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { RoleType } from '../types';
import { ShieldCheck, ArrowRight, Lock, Mail, Zap, CheckCircle2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login, quickSwitchRole } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (role: RoleType) => {
    setError(null);
    setLoading(true);
    try {
      await quickSwitchRole(role);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate role.');
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    {
      role: 'ADMIN' as RoleType,
      name: 'Alex Vance',
      email: 'admin@atcs.corp',
      title: 'Global System Administrator',
      scope: 'Full Corporate Scope',
      color: 'border-purple-500/30 hover:border-purple-500/60 bg-purple-500/5',
      badge: 'Admin',
    },
    {
      role: 'FINANCE' as RoleType,
      name: 'Fiona Chen',
      email: 'finance@atcs.corp',
      title: 'Chief Financial Officer (CFO)',
      scope: 'Global Budgets & Overrides',
      color: 'border-emerald-500/30 hover:border-emerald-500/60 bg-emerald-500/5',
      badge: 'Finance',
    },
    {
      role: 'MANAGER' as RoleType,
      name: 'Marcus Brody',
      email: 'manager.eng@atcs.corp',
      title: 'Engineering Director',
      scope: 'Engineering Department',
      color: 'border-amber-500/30 hover:border-amber-500/60 bg-amber-500/5',
      badge: 'Manager',
    },
    {
      role: 'EMPLOYEE' as RoleType,
      name: 'Devon Lee',
      email: 'employee.eng@atcs.corp',
      title: 'Senior Staff Engineer',
      scope: 'Engineering Spend Requestor',
      color: 'border-cyan-500/30 hover:border-cyan-500/60 bg-cyan-500/5',
      badge: 'Employee',
    },
  ];

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background radial glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-4xl relative z-10 space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-mono font-medium">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span>ENTERPRISE SPEND GOVERNANCE</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            ATCS Financial Platform
          </h1>
          <p className="text-sm md:text-base text-slate-400 max-w-xl mx-auto">
            Real-time rule evaluation, pre-commitment budget protection, and tamper-proof financial decision snapshots.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Quick Demo Switcher Cards (8 Cols) */}
          <div className="md:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" /> Quick-Login Demo Personas
              </h2>
              <span className="text-xs text-slate-400">Click to enter immediately</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {demoAccounts.map((account) => (
                <button
                  key={account.role}
                  onClick={() => handleQuickLogin(account.role)}
                  disabled={loading}
                  className={`text-left p-4 rounded-xl border transition-all duration-200 ${account.color} group relative overflow-hidden`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                      {account.name}
                    </span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-900/60 border border-slate-700/60 text-slate-300">
                      {account.badge}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mb-2">{account.title}</div>
                  <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800/60">
                    <span>{account.scope}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-navy-900/50 border border-slate-800 text-xs text-slate-400 space-y-1.5">
              <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Financial Separation of States
              </div>
              <p>
                ATCS explicitly distinguishes <strong className="text-white">Proposed</strong> (requested), <strong className="text-white">Committed</strong> (obligated), and <strong className="text-white">Actual</strong> (settled) spend to guarantee budget integrity.
              </p>
            </div>
          </div>

          {/* Standard Login Form (5 Cols) */}
          <div className="md:col-span-5 glass-panel p-6 rounded-2xl border border-slate-800 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-white">Manual Sign In</h2>
              <p className="text-xs text-slate-400">Use registered corporate credentials</p>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@atcs.corp"
                    className="w-full pl-9 pr-4 py-2.5 bg-navy-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-navy-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-colors flex items-center justify-center space-x-2 shadow-glow"
              >
                <span>{loading ? 'Authenticating...' : 'Sign In to ATCS'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
