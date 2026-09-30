import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { Layout } from './components/layout/Layout';

// Pages
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { SpendPreviewPage } from './pages/SpendPreviewPage';
import { SpendRequestsPage } from './pages/SpendRequestsPage';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { BudgetsPage } from './pages/BudgetsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { CommitmentsPage } from './pages/CommitmentsPage';
import { ForecastsPage } from './pages/ForecastsPage';
import { AlertsPage } from './pages/AlertsPage';
import { AuditPage } from './pages/AuditPage';
import { ExceptionsPage } from './pages/ExceptionsPage';
import { RulesPage } from './pages/RulesPage';
import { SandboxPage } from './pages/SandboxPage';
import { ClientBudgetPage } from './pages/ClientBudgetPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center text-xs font-mono text-slate-400">
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
      <AuthProvider>
        <SocketProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="spend/preview" element={<SpendPreviewPage />} />
              <Route path="spend" element={<SpendRequestsPage />} />
              <Route path="approvals" element={<ApprovalsPage />} />
              <Route path="budgets" element={<BudgetsPage />} />
              <Route path="client-budget" element={<ClientBudgetPage />} />
              <Route path="transactions" element={<TransactionsPage />} />
              <Route path="commitments" element={<CommitmentsPage />} />
              <Route path="forecasts" element={<ForecastsPage />} />
              <Route path="alerts" element={<AlertsPage />} />
              <Route path="audit" element={<AuditPage />} />
              <Route path="exceptions" element={<ExceptionsPage />} />
              <Route path="rules" element={<RulesPage />} />
              <Route path="sandbox" element={<SandboxPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
