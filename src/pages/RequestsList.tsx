
import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { KitRequest } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { PriorityBadge } from '../components/StatusBadge.js';
import { PriorityModal } from '../components/PriorityModal.js';
import { DispatchModal } from '../components/DispatchModal.js';
import { NewRequestModal } from '../components/NewRequestModal.js';
import { Modal } from '../components/Modal.js';
import {
  ClipboardList,
  Plus,
  Truck,
  TrendingUp,
  History,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react';

export const RequestsList: React.FC = () => {
  const { user, hasRole } = useAuth();
  const { error } = useToast();

  const [requests, setRequests] = useState<KitRequest[]>([]);
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [selectedReqForPriority, setSelectedReqForPriority] = useState<KitRequest | null>(null);
  const [selectedReqForDispatch, setSelectedReqForDispatch] = useState<KitRequest | null>(null);
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);

  // Priority History Modal
  const [historyReq, setHistoryReq] = useState<KitRequest | null>(null);
  const [priorityHistory, setPriorityHistory] = useState<any[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  useEffect(() => {
    loadRequests();
  }, [user, priorityFilter, statusFilter]);

  async function loadRequests() {
    try {
      setIsLoading(true);
      const res = await api.getRequests();
      if (res.success) {
        let filtered = res.data;
        if (priorityFilter) filtered = filtered.filter((r) => r.priority === priorityFilter);
        if (statusFilter) filtered = filtered.filter((r) => r.status === statusFilter);
        setRequests(filtered);
      }
    } catch (err: any) {
      error('Failed to load requisitions', err.message);
    } finally {
      setIsLoading(false);
    }
  }

  const handleOpenHistory = async (req: KitRequest) => {
    setHistoryReq(req);
    try {
      const res = await api.getRequestPriorityHistory(req.id);
      if (res.success) {
        setPriorityHistory(res.data);
        setIsHistoryModalOpen(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Clinical Kit Requisitions
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Surgical and trauma kit demand queue. Ordered by triage priority with auditable justification ledger.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsNewRequestOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4 text-teal-400" />
            New Kit Requisition
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPriorityFilter('')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              priorityFilter === ''
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Priorities
          </button>
          <button
            onClick={() => setPriorityFilter('URGENT')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
              priorityFilter === 'URGENT'
                ? 'bg-rose-600 text-white border-rose-600'
                : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
            }`}
          >
            Urgent Only
          </button>
          <button
            onClick={() => setPriorityFilter('HIGH')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              priorityFilter === 'HIGH'
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
            }`}
          >
            High
          </button>
          <button
            onClick={() => setPriorityFilter('ROUTINE')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              priorityFilter === 'ROUTINE'
                ? 'bg-slate-700 text-white border-slate-700'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Routine
          </button>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
          >
            <option value="">All Requisition Statuses</option>
            <option value="PENDING">Pending (Unfulfilled)</option>
            <option value="FULFILLED">Fulfilled (Dispatched)</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Requisition ID</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Required Kit Set</th>
                <th className="py-3 px-4">Department & Requestor</th>
                <th className="py-3 px-4">Clinical Procedure / Rationale</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading clinical requisitions...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No requisitions match the selected criteria.
                  </td>
                </tr>
              ) : (
                requests.map((req) => {
                  const isPending = req.status === 'PENDING';
                  const isFulfilled = req.status === 'FULFILLED';

                  return (
                    <tr
                      key={req.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        req.priority === 'URGENT' && isPending ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900">{req.request_code}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {req.created_at ? req.created_at.substring(0, 16) : ''}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <PriorityBadge priority={req.priority} size="sm" />
                          {req.priorityChangeCount && req.priorityChangeCount > 0 ? (
                            <button
                              onClick={() => handleOpenHistory(req)}
                              className="text-[10px] text-teal-600 hover:text-teal-800 font-semibold underline"
                              title="Inspect priority escalation history"
                            >
                              ({req.priorityChangeCount} Shift)
                            </button>
                          ) : null}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {req.kitTypeName}
                        <div className="text-[10px] text-slate-500 font-normal">Qty: {req.quantity} kit(s)</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">{req.departmentName}</div>
                        <div className="text-[10px] text-slate-500">By {req.requestedByName}</div>
                      </td>

                      <td className="py-3 px-4 max-w-xs text-slate-700">
                        <div className="truncate text-xs" title={req.clinical_reason}>
                          {req.clinical_reason}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" /> Pending
                          </span>
                        )}
                        {isFulfilled && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Fulfilled
                          </span>
                        )}
                        {req.status === 'CANCELLED' && (
                          <span className="text-xs text-slate-400">Cancelled</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending && (
                            <button
                              onClick={() => setSelectedReqForPriority(req)}
                              className="px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 border border-slate-300 rounded transition-colors"
                              title="Escalate or adjust priority with mandatory reason"
                            >
                              Priority
                            </button>
                          )}

                          {isPending && hasRole('QUALITY_COORDINATOR') && (
                            <button
                              onClick={() => setSelectedReqForDispatch(req)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors shadow-2xs"
                            >
                              <Truck className="w-3 h-3 text-teal-400" />
                              Dispatch
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PriorityModal
        isOpen={Boolean(selectedReqForPriority)}
        onClose={() => setSelectedReqForPriority(null)}
        request={selectedReqForPriority}
        onUpdated={loadRequests}
      />

      <DispatchModal
        isOpen={Boolean(selectedReqForDispatch)}
        onClose={() => setSelectedReqForDispatch(null)}
        request={selectedReqForDispatch}
        onDispatched={loadRequests}
      />

      <NewRequestModal
        isOpen={isNewRequestOpen}
        onClose={() => setIsNewRequestOpen(false)}
        onCreated={loadRequests}
      />

      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title="Priority Escalation & Change History"
        subtitle={`Requisition: ${historyReq?.request_code}`}
        maxWidth="md"
      >
        <div className="space-y-3">
          {priorityHistory.length === 0 ? (
            <div className="text-xs text-slate-500 py-4 text-center">No priority changes recorded.</div>
          ) : (
            priorityHistory.map((h: any) => (
              <div key={h.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <div className="flex items-center justify-between font-mono">
                  <span className="font-semibold text-slate-800">
                    {h.previous_priority} → <strong className="text-teal-700">{h.new_priority}</strong>
                  </span>
                  <span className="text-[10px] text-slate-400">{h.created_at}</span>
                </div>
                <div className="text-slate-600">
                  Changed by: <strong>{h.changedByName}</strong>
                </div>
                <div className="text-[11px] text-slate-700 bg-white p-2 rounded border border-slate-200 mt-1 italic">
                  "{h.justification}"
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
};
