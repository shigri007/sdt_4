// ==========================================================
// SteriTrack: Sterilization Batches Management
// ==========================================================

import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { Batch } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { NewBatchModal } from '../components/NewBatchModal.js';
import { Modal } from '../components/Modal.js';
import {
  Flame,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Eye,
  AlertTriangle,
  Play,
  RotateCcw,
} from 'lucide-react';

export const BatchesList: React.FC = () => {
  const { user, hasRole } = useAuth();
  const { success, error } = useToast();

  const [batches, setBatches] = useState<Batch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewBatchOpen, setIsNewBatchOpen] = useState(false);

  // Batch Detail Modal
  const [selectedBatch, setSelectedBatch] = useState<any | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Complete / Fail Modal
  const [batchToComplete, setBatchToComplete] = useState<Batch | null>(null);
  const [physicalPassed, setPhysicalPassed] = useState(false);
  const [chemicalPassed, setChemicalPassed] = useState(false);
  const [completeNotes, setCompleteNotes] = useState('');

  const [batchToFail, setBatchToFail] = useState<Batch | null>(null);
  const [failReason, setFailReason] = useState('Chamber temperature fell below 134°C during sterilization exposure.');

  useEffect(() => {
    loadBatches();
  }, []);

  async function loadBatches() {
    try {
      setIsLoading(true);
      const res = await api.getBatches();
      if (res.success) {
        setBatches(res.data);
      }
    } catch (err: any) {
      error('Failed to load batches', err.message);
    } finally {
      setIsLoading(false);
    }
  }

  const handleOpenDetail = async (batchId: number) => {
    try {
      const res = await api.getBatchById(batchId);
      if (res.success) {
        setSelectedBatch(res.data);
        setIsDetailOpen(true);
      }
    } catch (err: any) {
      error('Failed to load batch details', err.message);
    }
  };

  const handleCompleteBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchToComplete) return;

    try {
      await api.completeBatch(batchToComplete.id, {
        physicalPassed,
        chemicalPassed,
        notes: completeNotes.trim() || undefined,
      });
      success('Cycle Completed', `Batch ${batchToComplete.batch_code} completed. Kits transitioned to Awaiting QC.`);
      setBatchToComplete(null);
      loadBatches();
    } catch (err: any) {
      error('Failed to complete batch', err.message);
    }
  };

  const handleFailBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchToFail) return;
    if (!failReason.trim()) {
      error('Reason Required', 'Please provide a failure root cause reason.');
      return;
    }

    try {
      await api.failBatch(batchToFail.id, failReason.trim());
      success('Batch Marked as Failed', `Batch ${batchToFail.batch_code} failed. All kits immediately quarantined.`);
      setBatchToFail(null);
      loadBatches();
    } catch (err: any) {
      error('Failed to fail batch', err.message);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Sterilization Batches</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Autoclave and low-temperature sterilizer logs, physical/chemical indicator records, and QC verdicts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasRole('REPROCESSING_OPERATOR') && (
            <button
              onClick={() => setIsNewBatchOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4 text-teal-400" />
              New Sterilization Batch
            </button>
          )}
        </div>
      </div>

      {/* Batches Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Batch Number</th>
                <th className="py-3 px-4">Sterilizer Unit</th>
                <th className="py-3 px-4">Method & Parameters</th>
                <th className="py-3 px-4">CSPD Operator</th>
                <th className="py-3 px-4 text-center">Kits Loaded</th>
                <th className="py-3 px-4">Cycle Status</th>
                <th className="py-3 px-4">Independent QC Verdict</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading sterilization batch history...
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No batches logged yet.
                  </td>
                </tr>
              ) : (
                batches.map((batch) => {
                  const isInProgress = batch.status === 'IN_PROGRESS';
                  const isCompleted = batch.status === 'COMPLETED';
                  const isFailed = batch.status === 'FAILED';

                  return (
                    <tr key={batch.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleOpenDetail(batch.id)}
                          className="font-mono font-bold text-slate-900 hover:text-teal-700 flex items-center gap-1.5"
                        >
                          <Flame className="w-3.5 h-3.5 text-amber-600" />
                          {batch.batch_code}
                        </button>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {batch.started_at ? batch.started_at.substring(0, 16) : ''}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-medium text-slate-800">
                        {batch.sterilizer_unit_id}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{batch.processing_method}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {batch.target_temperature_c}°C · {batch.target_pressure_psi} psi · {batch.exposure_time_minutes}m
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-700">
                        {batch.operatorName}
                      </td>

                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                        {batch.kitCount}
                      </td>

                      <td className="py-3 px-4">
                        {isInProgress && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                            In Progress
                          </span>
                        )}
                        {isCompleted && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Completed
                          </span>
                        )}
                        {isFailed && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            Failed Run
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {batch.qcDecision === 'APPROVED' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                            Approved ({batch.qcReviewerName})
                          </span>
                        ) : batch.qcDecision === 'REJECTED' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            Rejected ({batch.qcReviewerName})
                          </span>
                        ) : (
                          <span className="text-xs text-amber-700 font-medium">Awaiting Coordinator</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenDetail(batch.id)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                            title="Inspect Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {isInProgress && hasRole('REPROCESSING_OPERATOR') && (
                            <>
                              <button
                                onClick={() => setBatchToComplete(batch)}
                                className="px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 border border-emerald-300 rounded transition-colors"
                              >
                                Complete
                              </button>
                              <button
                                onClick={() => setBatchToFail(batch)}
                                className="px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 border border-rose-300 rounded transition-colors"
                              >
                                Fail Run
                              </button>
                            </>
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

      {/* New Batch Modal */}
      <NewBatchModal
        isOpen={isNewBatchOpen}
        onClose={() => setIsNewBatchOpen(false)}
        onBatchCreated={loadBatches}
      />

      {/* Complete Batch Modal */}
      <Modal
        isOpen={Boolean(batchToComplete)}
        onClose={() => setBatchToComplete(null)}
        title="Complete Sterilization Run"
        subtitle={`Batch: ${batchToComplete?.batch_code}`}
        maxWidth="md"
      >
        <form onSubmit={handleCompleteBatch} className="space-y-4">
          <p className="text-xs text-slate-600">
            Confirm that physical cycle printout and chemical indicators passed before transferring trays to cool-down area for QC.
          </p>

          <div className="space-y-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={physicalPassed}
                onChange={(e) => setPhysicalPassed(e.target.checked)}
                className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
              />
              <span>Physical temperature & pressure graph reached plateau thresholds.</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={chemicalPassed}
                onChange={(e) => setChemicalPassed(e.target.checked)}
                className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
              />
              <span>Chamber external tape and Bowie-Dick air removal test passed.</span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
            <input
              type="text"
              placeholder="e.g. Cycle printout archived; transferred to cooling bay."
              value={completeNotes}
              onChange={(e) => setCompleteNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setBatchToComplete(null)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
            >
              Confirm Completion
            </button>
          </div>
        </form>
      </Modal>

      {/* Fail Batch Modal */}
      <Modal
        isOpen={Boolean(batchToFail)}
        onClose={() => setBatchToFail(null)}
        title="Mark Sterilization Batch as FAILED"
        subtitle={`Batch: ${batchToFail?.batch_code}`}
        maxWidth="md"
      >
        <form onSubmit={handleFailBatch} className="space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <strong>Failure Isolation Notice:</strong> Marking this batch as failed will immediately transition all loaded kits to <strong>QUARANTINED</strong> status. Failed attempts remain in the kit history.
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Failure Root Cause Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={failReason}
              onChange={(e) => setFailReason(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setBatchToFail(null)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg"
            >
              Confirm Batch Failure & Quarantine
            </button>
          </div>
        </form>
      </Modal>

      {/* Batch Detail Modal */}
      <Modal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title="Sterilization Batch Inspection"
        subtitle={`Identifier: ${selectedBatch?.batch_code}`}
        maxWidth="lg"
      >
        {selectedBatch && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div>
                <span className="text-slate-500 block">Sterilizer Unit:</span>
                <span className="font-semibold text-slate-800">{selectedBatch.sterilizer_unit_id}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Method:</span>
                <span className="font-semibold text-slate-800">{selectedBatch.processing_method}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Operator:</span>
                <span className="font-semibold text-slate-800">{selectedBatch.operatorName}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Plateau Specs:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {selectedBatch.target_temperature_c}°C · {selectedBatch.target_pressure_psi} psi
                </span>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2">
                Loaded Kits in Chamber ({selectedBatch.kits?.length || 0})
              </h3>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg max-h-40 overflow-y-auto">
                {selectedBatch.kits?.map((k: any) => (
                  <div key={k.id} className="p-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-slate-900">{k.kit_code}</span>
                      <span className="text-slate-600 ml-2">{k.kit_name}</span>
                    </div>
                    <span className="text-slate-400 font-mono text-[10px]">Attempt #{k.attemptNumber}</span>
                  </div>
                ))}
              </div>
            </div>

            {selectedBatch.qcReview && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="font-bold text-emerald-900 mb-1">
                  Quality Control Review: {selectedBatch.qcReview.decision}
                </div>
                <div className="text-slate-700">Reviewer: {selectedBatch.qcReviewerName}</div>
                <div className="text-[11px] text-slate-600 mt-1">
                  Bio Indicator: {selectedBatch.qcReview.biological_test_result} · Chem Indicator:{' '}
                  {selectedBatch.qcReview.chemical_indicator_result}
                </div>
                {selectedBatch.qcReview.notes && (
                  <div className="mt-1 text-slate-600 italic">"{selectedBatch.qcReview.notes}"</div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
