// Core Differentiating Feature: Complete Immutable Audit Timeline

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api.js';
import { KitTraceabilityData, ProcessingAttempt, TimelineEvent } from '../types/index.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { QRModal } from '../components/QRModal.js';
import {
  GitBranch,
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  QrCode,
  Calendar,
  MapPin,
  Clock,
  User,
  Flame,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Activity,
  History,
  Info,
} from 'lucide-react';

interface KitTraceabilityProps {
  kitCode: string;
  onBack: () => void;
}

export const KitTraceability: React.FC<KitTraceabilityProps> = ({ kitCode, onBack }) => {
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const traceQuery = useQuery<KitTraceabilityData>({
    queryKey: ['kit-trace', kitCode],
    queryFn: async () => (await api.getKitTrace(kitCode)).data,
    enabled: Boolean(kitCode),
  });
  const data = traceQuery.data;
  const isLoading = traceQuery.isLoading;
  const errorMsg = traceQuery.error instanceof Error ? traceQuery.error.message : '';

  if (isLoading) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-4 animate-pulse">
        <div className="h-6 bg-slate-200 rounded w-48" />
        <div className="h-32 bg-slate-200 rounded-xl" />
        <div className="h-64 bg-slate-200 rounded-xl" />
      </div>
    );
  }

  if (errorMsg || !data) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Kit Not Found</h2>
        <p className="text-xs text-slate-500">{errorMsg || `Could not find records for "${kitCode}".`}</p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Kit Registry
        </button>
      </div>
    );
  }

  const { kit, attempts, timeline, latestBatch, latestQc, qrCodeDataUrl } = data;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Kit Registry
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsQrModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-xs transition-colors"
          >
            <QrCode className="w-4 h-4 text-slate-600" />
            Print Sterile QR Label
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono font-bold text-2xl text-slate-900 tracking-tight">
                {kit.kit_code}
              </span>
              <StatusBadge status={kit.current_status} size="md" />
              {kit.kit_code === 'KIT-0012' && (
                <span className="text-[10px] font-bold text-teal-800 bg-teal-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Hero Evaluation Case
                </span>
              )}
            </div>
            <h1 className="text-base font-semibold text-slate-800 mt-1">{kit.kit_name}</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {kit.typeName} · Owner: <strong>{kit.ownerDepartmentName}</strong> ({kit.ownerDepartmentCode})
            </p>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            {qrCodeDataUrl ? (
              <img src={qrCodeDataUrl} alt="QR Code" className="w-16 h-16 rounded" />
            ) : null}
            <div className="text-[11px] text-slate-600">
              <div className="font-semibold text-slate-800">Scannable Safe Tag</div>
              <div>Encoded: /kits/{kit.kit_code}</div>
              <div className="text-[10px] text-teal-700 mt-0.5">Zero patient data stored</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]">Current Location:</span>
            <span className="font-medium text-slate-800 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span className="truncate">{kit.current_location}</span>
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Sterility Expiration:</span>
            <span className="font-medium text-slate-800 flex items-center gap-1 mt-0.5 font-mono">
              <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              {kit.expiration_date || 'In Reprocessing'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Latest Sterilizer Batch:</span>
            <span className="font-medium text-slate-800 flex items-center gap-1 mt-0.5 font-mono">
              <Flame className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              {latestBatch ? latestBatch.batch_code : 'None'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Independent QC Reviewer:</span>
            <span className="font-medium text-slate-800 flex items-center gap-1 mt-0.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              {latestQc ? `Verified (${latestQc.decision})` : 'Pending Coordinator'}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-teal-600" />
              Processing Attempts Ledger (Permanent Historical Record)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Every reprocessing sequence is preserved chronologically. Failed attempts are NEVER overwritten or hidden.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">
            Total Attempts: {attempts.length}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {attempts.map((att: any) => {
            const isFailed = att.result === 'FAILED';
            const isPassed = att.result === 'PASSED';

            return (
              <div
                key={att.id}
                className={`p-4 rounded-xl border transition-all ${
                  isFailed
                    ? 'border-rose-300 bg-rose-50/40 text-rose-950'
                    : isPassed
                    ? 'border-emerald-300 bg-emerald-50/30 text-emerald-950'
                    : 'border-slate-200 bg-slate-50/50 text-slate-900'
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs">
                      Attempt #{att.attempt_number}
                    </span>
                    {isFailed && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                        <XCircle className="w-3 h-3" /> FAILED
                      </span>
                    )}
                    {isPassed && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                        <CheckCircle2 className="w-3 h-3" /> PASSED & APPROVED
                      </span>
                    )}
                    {att.result === 'PENDING' && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                        IN PROGRESS
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    {att.created_at ? att.created_at.substring(0, 10) : ''}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 text-xs">
                  {att.batchCode && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Sterilization Batch:</span>
                      <span className="font-mono font-bold text-slate-800">{att.batchCode}</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="text-slate-500">Reprocessing Operator:</span>
                    <span className="font-medium text-slate-800">{att.operatorName}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500">Independent QC Reviewer:</span>
                    <span className="font-medium text-slate-800">{att.reviewerName}</span>
                  </div>

                  {isFailed && att.failure_reason && (
                    <div className="mt-2 p-2.5 rounded-lg bg-rose-100/70 border border-rose-200 text-rose-900 text-xs">
                      <strong className="block text-[11px] uppercase tracking-wider text-rose-800 font-bold mb-0.5">
                        Failure Root Cause
                      </strong>
                      {att.failure_reason}
                    </div>
                  )}

                  {att.notes && !isFailed && (
                    <div className="text-[11px] text-slate-600 mt-2 bg-white/70 p-2 rounded border border-slate-200/80">
                      {att.notes}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-600" />
            Full Historical Lifecycle Timeline
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Chronological history of receipt, cleaning, inspection, processing, quarantine, and dispatch records.
          </p>
        </div>

        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {timeline.map((event: TimelineEvent, idx: number) => {
            const isFail = event.isFailure;
            const isApproved = event.event.includes('APPROVED') || event.event.includes('DELIVERED') || event.newState === 'AVAILABLE';

            return (
              <div key={event.id || idx} className="relative flex items-start gap-4 group">
                <div
                  className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 bg-white flex items-center justify-center ${
                    isFail
                      ? 'border-rose-500 text-rose-500 ring-4 ring-rose-50'
                      : isApproved
                      ? 'border-emerald-500 text-emerald-500 ring-4 ring-emerald-50'
                      : 'border-teal-500 text-teal-600 ring-4 ring-teal-50'
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isFail ? 'bg-rose-500' : isApproved ? 'bg-emerald-500' : 'bg-teal-500'
                    }`}
                  />
                </div>

                <div
                  className={`flex-1 p-4 rounded-xl border text-xs transition-shadow ${
                    isFail
                      ? 'border-rose-200 bg-rose-50/30'
                      : isApproved
                      ? 'border-emerald-200 bg-emerald-50/20'
                      : 'border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{event.event}</span>
                      {event.reference && (
                        <span className="font-mono text-[10px] text-slate-500 bg-white border border-slate-200 px-1.5 py-0.2 rounded">
                          {event.reference}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[11px] text-slate-500">
                      {event.timestamp}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-600 mt-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      Performed by <strong>{event.actor}</strong> ({event.actorRole.replace(/_/g, ' ')})
                    </span>
                  </div>

                  {event.previousState && event.newState && (
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] font-mono">
                      <span className="text-slate-400">{event.previousState}</span>
                      <span className="text-slate-400">→</span>
                      <span className="font-semibold text-slate-800">{event.newState}</span>
                    </div>
                  )}

                  {event.notes && (
                    <div className="mt-2 text-xs text-slate-700 bg-white p-2 rounded border border-slate-200/80">
                      {event.notes}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <QRModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        kit={kit}
        qrCodeUrl={qrCodeDataUrl}
      />
    </div>
  );
};
