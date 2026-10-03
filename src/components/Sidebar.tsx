// ==========================================================
// SteriTrack: Responsive Navigation Sidebar
// ==========================================================

import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { canAccessTab } from '../access.js';
import {
  LayoutDashboard,
  PackageSearch,
  ClipboardList,
  Layers,
  Flame,
  CheckCircle2,
  ShieldAlert,
  Boxes,
  Truck,
  Receipt,
  GitBranch,
  History,
  FileText,
  Settings,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingQcCount?: number;
  quarantineCount?: number;
  urgentReqCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  pendingQcCount = 0,
  quarantineCount = 0,
  urgentReqCount = 0,
}) => {
  const { user } = useAuth();

  const navSections = [
    {
      title: 'OPERATIONS',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: LayoutDashboard,
          show: true,
        },
        {
          id: 'kits',
          label: 'Kit Registry',
          icon: PackageSearch,
          show: true,
        },
        {
          id: 'requests',
          label: 'Kit Requisitions',
          icon: ClipboardList,
          badge: urgentReqCount > 0 ? `${urgentReqCount} Urgent` : undefined,
          badgeColor: 'bg-rose-100 text-rose-700',
          show: true,
        },
      ],
    },
    {
      title: 'REPROCESSING & STERILIZATION',
      items: [
        {
          id: 'processing',
          label: 'Decon Workflow',
          icon: Layers,
          show: true,
        },
        {
          id: 'batches',
          label: 'Autoclave Batches',
          icon: Flame,
          show: true,
        },
        {
          id: 'qc',
          label: 'Quality Control',
          icon: CheckCircle2,
          badge: pendingQcCount > 0 ? `${pendingQcCount} Review` : undefined,
          badgeColor: 'bg-amber-100 text-amber-800',
          show: true,
        },
        {
          id: 'quarantine',
          label: 'Quarantine Vault',
          icon: ShieldAlert,
          badge: quarantineCount > 0 ? `${quarantineCount}` : undefined,
          badgeColor: 'bg-rose-100 text-rose-800',
          show: true,
        },
      ],
    },
    {
      title: 'DISTRIBUTION & LOGISTICS',
      items: [
        {
          id: 'inventory',
          label: 'Stock Availability',
          icon: Boxes,
          show: true,
        },
        {
          id: 'dispatch',
          label: 'Dispatch Terminal',
          icon: Truck,
          show: true,
        },
        {
          id: 'receipts',
          label: 'Clinical Receipts',
          icon: Receipt,
          show: true,
        },
      ],
    },
    {
      title: 'AUDIT & GOVERNANCE',
      items: [
        {
          id: 'traceability',
          label: 'Kit Traceability',
          icon: GitBranch,
          show: true,
        },
        {
          id: 'audit',
          label: 'Audit Trail',
          icon: History,
          show: true,
        },
        {
          id: 'reports',
          label: 'Compliance Reports',
          icon: FileText,
          show: true,
        },
      ],
    },
    {
      title: 'ADMINISTRATION',
      items: [{
        id: 'admin',
        label: 'Admin Panel',
        icon: Settings,
        show: true,
      }],
    },
  ];

  return (
    <aside className="app-sidebar w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 select-none min-h-[calc(100vh-65px)]">
      {/* User Context Banner in Sidebar */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-950/40">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Signed-in account</div>
        <div className="text-sm font-semibold text-white truncate mt-0.5">{user?.fullName}</div>
        <div className="flex items-center gap-1.5 mt-1 text-xs text-teal-400">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
          <span className="font-mono text-[11px]">{user?.badgeNumber || 'BADGE-VERIFIED'}</span>
          <span className="text-slate-500 font-normal">· {user?.role ? user.role.replace(/_/g, ' ') : ''}</span>
        </div>
      </div>

      {/* Nav Lists */}
      <div className="flex-1 py-4 px-3 space-y-6 overflow-y-auto">
        {navSections.map((sec) => {
          const visibleItems = sec.items.filter((item) => item.show && user && canAccessTab(user.role, item.id));
          if (visibleItems.length === 0) return null;

          return (
            <div key={sec.title}>
              <div className="px-3 text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-1.5">
                {sec.title}
              </div>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      aria-label={item.label}
                      aria-current={isActive ? 'page' : undefined}
                      title={item.label}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                        isActive
                          ? 'bg-slate-800 text-white shadow-xs font-semibold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-teal-400' : 'text-slate-500'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
        <span>SteriTrack v1.0</span>
        <span className="font-mono text-[10px]">Local workspace</span>
      </div>
    </aside>
  );
};
