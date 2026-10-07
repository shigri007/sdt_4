
import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from './Modal.js';
import { Kit } from '../types/index.js';
import { api } from '../services/api.js';
import { useToast } from '../context/ToastContext.js';
import { Flame, CheckSquare, Square } from 'lucide-react';

interface NewBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBatchCreated: () => void;
}

export const NewBatchModal: React.FC<NewBatchModalProps> = ({
  isOpen,
  onClose,
  onBatchCreated,
}) => {
  const { success, error } = useToast();

  const [selectedKitIds, setSelectedKitIds] = useState<number[]>([]);
  const [sterilizerUnit, setSterilizerUnit] = useState('Autoclave Unit #1 (Steris AMSCO)');
  const [processingMethod, setProcessingMethod] = useState<'STEAM_AUTOCLAVE' | 'ETHYLENE_OXIDE' | 'VAPORIZED_HYDROGEN_PEROXIDE' | 'DRY_HEAT'>('STEAM_AUTOCLAVE');
  const [tempC, setTempC] = useState(134.0);
  const [pressurePsi, setPressurePsi] = useState(30.5);
  const [durationMins, setDurationMins] = useState(18);
  const [notes, setNotes] = useState('');
  const queryClient = useQueryClient();
  const packedKitsQuery = useQuery({
    queryKey: ['kits', 'PACKING'],
    queryFn: async () => (await api.getKits({ status: 'PACKING' })).data,
    enabled: isOpen,
  });
  const packedKits: Kit[] = packedKitsQuery.data ?? [];
  const isLoading = packedKitsQuery.isLoading;
  const createBatchMutation = useMutation({
    mutationFn: (payload: any) => api.createBatch(payload),
    onSuccess: async () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['batches'] }),
      queryClient.invalidateQueries({ queryKey: ['processing-queues'] }),
      queryClient.invalidateQueries({ queryKey: ['kits'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ]),
  });
  const isSubmitting = createBatchMutation.isPending;
  useEffect(() => {
    if (isOpen && packedKitsQuery.data) setSelectedKitIds(packedKitsQuery.data.map((kit) => kit.id));
  }, [isOpen, packedKitsQuery.data]);

  const toggleKitSelection = (id: number) => {
    setSelectedKitIds((prev) =>
      prev.includes(id) ? prev.filter((kId) => kId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedKitIds.length === packedKits.length) {
      setSelectedKitIds([]);
    } else {
      setSelectedKitIds(packedKits.map((k) => k.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedKitIds.length === 0) {
      error('Selection Required', 'You must select at least one kit in PACKING status to load into this batch.');
      return;
    }

    try {
      const res = await createBatchMutation.mutateAsync({
        sterilizerUnitId: sterilizerUnit,
        processingMethod,
        targetTemperatureC: tempC,
        targetPressurePsi: pressurePsi,
        exposureTimeMinutes: durationMins,
        kitIds: selectedKitIds,
        notes: notes.trim() || undefined,
      });

      success('Sterilization Batch Initiated', `Batch ${res.data.batch_code} started in ${sterilizerUnit}. Loaded ${selectedKitIds.length} kit(s).`);
      onBatchCreated();
      onClose();
    } catch (err: any) {
      error('Batch Creation Failed', err.message);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Initiate Sterilization Chamber Batch"
      subtitle="Load packed instrument trays into autoclave or VHP sterilizer"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Sterilizer Unit</label>
            <select
              value={sterilizerUnit}
              onChange={(e) => setSterilizerUnit(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
            >
              <option value="Autoclave Unit #1 (Steris AMSCO)">Autoclave Unit #1 (Steris AMSCO - Prevac)</option>
              <option value="Autoclave Unit #2 (Getinge GSS67)">Autoclave Unit #2 (Getinge GSS67 - Steam)</option>
              <option value="VHP Sterilizer Unit #3 (Sterrad 100NX)">VHP Low-Temp Unit #3 (Sterrad Gas Plasma)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Method</label>
            <select
              value={processingMethod}
              onChange={(e) => setProcessingMethod(e.target.value as any)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
            >
              <option value="STEAM_AUTOCLAVE">Steam Autoclave (134°C Pre-vacuum)</option>
              <option value="VAPORIZED_HYDROGEN_PEROXIDE">Vaporized Hydrogen Peroxide (VHP)</option>
              <option value="ETHYLENE_OXIDE">Ethylene Oxide (EtO)</option>
              <option value="DRY_HEAT">Dry Heat</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Plateau Temp (°C)</label>
            <input
              type="number"
              step="0.1"
              value={tempC}
              onChange={(e) => setTempC(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Chamber Pressure (psi)</label>
            <input
              type="number"
              step="0.1"
              value={pressurePsi}
              onChange={(e) => setPressurePsi(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Exposure Time (min)</label>
            <input
              type="number"
              value={durationMins}
              onChange={(e) => setDurationMins(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Select Packed Kits to Load ({selectedKitIds.length} of {packedKits.length} selected)
            </label>
            {packedKits.length > 0 && (
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] text-teal-700 hover:text-teal-800 font-medium"
              >
                {selectedKitIds.length === packedKits.length ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="p-4 text-center text-xs text-slate-400">Loading packing queue...</div>
          ) : packedKits.length === 0 ? (
            <div className="p-4 border border-dashed border-slate-300 rounded-lg text-center text-xs text-slate-500">
              No kits currently in "PACKING" status. Complete cleaning, inspection, and packaging steps in the Decontamination board first.
            </div>
          ) : (
            <div className="max-h-44 overflow-y-auto space-y-1.5 border border-slate-200 rounded-lg p-2">
              {packedKits.map((kit) => {
                const isSelected = selectedKitIds.includes(kit.id);
                return (
                  <div
                    key={kit.id}
                    onClick={() => toggleKitSelection(kit.id)}
                    className={`flex items-center justify-between p-2 rounded-md border text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-teal-500 bg-teal-50/50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-teal-600 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <div>
                        <span className="font-mono font-bold text-slate-900">{kit.kit_code}</span>
                        <span className="text-slate-600 ml-2">{kit.kit_name}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">Attempt #{kit.processing_attempt_number}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Batch Run Notes</label>
          <input
            type="text"
            placeholder="e.g. Biological test vial lot #3812 placed on bottom shelf near drain."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
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
            disabled={isSubmitting || packedKits.length === 0 || selectedKitIds.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg shadow-xs transition-colors"
          >
            <Flame className="w-4 h-4 text-teal-400" />
            {isSubmitting ? 'Starting Run...' : 'Start Sterilizer Cycle'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
