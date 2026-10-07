// Enforces mandatory segregation of duties check

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from './Modal.js';
import { Batch } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { api } from '../services/api.js';
import { ShieldAlert, ShieldCheck, CheckCircle2, XCircle } from 'lucide-react';

interface QcReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: Batch | null;
  onReviewed: () => void;
}

export const QcReviewModal: React.FC<QcReviewModalProps> = ({
  isOpen,
  onClose,
  batch,
  onReviewed,
}) => {
  const { user } = useAuth();
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [bioResult, setBioResult] = useState('');
  const [chemResult, setChemResult] = useState('');
  const [packagingIntact, setPackagingIntact] = useState(false);
  const [notes, setNotes] = useState('');
  const reviewMutation = useMutation({
    mutationFn: (reviewData: any) => api.submitQcReview(batch!.id, reviewData),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['pending-qc'] }),
        queryClient.invalidateQueries({ queryKey: ['batches'] }),
        queryClient.invalidateQueries({ queryKey: ['quarantine'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['alerts'] }),
      ]);
    },
  });
  const isSubmitting = reviewMutation.isPending;

  if (!batch) return null;

  // Invariant check: Is current user the operator of this batch?
  const isOperatorSelfReview = user && batch.operator_id === user.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isOperatorSelfReview) {
      error(
        'Compliance Violation',
        'You ran this sterilization batch. Independent verification by a secondary Sterile Quality Coordinator is mandatory.'
      );
      return;
    }

    if (notes.trim().length < 5) { error('Review note required','Record the evidence and reason for this decision.'); return; }
    try {
      await reviewMutation.mutateAsync({
        decision,
        biologicalTestResult: bioResult,
        chemicalIndicatorResult: chemResult,
        packagingIntegrityVerified: packagingIntact,
        notes: notes.trim() || undefined,
      });

      if (decision === 'APPROVED') {
        success('Batch QC Approved', `Batch ${batch.batch_code} approved. All contained kits are now AVAILABLE in sterile inventory.`);
      } else {
        success('Batch QC Rejected', `Batch ${batch.batch_code} rejected. Contained kits have been immediately QUARANTINED.`);
      }

      onReviewed();
      onClose();
    } catch (err: any) {
      error('QC Signoff Failed', err.message);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Independent Quality Control Signoff"
      subtitle={`Batch: ${batch.batch_code} · ${batch.sterilizer_unit_id}`}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {isOperatorSelfReview ? (
          <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-rose-950">MANDATORY SEGREGATION OF DUTIES INVARIANT</div>
              <div className="mt-1 text-rose-800">
                You logged this run as Operator (<strong>{batch.operatorName}</strong>). A different quality coordinator must review and release this batch.
              </div>
              <div className="mt-2 text-rose-700 font-medium">
                A different quality coordinator must sign in and complete the review.
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-lg text-xs text-emerald-900 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong>Independent Review Verified:</strong> You are evaluating batch {batch.batch_code} operated by <em>{batch.operatorName}</em>.
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
          <div>
            <span className="text-slate-500">Sterilizer Method:</span>{' '}
            <span className="font-semibold text-slate-800">{batch.processing_method}</span>
          </div>
          <div>
            <span className="text-slate-500">Plateau Parameters:</span>{' '}
            <span className="font-semibold text-slate-800 font-mono">
              {batch.target_temperature_c}°C · {batch.target_pressure_psi} psi
            </span>
          </div>
          <div>
            <span className="text-slate-500">Exposure Duration:</span>{' '}
            <span className="font-semibold text-slate-800 font-mono">{batch.exposure_time_minutes} mins</span>
          </div>
          <div>
            <span className="text-slate-500">Kits in Load:</span>{' '}
            <span className="font-semibold text-slate-800 font-mono">{batch.kitCount || 1} kit(s)</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Quality Control Decision</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={Boolean(isOperatorSelfReview)}
              onClick={() => {
                setDecision('APPROVED');
              }}
              className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                decision === 'APPROVED'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-300'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              APPROVE BATCH (Release Kits)
            </button>
            <button
              type="button"
              disabled={Boolean(isOperatorSelfReview)}
              onClick={() => {
                setDecision('REJECTED');
              }}
              className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                decision === 'REJECTED'
                  ? 'border-rose-500 bg-rose-50 text-rose-700 ring-2 ring-rose-300'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <XCircle className="w-4 h-4 text-rose-600" />
              REJECT BATCH (Quarantine Load)
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Biological Indicator (Spore Challenge Readout)
            </label>
            <select
              disabled={Boolean(isOperatorSelfReview)}
              value={bioResult}
              onChange={(e) => setBioResult(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            ><option value="">Select observed result</option><option value="NEGATIVE">Negative</option><option value="POSITIVE">Positive</option><option value="INDETERMINATE">Indeterminate</option></select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Internal Chemical Integrator (Class 5 / Class 6)
            </label>
            <select
              disabled={Boolean(isOperatorSelfReview)}
              value={chemResult}
              onChange={(e) => setChemResult(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            ><option value="">Select observed result</option><option value="PASS">Pass</option><option value="FAIL">Fail</option><option value="INDETERMINATE">Indeterminate</option></select>
          </div>

          <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              disabled={Boolean(isOperatorSelfReview)}
              checked={packagingIntact}
              onChange={(e) => setPackagingIntact(e.target.checked)}
              className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
            />
            <span>Visual inspection confirms barrier wrap is dry, intact, and seal tape unbroken (no wet pack).</span>
          </label>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Audit Notes & Findings</label>
            <textarea
              rows={2}
              disabled={Boolean(isOperatorSelfReview)}
              placeholder="Record review observations, sterilizer printer slip verification..."
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
            disabled={Boolean(isOperatorSelfReview) || isSubmitting}
            className={`px-4 py-2 text-xs font-bold text-white rounded-lg shadow-xs transition-colors ${
              decision === 'APPROVED'
                ? 'bg-emerald-600 hover:bg-emerald-500'
                : 'bg-rose-600 hover:bg-rose-500'
            } disabled:opacity-40`}
          >
            {isSubmitting ? 'Recording...' : `Commit ${decision} Review`}
          </button>
        </div>
      </form>
    </Modal>
  );
};
