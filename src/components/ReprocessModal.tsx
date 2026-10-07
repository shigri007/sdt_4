// Spawns Attempt #N while preserving immutable failed attempts

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from './Modal.js';
import { Kit } from '../types/index.js';
import { api } from '../services/api.js';
import { useToast } from '../context/ToastContext.js';
import { RefreshCw, History, ShieldAlert } from 'lucide-react';

interface ReprocessModalProps {
  isOpen: boolean;
  onClose: () => void;
  kit: Kit | null;
  onReprocessStarted: () => void;
}

export const ReprocessModal: React.FC<ReprocessModalProps> = ({
  isOpen,
  onClose,
  kit,
  onReprocessStarted,
}) => {
  const { success, error } = useToast();
  const queryClient = useQueryClient();
  const [justification, setJustification] = useState(
    'Released from Quarantine for complete re-cleaning, ultrasonic wash, and re-sterilization.'
  );
  const reprocessMutation = useMutation({
    mutationFn: ({ kitId, reason }: { kitId: number; reason: string }) => api.startReprocessing(kitId, reason),
    onSuccess: async () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['quarantine'] }),
      queryClient.invalidateQueries({ queryKey: ['processing-queues'] }),
      queryClient.invalidateQueries({ queryKey: ['kits'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['alerts'] }),
    ]),
  });
  const isSubmitting = reprocessMutation.isPending;

  if (!kit) return null;

  const currentAttempt = kit.processing_attempt_number;
  const nextAttempt = currentAttempt + 1;

  const handleReprocess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!justification.trim() || justification.trim().length < 5) {
      error('Justification Required', 'Please provide a clinical justification for reprocessing authorization.');
      return;
    }

    try {
      await reprocessMutation.mutateAsync({ kitId: kit.id, reason: justification.trim() });
      success(
        'Reprocessing Cycle Initiated',
        `Attempt #${nextAttempt} created for Kit ${kit.kit_code}. Moved to Decontamination Receiving Dock.`
      );
      onReprocessStarted();
      onClose();
    } catch (err: any) {
      error('Authorization Failed', err.message);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Authorize Reprocessing Cycle"
      subtitle={`Quarantined Kit: ${kit.kit_code} · ${kit.kit_name}`}
      maxWidth="md"
    >
      <form onSubmit={handleReprocess} className="space-y-4">
        <div className="p-3 bg-amber-50 border border-amber-200/90 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
          <History className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-amber-950">IMMUTABLE ATTEMPT LEDGER NOTICE</div>
            <div className="mt-1 text-amber-800">
              The failed attempt (<strong>Attempt #{currentAttempt}</strong>) will <em>never be overwritten or deleted</em>. SteriTrack will generate <strong>Attempt #{nextAttempt}</strong> and return the kit to the Decontamination Receiving Dock for a full cleaning sequence.
            </div>
          </div>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">Kit Identifier:</span>
            <span className="font-mono font-bold text-slate-800">{kit.kit_code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Current Quarantine Reason:</span>
            <span className="text-rose-600 font-medium truncate max-w-[220px]">{kit.notes || 'Batch failed inspection'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Reprocessing Cycle:</span>
            <span className="font-bold text-teal-700">Spawning Attempt #{nextAttempt}</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Clinical Authorization Justification <span className="text-rose-500">*</span>
          </label>
          <textarea
            required
            rows={3}
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
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
            <RefreshCw className="w-4 h-4 text-teal-400" />
            {isSubmitting ? 'Spawning Cycle...' : `Release & Spawn Attempt #${nextAttempt}`}
          </button>
        </div>
      </form>
    </Modal>
  );
};
