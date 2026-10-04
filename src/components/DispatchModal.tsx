// Enforces database transaction & dispatch eligibility checks

import React, { useState, useEffect } from 'react';
import { Modal } from './Modal.js';
import { KitRequest, Kit } from '../types/index.js';
import { api } from '../services/api.js';
import { useToast } from '../context/ToastContext.js';
import { Truck, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { StatusBadge } from './StatusBadge.js';

interface DispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: KitRequest | null;
  onDispatched: () => void;
}

export const DispatchModal: React.FC<DispatchModalProps> = ({
  isOpen,
  onClose,
  request,
  onDispatched,
}) => {
  const { success, error } = useToast();
  const [eligibleKits, setEligibleKits] = useState<Kit[]>([]);
  const [selectedKitIds, setSelectedKitIds] = useState<number[]>([]);
  const [transportCaseId, setTransportCaseId] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && request) {
      loadEligible();
    }
  }, [isOpen, request]);

  async function loadEligible() {
    if (!request) return;
    try {
      setIsLoading(true);
      const res = await api.getEligibleKits(request.kit_type_id);
      if (res.success) {
        setEligibleKits(res.data);
        setSelectedKitIds([]);
      }
    } catch (err: any) {
      error('Failed to load eligible stock', err.message);
    } finally {
      setIsLoading(false);
    }
  }

  if (!request) return null;

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedKitIds.length !== request.quantity) {
      error('Selection required', `Select exactly ${request.quantity} eligible kits.`);
      return;
    }

    try {
      setIsSubmitting(true);
      await api.dispatchKit({
        requestId: request.id,
        kitIds: selectedKitIds,
        transportCaseId,
        notes,
      });
      success('Request dispatched', `${selectedKitIds.length} kit${selectedKitIds.length===1?'':'s'} assigned to ${request.request_code}.`);
      onDispatched();
      onClose();
    } catch (err: any) {
      error('Dispatch Failed', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Authorize Sterile Kit Dispatch"
      subtitle={`Fulfilling Requisition: ${request.request_code} · ${request.departmentName}`}
      maxWidth="lg"
    >
      <form onSubmit={handleDispatch} className="space-y-4">
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700">Required Kit Type:</span>
            <span className="font-medium text-slate-900">{request.kitTypeName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700">Clinical Reason:</span>
            <span className="text-slate-600 truncate max-w-[260px]">{request.clinical_reason}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700">Requisition Priority:</span>
            <span className={`font-semibold ${request.priority === 'URGENT' ? 'text-rose-600' : 'text-slate-700'}`}>
              {request.priority}
            </span>
          </div>
        </div>

        <div className="p-2.5 bg-teal-50 border border-teal-200/80 rounded-lg text-[11px] text-teal-900 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
          <div>
            Select all {request.quantity} required kits. Only available, unexpired kits with a recorded QC approval can be issued.
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Select {request.quantity} eligible kit{request.quantity===1?'':'s'} ({selectedKitIds.length} selected, {eligibleKits.length} available)
          </label>
          {isLoading ? (
            <div className="p-4 text-center text-xs text-slate-400">Verifying inventory eligibility...</div>
          ) : eligibleKits.length === 0 ? (
            <div className="p-4 border border-rose-200 bg-rose-50/50 rounded-lg text-xs text-rose-700 text-center">
              <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-rose-500" />
              No kits of this type currently meet all dispatch eligibility criteria (must be AVAILABLE, unexpired, and QC approved).
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {eligibleKits.map((kit) => (
                <label
                  key={kit.id}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedKitIds.includes(kit.id)
                      ? 'border-teal-500 bg-teal-50/40 ring-1 ring-teal-500'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedKitIds.includes(kit.id)}
                      onChange={() => setSelectedKitIds(previous => previous.includes(kit.id) ? previous.filter(id=>id!==kit.id) : previous.length < request.quantity ? [...previous,kit.id] : previous)}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <div>
                      <div className="font-mono font-semibold text-xs text-slate-900">{kit.kit_code}</div>
                      <div className="text-[11px] text-slate-600">{kit.kit_name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Location: {kit.current_location} · Cycle #{kit.processing_attempt_number} · Exp: {kit.expiration_date}
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={kit.current_status} size="sm" />
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Transport Carrier / Case ID</label>
            <input
              type="text"
              value={transportCaseId}
              onChange={(e) => setTransportCaseId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Dispatch Notes</label>
            <input
              type="text"
              placeholder="e.g. Seal tag #99411 attached"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || selectedKitIds.length !== request.quantity}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg shadow-xs transition-colors"
          >
            <Truck className="w-4 h-4 text-teal-400" />
            {isSubmitting ? 'Dispatching...' : `Confirm & dispatch ${request.quantity} kit${request.quantity===1?'':'s'}`}
          </button>
        </div>
      </form>
    </Modal>
  );
};
