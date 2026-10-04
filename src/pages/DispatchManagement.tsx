
import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { DispatchRecord, KitRequest } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { DispatchModal } from '../components/DispatchModal.js';
import {
  Truck,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertCircle,
  PackageCheck,
  ArrowRight,
} from 'lucide-react';
import { PriorityBadge } from '../components/StatusBadge.js';

interface DispatchManagementProps {
  onSelectKitTrace?: (kitCode: string) => void;
}

export const DispatchManagement: React.FC<DispatchManagementProps> = ({ onSelectKitTrace }) => {
  const { user } = useAuth();
  const { error } = useToast();

  const [dispatches, setDispatches] = useState<DispatchRecord[]>([]);
  const [pendingRequests, setPendingRequests] = useState<KitRequest[]>([]);
  const [selectedReqForDispatch, setSelectedReqForDispatch] = useState<KitRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setIsLoading(true);
      const [dispRes, reqRes] = await Promise.all([
        api.getDispatchHistory(),
        api.getRequests(),
      ]);

      if (dispRes.success) setDispatches(dispRes.data);
      if (reqRes.success) {
        setPendingRequests(reqRes.data.filter((r) => r.status === 'PENDING'));
      }
    } catch (err: any) {
      error('Failed to load dispatch records', err.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Sterile Kit Dispatch Terminal
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Atomic transaction dispatch for eligible sterile kits to clinical procedure suites.
          </p>
        </div>
      </div>

      <div className="p-4 bg-teal-50 border border-teal-200/90 rounded-xl text-xs text-teal-900 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-teal-950">ATOMIC TRANSACTION INVARIANT</div>
          <div className="mt-0.5 text-teal-800">
            Dispatch queries run within strict database transaction boundaries. A kit can only be issued if it holds an APPROVED quality control record, has unexpired sterility shelf life, and is not quarantined. Simultaneous duplicate dispatch attempts are safely serialized.
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Requisitions Awaiting Sterile Kit Assignment ({pendingRequests.length})
          </span>
          <span className="text-[11px] text-slate-500 font-mono">Sorted by Clinical Priority</span>
        </div>

        <div className="divide-y divide-slate-100">
          {pendingRequests.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1 opacity-80" />
              All clinical requisitions have been fulfilled and dispatched.
            </div>
          ) : (
            pendingRequests.map((req) => (
              <div key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-slate-900">{req.request_code}</span>
                    <PriorityBadge priority={req.priority} size="sm" />
                    <span className="font-semibold text-xs text-slate-800">{req.kitTypeName}</span>
                  </div>

                  <div className="text-xs text-slate-600">
                    To: <strong>{req.departmentName}</strong> · Procedure: <em>"{req.clinical_reason}"</em>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedReqForDispatch(req)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors whitespace-nowrap self-start sm:self-auto"
                >
                  <Truck className="w-3.5 h-3.5 text-teal-400" />
                  Assign & Dispatch Sterile Kit
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Recent Hospital Dispatches ({dispatches.length})
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Dispatch Code</th>
                <th className="py-3 px-4">Kit Code & Name</th>
                <th className="py-3 px-4">Target Department</th>
                <th className="py-3 px-4">Requisition</th>
                <th className="py-3 px-4">Transport Case</th>
                <th className="py-3 px-4">Dispatched By</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                    Loading dispatch logistics ledger...
                  </td>
                </tr>
              ) : dispatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                    No kit dispatches on record.
                  </td>
                </tr>
              ) : (
                dispatches.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{d.dispatch_code}</td>
                    <td className="py-3 px-4 font-sans">
                      <button
                        onClick={() => onSelectKitTrace && onSelectKitTrace(d.kitCode || '')}
                        className="font-mono font-bold text-slate-900 hover:text-teal-700"
                      >
                        {d.kitCode}
                      </button>
                      <div className="text-[11px] text-slate-500">{d.kitName}</div>
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-700 font-medium">
                      {d.recipientDepartmentName}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{d.requestCode}</td>
                    <td className="py-3 px-4 text-slate-500">{d.transport_case_id || '—'}</td>
                    <td className="py-3 px-4 font-sans text-slate-700">{d.dispatchedByName}</td>
                    <td className="py-3 px-4 font-sans">
                      {d.status === 'RECEIVED' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Received at Dept
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700">
                          <Truck className="w-3.5 h-3.5" /> In Transit
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DispatchModal
        isOpen={Boolean(selectedReqForDispatch)}
        onClose={() => setSelectedReqForDispatch(null)}
        request={selectedReqForDispatch}
        onDispatched={loadData}
      />
    </div>
  );
};
