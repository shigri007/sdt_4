// ==========================================================
// SteriTrack: Role-Adaptive Central Dashboard
// Derives live data from database with zero hardcoding
// ==========================================================

import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { StatCard } from '../components/StatCard.js';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge.js';
import {
  Boxes,
  CheckCircle2,
  Layers,
  ShieldAlert,
  ClipboardList,
  AlertTriangle,
  Flame,
  ArrowRight,
  Truck,
  Activity,
  GitBranch,
} from 'lucide-react';

interface DashboardProps {
  setActiveTab: (tab: string) => void;
  onSelectKitTrace?: (kitCode: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ setActiveTab, onSelectKitTrace }) => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, [user]);

  async function loadDashboard() {
    try {
      setIsLoading(true);
      const res = await api.getDashboard();
      if (res.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading || !data) {
    return (
      <div className="p-8 space-y-4 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-slate-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const { overview, operatorQueues, departmentOverview, alerts, recentAudit, charts } = data;

  if (String(user?.role) !== 'QUALITY_COORDINATOR') {
    const roleView = user?.role === 'ADMINISTRATOR'
      ? { title: 'Administration overview', description: 'Manage accounts and review system activity.', cards: [['Registered kits', overview.totalKits], ['Open requisitions', overview.openRequests], ['Quarantined kits', overview.quarantinedKits]], actions: [['Manage users', 'admin'], ['Audit trail', 'audit'], ['Compliance reports', 'reports']] }
      : user?.role === 'REPROCESSING_OPERATOR'
      ? { title: 'Reprocessing workbench', description: 'Move returned kits through decontamination and sterilization.', cards: [['Returned kits', operatorQueues.queueReturned], ['At cleaning', operatorQueues.queueCleaning], ['At inspection', operatorQueues.queueInspection], ['Active batches', operatorQueues.activeBatches]], actions: [['Open decon workflow', 'processing'], ['Autoclave batches', 'batches'], ['Quarantine vault', 'quarantine']] }
      : { title: 'Department workbench', description: 'Request, receive, and return kits for your department.', cards: [['Open requests', departmentOverview.deptOpenRequests], ['Urgent requests', departmentOverview.deptUrgentRequests], ['In transit', departmentOverview.deptInTransit], ['Active kits', departmentOverview.deptActiveKits]], actions: [['Create requisition', 'requests'], ['Confirm receipts', 'receipts'], ['Stock availability', 'inventory']] };
    return <div className="mx-auto max-w-7xl space-y-7 p-6">
      <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">SteriTrack workspace</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{roleView.title}</h1><p className="mt-2 text-sm text-slate-500">{roleView.description}</p></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{roleView.cards.map(([label,value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><span className="text-sm text-slate-500">{label}</span><p className="mt-3 text-3xl font-bold text-slate-900">{value}</p></div>)}</div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-slate-900">Your tasks</h2><div className="mt-4 grid gap-3 md:grid-cols-3">{roleView.actions.map(([label,tab]) => <button key={tab} onClick={() => setActiveTab(String(tab))} className="group flex items-center justify-between rounded-xl border border-teal-100 bg-teal-50 px-4 py-4 text-left text-sm font-semibold text-teal-900 transition hover:-translate-y-0.5 hover:bg-teal-100 hover:shadow-sm">{label}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></button>)}</div></div>
    </div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header & Context */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Hospital Reprocessing Overview
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time instrument kit availability, autoclave sterilization cycles, and clinical dispatch telemetry.
          </p>
        </div>

        {/* Quick Action Shortcuts */}
        <div className="flex items-center gap-2">
          {user?.role === 'DEPARTMENT_STAFF' && (
            <button
              onClick={() => setActiveTab('requests')}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
            >
              + Create Kit Requisition
            </button>
          )}

          {user?.role === 'REPROCESSING_OPERATOR' && (
            <button
              onClick={() => setActiveTab('processing')}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
            >
              Open Decon Stations
            </button>
          )}

          {user?.role === 'QUALITY_COORDINATOR' && (
            <button
              onClick={() => setActiveTab('qc')}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
            >
              Review Batches ({overview.batchesAwaitingQc})
            </button>
          )}

          <button
            onClick={() => setActiveTab('kits')}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
            title="Browse kit histories"
          >
            <GitBranch className="w-3.5 h-3.5 text-teal-600" />
            Browse kit histories
          </button>
        </div>
      </div>

      {/* Live System Alerts Banner */}
      {alerts && alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert: any) => (
            <div
              key={alert.id}
              className={`p-3.5 rounded-xl border flex items-center justify-between shadow-xs ${
                alert.severity === 'CRITICAL'
                  ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                  : alert.severity === 'WARNING'
                  ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                  : 'bg-sky-50/70 border-sky-200 text-sky-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <AlertTriangle
                  className={`w-4 h-4 shrink-0 ${
                    alert.severity === 'CRITICAL'
                      ? 'text-rose-600'
                      : alert.severity === 'WARNING'
                      ? 'text-amber-600'
                      : 'text-sky-600'
                  }`}
                />
                <div>
                  <span className="text-xs font-bold mr-2">{alert.title}</span>
                  <span className="text-xs">{alert.message}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  if (alert.type === 'URGENT_REQUEST') setActiveTab('requests');
                  else if (alert.type === 'QC_REQUIRED') setActiveTab('qc');
                  else if (alert.type === 'QUARANTINE_ATTENTION') setActiveTab('quarantine');
                  else setActiveTab('inventory');
                }}
                className="text-xs font-semibold underline hover:no-underline ml-4 whitespace-nowrap"
              >
                {alert.actionText} →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Primary KPI Metric Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard
          label="Available Kits"
          value={overview.availableKits}
          subtext="Ready for dispatch"
          icon={CheckCircle2}
          variant="success"
        />
        <StatCard
          label="In Reprocessing"
          value={overview.inProcessingKits}
          subtext="Decon / Autoclave"
          icon={Layers}
          variant="info"
        />
        <StatCard
          label="Quarantined"
          value={overview.quarantinedKits}
          subtext="Hold vault sequestered"
          icon={ShieldAlert}
          variant="danger"
        />
        <StatCard
          label="Awaiting QC"
          value={overview.batchesAwaitingQc}
          subtext="Batches pending signoff"
          icon={Flame}
          variant="warning"
        />
        <StatCard
          label="Urgent Requisitions"
          value={overview.urgentRequests}
          subtext="Immediate surgery priority"
          icon={ClipboardList}
          variant={overview.urgentRequests > 0 ? 'danger' : 'default'}
        />
        <StatCard
          label="Total Registered Kits"
          value={overview.totalKits}
          subtext="In hospital registry"
          icon={Boxes}
          variant="default"
        />
      </div>

      {/* Role-Specific Active Panels */}
      {user?.role === 'REPROCESSING_OPERATOR' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Operator Decontamination Stations</h2>
              <p className="text-xs text-slate-500">Live active queues across cleaning and packaging workflow</p>
            </div>
            <button
              onClick={() => setActiveTab('processing')}
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              Open Workflow Board <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-[11px] font-medium text-slate-500">1. Returned</div>
              <div className="text-xl font-bold font-mono text-slate-800 mt-1">
                {operatorQueues.queueReturned}
              </div>
            </div>
            <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-200">
              <div className="text-[11px] font-medium text-blue-700">2. Received</div>
              <div className="text-xl font-bold font-mono text-blue-900 mt-1">
                {operatorQueues.queueReceived}
              </div>
            </div>
            <div className="p-3 bg-cyan-50/50 rounded-lg border border-cyan-200">
              <div className="text-[11px] font-medium text-cyan-700">3. Cleaning</div>
              <div className="text-xl font-bold font-mono text-cyan-900 mt-1">
                {operatorQueues.queueCleaning}
              </div>
            </div>
            <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-200">
              <div className="text-[11px] font-medium text-indigo-700">4. Inspection</div>
              <div className="text-xl font-bold font-mono text-indigo-900 mt-1">
                {operatorQueues.queueInspection}
              </div>
            </div>
            <div className="p-3 bg-purple-50/50 rounded-lg border border-purple-200">
              <div className="text-[11px] font-medium text-purple-700">5. Packing</div>
              <div className="text-xl font-bold font-mono text-purple-900 mt-1">
                {operatorQueues.queuePacking}
              </div>
            </div>
            <div className="p-3 bg-sky-50/50 rounded-lg border border-sky-200">
              <div className="text-[11px] font-medium text-sky-700">6. In Chamber</div>
              <div className="text-xl font-bold font-mono text-sky-900 mt-1">
                {operatorQueues.queueProcessing}
              </div>
            </div>
          </div>
        </div>
      )}

      {user?.role === 'DEPARTMENT_STAFF' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Your Department Activity Status</h2>
              <p className="text-xs text-slate-500">Live requisition and kit transit telemetry for your unit</p>
            </div>
            <button
              onClick={() => setActiveTab('requests')}
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              View All Requests <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-[11px] font-medium text-slate-500">Open Requests</div>
              <div className="text-xl font-bold font-mono text-slate-800 mt-1">
                {departmentOverview.deptOpenRequests}
              </div>
            </div>
            <div className="p-3 bg-rose-50/50 rounded-lg border border-rose-200">
              <div className="text-[11px] font-medium text-rose-700">Urgent Procedure Orders</div>
              <div className="text-xl font-bold font-mono text-rose-900 mt-1">
                {departmentOverview.deptUrgentRequests}
              </div>
            </div>
            <div className="p-3 bg-teal-50/50 rounded-lg border border-teal-200">
              <div className="text-[11px] font-medium text-teal-700">In Transit (Dispatched)</div>
              <div className="text-xl font-bold font-mono text-teal-900 mt-1">
                {departmentOverview.deptInTransit}
              </div>
            </div>
            <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-200">
              <div className="text-[11px] font-medium text-blue-700">Kits at Department</div>
              <div className="text-xl font-bold font-mono text-blue-900 mt-1">
                {departmentOverview.deptActiveKits}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Analytical Breakdown & Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Status Breakdown & Processing Stats */}
        <div className="lg:col-span-1 space-y-6">
          {/* Kit Status Distribution */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              Kits by Operational State
            </h2>
            <div className="space-y-2 text-xs">
              {Object.entries(charts.kitsByStatus).map(([st, count]) => (
                <div key={st} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
                  <StatusBadge status={st} size="sm" />
                  <span className="font-mono font-bold text-slate-700 tabular-nums">{count as number}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Historical Processing Lethality Results */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              Processing Attempt Ledger
            </h2>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="text-[10px] text-emerald-700 font-semibold uppercase">Passed</div>
                <div className="text-lg font-bold font-mono text-emerald-800 mt-1">
                  {charts.processingResults.passed}
                </div>
              </div>
              <div className="p-2.5 bg-rose-50 rounded-lg border border-rose-200">
                <div className="text-[10px] text-rose-700 font-semibold uppercase">Failed</div>
                <div className="text-lg font-bold font-mono text-rose-800 mt-1">
                  {charts.processingResults.failed}
                </div>
                <div className="text-[9px] text-rose-600 mt-0.5">In kit history</div>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-[10px] text-slate-600 font-semibold uppercase">In Progress</div>
                <div className="text-lg font-bold font-mono text-slate-800 mt-1">
                  {charts.processingResults.pending}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Audit Events Ledger */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-teal-600" />
                  Activity history
                </h2>
                <p className="text-xs text-slate-500">Recent kit transitions and recorded user actions</p>
              </div>
              <button
                onClick={() => setActiveTab('audit')}
                className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
              >
                Full Audit Trail <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {recentAudit.map((log: any) => (
                <div key={log.id} className="py-2.5 flex items-start justify-between text-xs hover:bg-slate-50/50 px-1 rounded transition-colors">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">{log.entity_id}</span>
                      <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                        {log.entity_type}
                      </span>
                      <span className="font-semibold text-slate-800">{log.action.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      By <span className="font-medium text-slate-700">{log.actor_name}</span> ({log.actor_role.split('_')[0]})
                      {log.previous_state && log.new_state && (
                        <span> · {log.previous_state} → <strong className="text-slate-700">{log.new_state}</strong></span>
                      )}
                    </div>
                  </div>
                  <div className="font-mono text-[10px] text-slate-400 whitespace-nowrap ml-4">
                    {log.created_at.substring(11, 16)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Events recorded with user and time</span>
            <span className="font-mono">Total Logged: {recentAudit.length} events</span>
          </div>
        </div>
      </div>
    </div>
  );
};
