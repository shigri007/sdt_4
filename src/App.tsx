
import React, { useState, useEffect } from 'react';
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
import { SystemAlert } from './types/index.js';
import { canAccessTab } from './access.js';

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedTraceKitCode, setSelectedTraceKitCode] = useState<string>('');
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [counts, setCounts] = useState<{ pendingQc: number; quarantine: number; urgentReq: number }>({
    pendingQc: 0,
    quarantine: 0,
    urgentReq: 0,
  });

  useEffect(() => {
    if (user) {
      loadSystemCounters();
    }
  }, [user, activeTab]);

  useEffect(() => { setActiveTab('dashboard'); }, [user?.id]);

  async function loadSystemCounters() {
    try {
      const [alertsRes, qcRes, quarRes, reqRes] = await Promise.all([
        api.getAlerts().catch(() => ({ success: false, data: [] })),
        api.getPendingQcBatches().catch(() => ({ success: false, data: [] })),
        api.getQuarantineRecords().catch(() => ({ success: false, data: [] })),
        api.getRequests().catch(() => ({ success: false, data: [] })),
      ]);

      if (alertsRes.success) setAlerts(alertsRes.data);

      const pendingQc = qcRes.success ? qcRes.data.length : 0;
      const quarantine = quarRes.success ? quarRes.data.filter((q: any) => q.status === 'ACTIVE_QUARANTINE').length : 0;
      const urgentReq = reqRes.success ? reqRes.data.filter((r: any) => r.status === 'PENDING' && r.priority === 'URGENT').length : 0;

      setCounts({ pendingQc, quarantine, urgentReq });
    } catch (err) {
      console.error(err);
    }
  }

  const navigate = (tab: string) => {
    if (user && canAccessTab(user.role, tab)) setActiveTab(tab);
  };

  const handleSelectKitTrace = (kitCode: string) => {
    if (!user || !canAccessTab(user.role, 'traceability')) return;
    setSelectedTraceKitCode(kitCode);
    setActiveTab('traceability');
  };

  const visibleTab = user && canAccessTab(user.role, activeTab) ? activeTab : 'dashboard';

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

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      <Navbar
        alerts={alerts}
        activeTab={visibleTab}
        setActiveTab={navigate}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          activeTab={visibleTab}
          setActiveTab={navigate}
          pendingQcCount={counts.pendingQc}
          quarantineCount={counts.quarantine}
          urgentReqCount={counts.urgentReq}
        />

        <main className="app-main flex-1 overflow-y-auto">
          {visibleTab === 'dashboard' && (
            <Dashboard
              setActiveTab={navigate}
              onSelectKitTrace={handleSelectKitTrace}
            />
          )}

          {visibleTab === 'kits' && (
            <KitsList onSelectKitTrace={handleSelectKitTrace} />
          )}

          {visibleTab === 'traceability' && (selectedTraceKitCode ? (
            <KitTraceability kitCode={selectedTraceKitCode} onBack={() => navigate('kits')} />
          ) : <KitsList onSelectKitTrace={handleSelectKitTrace} />)}

          {visibleTab === 'processing' && <ProcessingWorkflow />}

          {visibleTab === 'batches' && <BatchesList />}

          {visibleTab === 'qc' && <QualityControl />}

          {visibleTab === 'quarantine' && (
            <QuarantineList onSelectKitTrace={handleSelectKitTrace} />
          )}

          {visibleTab === 'inventory' && <InventoryStock />}

          {visibleTab === 'requests' && <RequestsList />}

          {visibleTab === 'dispatch' && (
            <DispatchManagement onSelectKitTrace={handleSelectKitTrace} />
          )}

          {visibleTab === 'receipts' && <ReceiptsList />}

          {visibleTab === 'audit' && <AuditTrail />}

          {visibleTab === 'reports' && <Reports />}

          {visibleTab === 'admin' && user.role === 'ADMINISTRATOR' && <UserManagement />}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}
