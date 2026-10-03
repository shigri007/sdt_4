// ==========================================================
// SteriTrack: Priority Change Modal (With Mandatory Justification)
// ==========================================================

import React, { useState } from 'react';
import { Modal } from './Modal.js';
import { KitRequest, PriorityCode } from '../types/index.js';
import { api } from '../services/api.js';
import { useToast } from '../context/ToastContext.js';
import { AlertCircle } from 'lucide-react';

interface PriorityModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: KitRequest | null;
  onUpdated: () => void;
}

export const PriorityModal: React.FC<PriorityModalProps> = ({
  isOpen,
  onClose,
  request,
  onUpdated,
}) => {
  const { success, error } = useToast();
  const [priority, setPriority] = useState<PriorityCode>('URGENT');
  const [justification, setJustification] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!request) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!justification.trim() || justification.trim().length < 5) {
      error('Justification Required', 'Clinical governance requires a documented clinical justification for changing requisition priority.');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.updateRequestPriority(request.id, priority, justification.trim());
      success('Priority Updated', `Requisition ${request.request_code} priority changed to ${priority}.`);
      setJustification('');
      onUpdated();
      onClose();
    } catch (err: any) {
      error('Failed to change priority', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Change Requisition Priority"
      subtitle={`Requisition: ${request.request_code} · ${request.kitTypeName}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-lg text-xs text-amber-900 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Priority rule:</strong> Priority affects the order of dispatch fulfillment, but never bypasses processing or quality review. Changes are recorded in request history.
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Target Priority</label>
          <div className="grid grid-cols-3 gap-2">
            {(['ROUTINE', 'HIGH', 'URGENT'] as PriorityCode[]).map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => setPriority(p)}
                className={`py-2 text-xs font-semibold rounded-lg border text-center transition-all ${
                  priority === p
                    ? p === 'URGENT'
                      ? 'bg-rose-50 border-rose-500 text-rose-700 ring-2 ring-rose-200'
                      : p === 'HIGH'
                      ? 'bg-amber-50 border-amber-500 text-amber-700 ring-2 ring-amber-200'
                      : 'bg-slate-100 border-slate-500 text-slate-900 ring-2 ring-slate-200'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Clinical Justification <span className="text-rose-500">*</span>
          </label>
          <textarea
            required
            rows={3}
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="e.g., Patient vitals deteriorating; moved emergency laparotomy into OR 3 earlier than scheduled."
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
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
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg shadow-xs transition-colors"
          >
            {isSubmitting ? 'Recording...' : 'Commit Priority Change'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
