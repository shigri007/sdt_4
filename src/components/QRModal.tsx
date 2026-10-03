// ==========================================================
// SteriTrack: Printable QR Kit Tag Modal
// ==========================================================

import React from 'react';
import { Modal } from './Modal.js';
import { Printer, ShieldCheck } from 'lucide-react';
import { Kit } from '../types/index.js';

interface QRModalProps {
  isOpen: boolean;
  onClose: () => void;
  kit: Kit | null;
  qrCodeUrl: string;
}

export const QRModal: React.FC<QRModalProps> = ({ isOpen, onClose, kit, qrCodeUrl }) => {
  if (!kit) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Printable Sterile Tag & Traceability QR"
      subtitle={`Kit Identifier: ${kit.kit_code}`}
      maxWidth="md"
    >
      <div className="flex flex-col items-center">
        {/* Printable Card Area */}
        <div id="printable-qr-tag" className="w-full border-2 border-dashed border-slate-300 rounded-xl p-6 bg-slate-50 flex flex-col items-center text-center">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            SteriTrack Sterile Kit Tag
          </div>

          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs mb-3">
            {qrCodeUrl ? (
              <img src={qrCodeUrl} alt={`QR Code for ${kit.kit_code}`} className="w-44 h-44 object-contain" />
            ) : (
              <div className="w-44 h-44 flex items-center justify-center text-xs text-slate-400">Generating QR...</div>
            )}
          </div>

          <div className="font-mono font-bold text-lg text-slate-900 tracking-wide">{kit.kit_code}</div>
          <div className="text-sm font-medium text-slate-700 mt-0.5">{kit.kit_name}</div>
          <div className="text-xs text-slate-500 mt-1">
            Status: <span className="font-semibold text-slate-800">{kit.current_status}</span>
            {kit.expiration_date && ` · Exp: ${kit.expiration_date}`}
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            Scan to inspect independent QC review and sterilization cycle ledger.
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-3 w-full mt-6 pt-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print Physical Label
          </button>
        </div>
      </div>
    </Modal>
  );
};
