import React from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { ToastProvider } from './context/ToastContext.js';
import { Navbar } from './components/Navbar.js';
import { Sidebar } from './components/Sidebar.js';

import { Login } from './pages/Login.js';
import { Dashboard } from './pages/Dashboard.js';
import { KitsList } from './pages/KitsList.js';
import { KitTraceability } from './pages/KitTraceability.js';
import { ProcessingWorkflow } from './pages/ProcessingWorkflow.js';
import { BatchesList } from './pages/BatchesList.js';
import { QualityControl } from './pages/QualityControl.js';
import { QuarantineList } from './pages/QuarantineList.js';
import { InventoryStock } from './pages/InventoryStock.js';
import { RequestsList } from './pages/RequestsList.js';
import { DispatchManagement } from './pages/DispatchManagement.js';
import { ReceiptsList } from './pages/ReceiptsList.js';
import { AuditTrail } from './pages/AuditTrail.js';
import { Reports } from './pages/Reports.js';
import { UserManagement } from './pages/UserManagement.js';

import { api } from './services/api.js';
import { canAccessTab, TAB_PATHS } from './access.js';

const queryClient = new QueryClient();

const WORKSPACE_ROUTES = [
  { tab: 'dashboard', path: TAB_PATHS.dashboard },
  { tab: 'kits', path: TAB_PATHS.kits },
  { tab: 'traceability', path: `${TAB_PATHS.traceability}/:kitCode` },
  { tab: 'processing', path: TAB_PATHS.processing },
  { tab: 'batches', path: TAB_PATHS.batches },
  { tab: 'qc', path: TAB_PATHS.qc },
  { tab: 'quarantine', path: TAB_PATHS.quarantine },
  { tab: 'inventory', path: TAB_PATHS.inventory },
  { tab: 'requests', path: TAB_PATHS.requests },
  { tab: 'dispatch', path: TAB_PATHS.dispatch },
  { tab: 'receipts', path: TAB_PATHS.receipts },
  { tab: 'audit', path: TAB_PATHS.audit },
  { tab: 'reports', path: TAB_PATHS.reports },
  { tab: 'admin', path: TAB_PATHS.admin },
] as const;

interface ProtectedRouteProps {
  tab: string;
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ tab, children }) => {
  const { user } = useAuth();
  return user && canAccessTab(user.role, tab)
    ? <>{children}</>
    : <Navigate to={TAB_PATHS.dashboard} replace />;
};

const TraceabilityRoute: React.FC = () => {
  const { kitCode = '' } = useParams<{ kitCode: string }>();
  const navigate = useNavigate();
  return <KitTraceability kitCode={kitCode} onBack={() => navigate(TAB_PATHS.kits)} />;
};

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  React.useEffect(() => {
    if (user?.id) navigate(TAB_PATHS.dashboard, { replace: true });
  }, [user?.id]);

  const alertsQuery = useQuery({ queryKey: ['alerts'], queryFn: async () => (await api.getAlerts()).data, enabled: Boolean(user) });
  const qcQuery = useQuery({ queryKey: ['pending-qc'], queryFn: async () => (await api.getPendingQcBatches()).data, enabled: Boolean(user) });
  const quarantineQuery = useQuery({ queryKey: ['quarantine'], queryFn: async () => (await api.getQuarantineRecords()).data, enabled: Boolean(user) });
  const requestsQuery = useQuery({ queryKey: ['requests'], queryFn: async () => (await api.getRequests()).data, enabled: Boolean(user) });
  const alerts = alertsQuery.data ?? [];
  const counts = {
    pendingQc: qcQuery.data?.length ?? 0,
    quarantine: quarantineQuery.data?.filter((q: any) => q.status === 'ACTIVE_QUARANTINE').length ?? 0,
    urgentReq: requestsQuery.data?.filter((r: any) => r.status === 'PENDING' && r.priority === 'URGENT').length ?? 0,
  };

  const handleSelectKitTrace = (kitCode: string) => {
    navigate(`${TAB_PATHS.traceability}/${encodeURIComponent(kitCode)}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-teal-400 flex items-center justify-center font-bold text-lg animate-pulse">
            ST
          </div>
          <span className="text-xs text-slate-400 font-medium">Initializing SteriTrack Secure Session...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const routeElements: Record<string, React.ReactNode> = {
    dashboard: <Dashboard onSelectKitTrace={handleSelectKitTrace} />,
    kits: <KitsList onSelectKitTrace={handleSelectKitTrace} />,
    traceability: <TraceabilityRoute />,
    processing: <ProcessingWorkflow />,
    batches: <BatchesList />,
    qc: <QualityControl />,
    quarantine: <QuarantineList onSelectKitTrace={handleSelectKitTrace} />,
    inventory: <InventoryStock />,
    requests: <RequestsList />,
    dispatch: <DispatchManagement onSelectKitTrace={handleSelectKitTrace} />,
    receipts: <ReceiptsList />,
    audit: <AuditTrail />,
    reports: <Reports />,
    admin: <UserManagement />,
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      <Navbar alerts={alerts} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          pendingQcCount={counts.pendingQc}
          quarantineCount={counts.quarantine}
          urgentReqCount={counts.urgentReq}
        />

        <main className="app-main flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Navigate to={TAB_PATHS.dashboard} replace />} />
            {WORKSPACE_ROUTES.map(({ tab, path }) => (
              <Route
                key={tab}
                path={path}
                element={(
                  <ProtectedRoute tab={tab}>
                    {routeElements[tab]}
                  </ProtectedRoute>
                )}
              />
            ))}
            <Route path="/traceability" element={<Navigate to={TAB_PATHS.kits} replace />} />
            <Route path="*" element={<Navigate to={TAB_PATHS.dashboard} replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
