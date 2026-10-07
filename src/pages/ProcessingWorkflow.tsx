// Server-side validated state transitions across all stages

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api.js';
import { Kit } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { NewBatchModal } from '../components/NewBatchModal.js';
import {
  Layers,
  ArrowRight,
  Flame,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Search,
  Package,
} from 'lucide-react';

export const ProcessingWorkflow: React.FC = () => {
  const { user, hasRole } = useAuth();
  const { success, error } = useToast();

  const [isNewBatchOpen, setIsNewBatchOpen] = useState(false);
  const [activeProcessingId, setActiveProcessingId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const queuesQuery = useQuery({ queryKey: ['processing-queues'], queryFn: async () => (await api.getProcessingQueues()).data });
  const queues: { returned: Kit[]; received: Kit[]; cleaning: Kit[]; inspection: Kit[]; packing: Kit[]; awaitingQc: Kit[] } = queuesQuery.data ?? {
    returned: [], received: [], cleaning: [], inspection: [], packing: [], awaitingQc: [],
  };
  const isLoading = queuesQuery.isLoading;
  const loadQueues = () => queuesQuery.refetch();
  const transitionMutation = useMutation({
    mutationFn: ({ kitId, targetStatus, notes }: { kitId: number; targetStatus: string; notes?: string }) => api.transitionKit(kitId, targetStatus, { notes }),
    onSuccess: async (res) => {
      success('Workflow Advanced', res.message);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['processing-queues'] }),
        queryClient.invalidateQueries({ queryKey: ['kits'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-summary'] }),
      ]);
    },
    onError: (cause: any) => error('Transition Rejected', cause.message),
    onSettled: () => setActiveProcessingId(null),
  });

  const handleTransition = async (kitId: number, targetStatus: string, notes?: string) => {
    setActiveProcessingId(kitId);
    await transitionMutation.mutateAsync({ kitId, targetStatus, notes }).catch(() => undefined);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Decontamination & Reprocessing Stations
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Controlled state machine workflow from contaminated intake to autoclave packaging.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasRole('REPROCESSING_OPERATOR') && (
            <button
              onClick={() => setIsNewBatchOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
            >
              <Flame className="w-4 h-4 text-teal-400" />
              Load Sterilizer Batch ({queues.packing.length} Packed)
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
            <div>
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                1. Returned
              </span>
              <span className="text-[10px] text-slate-500">Decon intake dock</span>
            </div>
            <span className="font-mono text-xs font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
              {queues.returned.length}
            </span>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto">
            {queues.returned.map((kit) => (
              <div key={kit.id} className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs space-y-2">
                <div>
                  <div className="font-mono font-bold text-xs text-slate-900">{kit.kit_code}</div>
                  <div className="text-xs text-slate-700 font-medium truncate">{kit.kit_name}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{kit.current_location}</div>
                </div>

                <button
                  disabled={activeProcessingId === kit.id}
                  onClick={() => handleTransition(kit.id, 'RECEIVED', 'Intake verified in decontamination dock')}
                  className="w-full py-1.5 px-2 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-md transition-colors flex items-center justify-center gap-1 shadow-2xs"
                >
                  Receive & Sort <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
            {queues.returned.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400">No kits awaiting intake.</div>
            )}
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
            <div>
              <span className="text-xs font-bold text-blue-900 uppercase tracking-wider block">
                2. Received
              </span>
              <span className="text-[10px] text-slate-500">Pre-wash sorting</span>
            </div>
            <span className="font-mono text-xs font-bold text-blue-800 bg-white px-2 py-0.5 rounded border border-slate-200">
              {queues.received.length}
            </span>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto">
            {queues.received.map((kit) => (
              <div key={kit.id} className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs space-y-2">
                <div>
                  <div className="font-mono font-bold text-xs text-slate-900">{kit.kit_code}</div>
                  <div className="text-xs text-slate-700 font-medium truncate">{kit.kit_name}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Attempt #{kit.processing_attempt_number}</div>
                </div>

                <button
                  disabled={activeProcessingId === kit.id}
                  onClick={() => handleTransition(kit.id, 'CLEANING', 'Loaded into ultrasonic cavitation bath')}
                  className="w-full py-1.5 px-2 text-[11px] font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-md transition-colors flex items-center justify-center gap-1 shadow-2xs"
                >
                  Start Cleaning Wash <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
            {queues.received.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400">No kits in sorting dock.</div>
            )}
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
            <div>
              <span className="text-xs font-bold text-cyan-900 uppercase tracking-wider block">
                3. Cleaning
              </span>
              <span className="text-[10px] text-slate-500">Ultrasonic washer</span>
            </div>
            <span className="font-mono text-xs font-bold text-cyan-800 bg-white px-2 py-0.5 rounded border border-slate-200">
              {queues.cleaning.length}
            </span>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto">
            {queues.cleaning.map((kit) => (
              <div key={kit.id} className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs space-y-2">
                <div>
                  <div className="font-mono font-bold text-xs text-slate-900">{kit.kit_code}</div>
                  <div className="text-xs text-slate-700 font-medium truncate">{kit.kit_name}</div>
                  <div className="text-[10px] text-cyan-700 font-medium mt-0.5">Ultrasonic cycle in progress</div>
                </div>

                <button
                  disabled={activeProcessingId === kit.id}
                  onClick={() => handleTransition(kit.id, 'INSPECTION', 'Wash complete; transferred to clean assembly bench')}
                  className="w-full py-1.5 px-2 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-md transition-colors flex items-center justify-center gap-1 shadow-2xs"
                >
                  Complete Wash <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
            {queues.cleaning.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400">No kits in cleaning bay.</div>
            )}
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
            <div>
              <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider block">
                4. Inspection
              </span>
              <span className="text-[10px] text-slate-500">Visual integrity bench</span>
            </div>
            <span className="font-mono text-xs font-bold text-indigo-800 bg-white px-2 py-0.5 rounded border border-slate-200">
              {queues.inspection.length}
            </span>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto">
            {queues.inspection.map((kit) => (
              <div key={kit.id} className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs space-y-2">
                <div>
                  <div className="font-mono font-bold text-xs text-slate-900">{kit.kit_code}</div>
                  <div className="text-xs text-slate-700 font-medium truncate">{kit.kit_name}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Inspect tips, hinges, sharpness</div>
                </div>

                <div className="space-y-1">
                  <button
                    disabled={activeProcessingId === kit.id}
                    onClick={() => handleTransition(kit.id, 'PACKING', 'Visual inspection passed: all instruments verified')}
                    className="w-full py-1.5 px-2 text-[11px] font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-md transition-colors flex items-center justify-center gap-1 shadow-2xs"
                  >
                    Pass & Pack <ArrowRight className="w-3 h-3" />
                  </button>

                  <button
                    disabled={activeProcessingId === kit.id}
                    onClick={() => handleTransition(kit.id, 'QUARANTINED', 'Defective instrument tip found during visual magnification inspection.')}
                    className="w-full py-1 px-2 text-[10px] font-medium text-rose-700 hover:bg-rose-50 rounded transition-colors"
                  >
                    Flag Defect → Quarantine
                  </button>
                </div>
              </div>
            ))}
            {queues.inspection.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400">No kits in inspection.</div>
            )}
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
            <div>
              <span className="text-xs font-bold text-purple-900 uppercase tracking-wider block">
                5. Packing
              </span>
              <span className="text-[10px] text-slate-500">Double wrap & indicators</span>
            </div>
            <span className="font-mono text-xs font-bold text-purple-800 bg-white px-2 py-0.5 rounded border border-slate-200">
              {queues.packing.length}
            </span>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto">
            {queues.packing.map((kit) => (
              <div key={kit.id} className="p-3 bg-white rounded-lg border border-purple-200/80 shadow-xs space-y-2">
                <div>
                  <div className="font-mono font-bold text-xs text-slate-900">{kit.kit_code}</div>
                  <div className="text-xs text-slate-700 font-medium truncate">{kit.kit_name}</div>
                  <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">Ready for Autoclave Chamber</div>
                </div>

                <button
                  onClick={() => setIsNewBatchOpen(true)}
                  className="w-full py-1.5 px-2 text-[11px] font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors flex items-center justify-center gap-1 shadow-2xs"
                >
                  <Flame className="w-3.5 h-3.5 text-teal-400" />
                  Load to Batch
                </button>
              </div>
            ))}
            {queues.packing.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400">No kits awaiting batching.</div>
            )}
          </div>
        </div>
      </div>

      <NewBatchModal
        isOpen={isNewBatchOpen}
        onClose={() => setIsNewBatchOpen(false)}
        onBatchCreated={loadQueues}
      />
    </div>
  );
};
