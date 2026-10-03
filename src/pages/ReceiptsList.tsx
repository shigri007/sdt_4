// ==========================================================
// SteriTrack: Clinical Receipts & Kit Return Management
// Department staff verifies delivery and returns used kits
// ==========================================================

import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { DispatchRecord, Kit } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { Modal } from '../components/Modal.js';
import {
  Receipt,
  CheckCircle2,
  RotateCcw,
  Truck,
  ShieldCheck,
  AlertCircle,
  Package,
} from 'lucide-react';

export const ReceiptsList: React.FC = () => {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [dispatches, setDispatches] = useState<DispatchRecord[]>([]);
  const [deptKits, setDeptKits] = useState<Kit[]>([]);
  const [selectedDispatchForReceipt, setSelectedDispatchForReceipt] = useState<DispatchRecord | null>(null);
  const [selectedKitToReturn, setSelectedKitToReturn] = useState<Kit | null>(null);

  // Form states
  const [packagingIntact, setPackagingIntact] = useState(true);
  const [indicatorVerified, setIndicatorVerified] = useState(true);
  const [conditionNotes, setConditionNotes] = useState('Sterile barrier wrap intact; Class 5 integrator verified dark brown.');
  const [returnNotes, setReturnNotes] = useState('Procedure completed; kit returned contaminated.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user]);

  async function loadData() {
    try {
      setIsLoading(true);
      const [dispRes, kitsRes] = await Promise.all([
        api.getDispatchHistory(),
        api.getKits({ status: 'RECEIVED_BY_DEPT' }),
      ]);

      if (dispRes.success) setDispatches(dispRes.data);
      if (kitsRes.success) {
        // If department staff, filter to their assigned department
        if (user?.role === 'DEPARTMENT_STAFF' && user.departmentId) {
          setDeptKits(kitsRes.data.filter((k) => k.department_owner_id === user.departmentId));
        } else {
          setDeptKits(kitsRes.data);
        }
      }
    } catch (err: any) {
      error('Failed to load receipts', err.message);
    } finally {
      setIsLoading(false);
    }
  }

  const handleConfirmReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDispatchForReceipt) return;

    try {
      setIsSubmitting(true);
      await api.confirmReceipt({
        dispatchId: selectedDispatchForReceipt.id,
        packagingIntact,
        indicatorColorVerified: indicatorVerified,
        conditionNotes: conditionNotes.trim() || undefined,
      });

      success(
        'Receipt Verified',
        `Kit ${selectedDispatchForReceipt.kitCode} received and verified for clinical use.`
      );
      setSelectedDispatchForReceipt(null);
      loadData();
    } catch (err: any) {
      error('Receipt Failed', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnKit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKitToReturn) return;

    try {
      setIsSubmitting(true);
      await api.returnKit(selectedKitToReturn.id, returnNotes.trim());
      success(
        'Kit Returned',
        `Kit ${selectedKitToReturn.kit_code} marked as contaminated. Dispatched to CSPD decontamination receiving dock.`
      );
      setSelectedKitToReturn(null);
      loadData();
    } catch (err: any) {
      error('Return Failed', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingDispatches = dispatches.filter((d) => d.status === 'DISPATCHED');

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Clinical Delivery Receipt & Used Kit Returns
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Verify physical sterile integrity upon department delivery and initiate return cycle for contaminated trays.
        </p>
      </div>

      {/* Incoming Dispatches Awaiting Confirmation */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Incoming Sterile Kit Deliveries ({pendingDispatches.length})
          </span>
          <span className="text-[11px] text-slate-500 font-mono">Awaiting Department Verification</span>
        </div>

        <div className="divide-y divide-slate-100">
          {pendingDispatches.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1 opacity-80" />
              No deliveries currently in transit to department.
            </div>
          ) : (
            pendingDispatches.map((d) => (
              <div key={d.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-slate-900">{d.kitCode}</span>
                    <span className="text-xs font-semibold text-slate-800">{d.kitName}</span>
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      Case: {d.transport_case_id || 'STD'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600">
                    To: <strong>{d.recipientDepartmentName}</strong> · Dispatched by {d.dispatchedByName}
                    {d.dispatch_notes && <span> · Note: {d.dispatch_notes}</span>}
                  </div>
                </div>

                <button
                  onClick={() => setSelectedDispatchForReceipt(d)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors whitespace-nowrap self-start sm:self-auto"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                  Sign & Verify Receipt
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Kits Currently in Procedure / At Department (Ready for Return) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Sterile Kits at Department Suites ({deptKits.length})
          </span>
          <span className="text-[11px] text-slate-500 font-mono">Available for Procedure or Contaminated Return</span>
        </div>

        <div className="divide-y divide-slate-100">
          {deptKits.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No kits currently stored at the department.
            </div>
          ) : (
            deptKits.map((kit) => (
              <div key={kit.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-slate-900">{kit.kit_code}</span>
                    <span className="text-xs font-semibold text-slate-800">{kit.kit_name}</span>
                    <span className="text-[10px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded font-semibold">
                      Verified at Dept
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    Location: {kit.current_location} · Cycle #{kit.processing_attempt_number}
                  </div>
                </div>

                <button
                  onClick={() => setSelectedKitToReturn(kit)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors whitespace-nowrap self-start sm:self-auto"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                  Return Contaminated Kit to CSPD
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Confirm Receipt Modal */}
      <Modal
        isOpen={Boolean(selectedDispatchForReceipt)}
        onClose={() => setSelectedDispatchForReceipt(null)}
        title="Verify Clinical Sterile Receipt"
        subtitle={`Kit: ${selectedDispatchForReceipt?.kitCode}`}
        maxWidth="md"
      >
        <form onSubmit={handleConfirmReceipt} className="space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Kit Identifier:</span>
              <span className="font-mono font-bold text-slate-800">{selectedDispatchForReceipt?.kitCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Description:</span>
              <span className="font-medium text-slate-800">{selectedDispatchForReceipt?.kitName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Carrier Case:</span>
              <span className="font-mono text-slate-700">{selectedDispatchForReceipt?.transport_case_id}</span>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={packagingIntact}
                onChange={(e) => setPackagingIntact(e.target.checked)}
                className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
              />
              <span>SMS barrier wrap is completely dry and tamper-evident seal is unbroken.</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={indicatorVerified}
                onChange={(e) => setIndicatorVerified(e.target.checked)}
                className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
              />
              <span>External process indicator tape has turned color (dark brown/black).</span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Receipt Notes</label>
            <input
              type="text"
              value={conditionNotes}
              onChange={(e) => setConditionNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setSelectedDispatchForReceipt(null)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
            >
              Confirm Clinical Receipt
            </button>
          </div>
        </form>
      </Modal>

      {/* Return Contaminated Kit Modal */}
      <Modal
        isOpen={Boolean(selectedKitToReturn)}
        onClose={() => setSelectedKitToReturn(null)}
        title="Return Contaminated Kit to Decontamination"
        subtitle={`Kit: ${selectedKitToReturn?.kit_code} · ${selectedKitToReturn?.kit_name}`}
        maxWidth="md"
      >
        <form onSubmit={handleReturnKit} className="space-y-4">
          <p className="text-xs text-slate-600">
            Marking this kit as contaminated transitions it to <strong>RETURNED</strong> status and logs its intake at the Decontamination Receiving Dock for a fresh reprocessing cycle.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Return Notes</label>
            <input
              type="text"
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setSelectedKitToReturn(null)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg"
            >
              Confirm Return to CSPD
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
