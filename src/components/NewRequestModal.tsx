
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from './Modal.js';
import { KitType, Department, PriorityCode } from '../types/index.js';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { ClipboardPlus } from 'lucide-react';

interface NewRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export const NewRequestModal: React.FC<NewRequestModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [selectedDeptId, setSelectedDeptId] = useState<number>(user?.departmentId || 1);
  const [selectedKitTypeId, setSelectedKitTypeId] = useState<number>(1);
  const [quantity, setQuantity] = useState<number>(1);
  const [priority, setPriority] = useState<PriorityCode>('ROUTINE');
  const [reason, setReason] = useState('');
  const [requiredDate, setRequiredDate] = useState('');
  const queryClient = useQueryClient();
  const departmentsQuery = useQuery({ queryKey: ['departments'], queryFn: async () => (await api.getDepartments()).data, enabled: isOpen });
  const kitTypesQuery = useQuery({ queryKey: ['kit-types'], queryFn: async () => (await api.getKitTypes()).data, enabled: isOpen });
  const departments = (departmentsQuery.data ?? []) as Department[];
  const kitTypes = (kitTypesQuery.data ?? []) as KitType[];
  const createMutation = useMutation({
    mutationFn: (payload: { departmentId: number; kitTypeId: number; quantity: number; priority: PriorityCode; clinicalReason: string; requiredByDate?: string }) => api.createRequest(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['requests'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['alerts'] }),
      ]);
    },
  });
  const isSubmitting = createMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 5) {
      error('Clinical Reason Required', 'Please provide a clinical rationale or surgical procedure.');
      return;
    }

    try {
      await createMutation.mutateAsync({
        departmentId: selectedDeptId,
        kitTypeId: selectedKitTypeId,
        quantity,
        priority,
        clinicalReason: reason.trim(),
        requiredByDate: requiredDate || undefined,
      });

      success('Requisition Created', 'Sterile kit requisition submitted to Central Supply queue.');
      setReason('');
      onCreated();
      onClose();
    } catch (err: any) {
      error('Requisition Failed', err.message);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Sterile Kit Requisition"
      subtitle="Submit request for operating theatre or emergency unit"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Requesting Department</label>
          <select
            disabled={user?.role === 'DEPARTMENT_STAFF'}
            value={selectedDeptId}
            onChange={(e) => setSelectedDeptId(Number(e.target.value))}
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.code}) - {d.floor}
              </option>
            ))}
          </select>
          {user?.role === 'DEPARTMENT_STAFF' && (
            <div className="text-[11px] text-slate-400 mt-1">Locked to your assigned clinical department.</div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Required Kit Type</label>
          <select
            value={selectedKitTypeId}
            onChange={(e) => setSelectedKitTypeId(Number(e.target.value))}
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
          >
            {kitTypes.map((kt) => (
              <option key={kt.id} value={kt.id}>
                {kt.name} ({kt.category} · {kt.instrument_count} items)
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as PriorityCode)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
            >
              <option value="ROUTINE">Routine (Scheduled Elective)</option>
              <option value="HIGH">High (Urgent Procedure)</option>
              <option value="URGENT">Urgent (Immediate Resus / Trauma)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity</label>
            <input
              type="number"
              min={1}
              max={10}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Clinical Reason & Procedure Details <span className="text-rose-500">*</span>
          </label>
          <textarea
            required
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Scheduled bilateral inguinal hernia repair in OR Suite 4 at 14:00."
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
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
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg shadow-xs transition-colors"
          >
            <ClipboardPlus className="w-4 h-4 text-teal-400" />
            {isSubmitting ? 'Submitting...' : 'Submit Requisition'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
