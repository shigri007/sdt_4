// ==========================================================
// SteriTrack: Quarantine Hold Vault & Reprocessing Management
// ==========================================================

import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { QuarantineRecord, Kit } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { ReprocessModal } from '../components/ReprocessModal.js';
import {
  ShieldAlert,
  RefreshCw,
  AlertTriangle,
  History,
  CheckCircle2,
  Lock,
} from 'lucide-react';

interface QuarantineListProps {
  onSelectKitTrace?: (kitCode: string) => void;
}

export const QuarantineList: React.FC<QuarantineListProps> = ({ onSelectKitTrace }) => {
  const { hasRole } = useAuth();
  const { error } = useToast();

  const [records, setRecords] = useState<QuarantineRecord[]>([]);
  const [selectedKitForReprocess, setSelectedKitForReprocess] = useState<Kit | null>(null);
  const [isReprocessModalOpen, setIsReprocessModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadQuarantine();
  }, []);

  async function loadQuarantine() {
    try {
      setIsLoading(true);
      const res = await api.getQuarantineRecords();
      if (res.success) {
        setRecords(res.data);
      }
    } catch (err: any) {
      error('Failed to load quarantine records', err.message);
    } finally {
      setIsLoading(false);
    }
  }

  const handleStartReprocessing = async (record: QuarantineRecord) => {
    try {
      const kitRes = await api.getKitById(record.kit_id);
      if (kitRes.success) {
        setSelectedKitForReprocess(kitRes.data);
        setIsReprocessModalOpen(true);
      }
    } catch (err: any) {
      error('Failed to load kit data', err.message);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Quarantine Hold Vault
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Sequestered instruments failing visual, packaging, or biological lethality standards.
          </p>
        </div>
      </div>

      {/* Safety Invariant Banner */}
      <div className="p-4 bg-rose-50 border border-rose-200/90 rounded-xl text-xs text-rose-950 flex items-start gap-3">
        <Lock className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-rose-950">STERILITY ISOLATION LOCKOUT</div>
          <div className="mt-0.5 text-rose-800">
            Quarantined kits cannot be dispatched. Reprocessing authorization starts a new attempt while retaining the earlier failed attempt in kit history.
          </div>
        </div>
      </div>

      {/* Quarantined Records Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Quarantined Kit Inventory ({records.length})
          </span>
          <span className="text-[11px] text-slate-400 font-mono">Vault Storage Locations Q-01 / Q-02</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Kit Code</th>
                <th className="py-3 px-4">Set Description</th>
                <th className="py-3 px-4">Quarantine Root Cause</th>
                <th className="py-3 px-4">Sequestered By</th>
                <th className="py-3 px-4 text-center">Attempt #</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading quarantine vault ledger...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No kits currently quarantined in hold vaults.
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const isActive = r.status === 'ACTIVE_QUARANTINE';

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <button
                          onClick={() => onSelectKitTrace && onSelectKitTrace(r.kitCode || '')}
                          className="font-mono font-bold text-slate-900 hover:text-teal-700 flex items-center gap-1.5"
                        >
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                          {r.kitCode}
                        </button>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {r.quarantined_at ? r.quarantined_at.substring(0, 16) : ''}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-medium text-slate-800">
                        {r.kitName}
                      </td>

                      <td className="py-3 px-4 max-w-xs text-rose-900">
                        <div className="p-2 bg-rose-50 border border-rose-200/60 rounded text-[11px] leading-relaxed">
                          {r.quarantine_reason}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-700">
                        {r.quarantinedByName}
                      </td>

                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                        #{r.attempt_number}
                      </td>

                      <td className="py-3 px-4">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            Active Quarantine
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            Reprocessing Authorized
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {isActive && hasRole('QUALITY_COORDINATOR') ? (
                          <button
                            onClick={() => handleStartReprocessing(r)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
                          >
                            <RefreshCw className="w-3.5 h-3.5 text-teal-400" />
                            Start Reprocessing
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs">
                            {r.resolvedByName ? `Released by ${r.resolvedByName}` : '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reprocess Modal */}
      <ReprocessModal
        isOpen={isReprocessModalOpen}
        onClose={() => setIsReprocessModalOpen(false)}
        kit={selectedKitForReprocess}
        onReprocessStarted={loadQuarantine}
      />
    </div>
  );
};
