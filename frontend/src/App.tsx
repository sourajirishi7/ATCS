import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ThemeProvider } from './context/ThemeContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { Layout } from './components/layout/Layout';

// Direct auth routes for instant startup
import { LoginPage } from './pages/LoginPage';
import { SignUpPage } from './pages/SignUpPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';

// Lazy-loaded application modules for reduced latency & fast module switching
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const SpendPreviewPage = lazy(() => import('./pages/SpendPreviewPage').then(m => ({ default: m.SpendPreviewPage })));
const SpendRequestsPage = lazy(() => import('./pages/SpendRequestsPage').then(m => ({ default: m.SpendRequestsPage })));
const ApprovalsPage = lazy(() => import('./pages/ApprovalsPage').then(m => ({ default: m.ApprovalsPage })));
const BudgetsPage = lazy(() => import('./pages/BudgetsPage').then(m => ({ default: m.BudgetsPage })));
const ClientBudgetPage = lazy(() => import('./pages/ClientBudgetPage').then(m => ({ default: m.ClientBudgetPage })));
const TransactionsPage = lazy(() => import('./pages/TransactionsPage').then(m => ({ default: m.TransactionsPage })));
const CommitmentsPage = lazy(() => import('./pages/CommitmentsPage').then(m => ({ default: m.CommitmentsPage })));
const ForecastsPage = lazy(() => import('./pages/ForecastsPage').then(m => ({ default: m.ForecastsPage })));
const AlertsPage = lazy(() => import('./pages/AlertsPage').then(m => ({ default: m.AlertsPage })));
const AuditPage = lazy(() => import('./pages/AuditPage').then(m => ({ default: m.AuditPage })));
const ExceptionsPage = lazy(() => import('./pages/ExceptionsPage').then(m => ({ default: m.ExceptionsPage })));
const RulesPage = lazy(() => import('./pages/RulesPage').then(m => ({ default: m.RulesPage })));
const SandboxPage = lazy(() => import('./pages/SandboxPage').then(m => ({ default: m.SandboxPage })));

// Sleek loading fallback during on-demand module chunk load
const ModuleLoadingFallback: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
    <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
    <span className="text-xs font-mono font-medium text-slate-500">Accelerating Module...</span>
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs font-mono text-slate-600">
        Loading ATCS Session...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <CurrencyProvider>
          <AuthProvider>
            <SocketProvider>
              <Routes>
                {/* Public Authentication Routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignUpPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />

                {/* Protected Application Routes */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route
                    path="dashboard"
                    element={
                      <Suspense fallback={<ModuleLoadingFallback />}>
                        <DashboardPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="spend/preview"
                    element={
                      <Suspense fallback={<ModuleLoadingFallback />}>
                        <SpendPreviewPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="spend"
                    element={
                      <Suspense fallback={<ModuleLoadingFallback />}>
                        <SpendRequestsPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="approvals"
                    element={
                      <Suspense fallback={<ModuleLoadingFallback />}>
                        <ApprovalsPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="budgets"
                    element={
                      <Suspense fallback={<ModuleLoadingFallback />}>
                        <BudgetsPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="client-budget"
                    element={
                      <Suspense fallback={<ModuleLoadingFallback />}>
                        <ClientBudgetPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="transactions"
                    element={
                      <Suspense fallback={<ModuleLoadingFallback />}>
                        <TransactionsPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="commitments"
                    element={
                      <Suspense fallback={<ModuleLoadingFallback />}>
                        <CommitmentsPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="forecasts"
                    element={
                      <Suspense fallback={<ModuleLoadingFallback />}>
                        <ForecastsPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="alerts"
                    element={
                      <Suspense fallback={<ModuleLoadingFallback />}>
                        <AlertsPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="audit"
                    element={
                      <Suspense fallback={<ModuleLoadingFallback />}>
                        <AuditPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="exceptions"
                    element={
                      <Suspense fallback={<ModuleLoadingFallback />}>
                        <ExceptionsPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="rules"
                    element={
                      <Suspense fallback={<ModuleLoadingFallback />}>
                        <RulesPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="sandbox"
                    element={
                      <Suspense fallback={<ModuleLoadingFallback />}>
                        <SandboxPage />
                      </Suspense>
                    }
                  />
                </Route>

                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </SocketProvider>
          </AuthProvider>
        </CurrencyProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

export default App;
