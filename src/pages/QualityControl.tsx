// ==========================================================
// SteriTrack: Independent Quality Control Review Console
// Enforces mandatory segregation of duties check
// ==========================================================

import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { Batch } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { QcReviewModal } from '../components/QcReviewModal.js';
import {
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  Flame,
  Clock,
  AlertTriangle,
  History,
} from 'lucide-react';

export const QualityControl: React.FC = () => {
  const { user } = useAuth();
  const { error } = useToast();

  const [pendingBatches, setPendingBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPending();
  }, [user]);

  async function loadPending() {
    try {
      setIsLoading(true);
      const res = await api.getPendingQcBatches();
      if (res.success) {
        setPendingBatches(res.data);
      }
    } catch (err: any) {
      error('Failed to load pending QC queue', err.message);
    } finally {
      setIsLoading(false);
    }
  }

  const handleOpenReview = (batch: Batch) => {
    setSelectedBatch(batch);
    setIsReviewModalOpen(true);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Independent Quality Control Verification
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Biological indicator evaluations, chemical integrator validation, and batch release governance.
          </p>
        </div>
      </div>

      {/* Segregation of Duties Banner */}
      <div className="p-4 bg-teal-50 border border-teal-200/90 rounded-xl text-xs text-teal-900 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-teal-950">MANDATORY HEALTHCARE SAFETY INVARIANT</div>
          <div className="mt-0.5 text-teal-800">
            In compliance with infection control protocols, an operator who loaded and operated an autoclave cycle cannot approve their own Quality Control review. An independent Quality Coordinator must independently inspect physical recorder charts, biological test incubators, and chemical indicator transitions.
          </div>
        </div>
      </div>

      {/* Pending Reviews Queue */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Completed Batches Awaiting Quality Verification ({pendingBatches.length})
          </span>
          <span className="text-[11px] text-slate-500 font-mono">Live Pending Queue</span>
        </div>

        <div className="divide-y divide-slate-100">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400">Verifying pending sterilization batches...</div>
          ) : pendingBatches.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
              All completed sterilization batches have been independently reviewed and approved.
            </div>
          ) : (
            pendingBatches.map((batch) => {
              const isSelfRun = user && batch.operator_id === user.id;

              return (
                <div key={batch.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-slate-900">{batch.batch_code}</span>
                      <span className="text-xs font-semibold text-slate-700">{batch.sterilizer_unit_id}</span>
                      <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                        {batch.processing_method}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 flex items-center gap-2">
                      <span>CSPD Operator: <strong>{batch.operatorName}</strong></span>
                      <span>·</span>
                      <span className="font-mono">{batch.target_temperature_c}°C · {batch.target_pressure_psi} psi</span>
                      <span>·</span>
                      <span className="font-bold text-slate-800">{batch.kitCount} Kit(s) in load</span>
                    </div>

                    {isSelfRun && (
                      <div className="text-[11px] text-rose-600 font-semibold flex items-center gap-1 mt-1">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        You operated this batch. Independent review required (switch to secondary coordinator to approve).
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenReview(batch)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-xs transition-colors ${
                        isSelfRun
                          ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 text-teal-400" />
                      {isSelfRun ? 'Self-Review Prohibited' : 'Evaluate & Signoff Batch'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* QC Review Modal */}
      <QcReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        batch={selectedBatch}
        onReviewed={loadPending}
      />
    </div>
  );
};
