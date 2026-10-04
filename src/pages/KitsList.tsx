
import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { Kit, KitType, Department } from '../types/index.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { QRModal } from '../components/QRModal.js';
import { Modal } from '../components/Modal.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import {
  Search,
  Plus,
  QrCode,
  GitBranch,
  Filter,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface KitsListProps {
  onSelectKitTrace: (kitCode: string) => void;
}

export const KitsList: React.FC<KitsListProps> = ({ onSelectKitTrace }) => {
  const { hasRole } = useAuth();
  const { success, error } = useToast();

  const [kits, setKits] = useState<Kit[]>([]);
  const [kitTypes, setKitTypes] = useState<KitType[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [selectedKitForQr, setSelectedKitForQr] = useState<Kit | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New Kit Form
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newTypeId, setNewTypeId] = useState(1);
  const [newDeptId, setNewDeptId] = useState(1);
  const [newNotes, setNewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [statusFilter, typeFilter]);

  async function loadData() {
    try {
      setIsLoading(true);
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.typeId = typeFilter;
      if (search) params.search = search;

      const [kitsRes, typesRes, deptsRes] = await Promise.all([
        api.getKits(params),
        api.getKitTypes(),
        api.getDepartments(),
      ]);

      if (kitsRes.success) setKits(kitsRes.data);
      if (typesRes.success) setKitTypes(typesRes.data);
      if (deptsRes.success) setDepartments(deptsRes.data);
    } catch (err: any) {
      error('Failed to load kits', err.message);
    } finally {
      setIsLoading(false);
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleOpenQr = async (kit: Kit) => {
    setSelectedKitForQr(kit);
    try {
      const traceRes = await api.getKitTrace(kit.kit_code);
      if (traceRes.success) {
        setQrCodeUrl(traceRes.data.qrCodeDataUrl);
      }
      setIsQrModalOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateKit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await api.createKit({
        kitCode: newCode.trim(),
        kitName: newName.trim(),
        kitTypeId: newTypeId,
        departmentOwnerId: newDeptId,
        notes: newNotes.trim() || undefined,
      });

      success('Kit Registered', `Kit ${newCode} added to hospital inventory.`);
      setIsCreateModalOpen(false);
      setNewCode('');
      setNewName('');
      setNewNotes('');
      loadData();
    } catch (err: any) {
      error('Registration Failed', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Hospital Kit Registry</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Central repository of reusable surgical kits, decontamination statuses, and attempt cycles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasRole('QUALITY_COORDINATOR') && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4 text-teal-400" />
              Register New Kit
            </button>
          )}

          <button
            onClick={() => kits[0] && onSelectKitTrace(kits[0].kit_code)}
            disabled={kits.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-xs transition-colors"
          >
            <GitBranch className="w-3.5 h-3.5 text-teal-600" />
            View kit history
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by Kit ID (e.g. KIT-0012) or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </form>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
          >
            <option value="">All Operational States</option>
            <option value="AVAILABLE">Available</option>
            <option value="PROCESSING">In Chamber (Processing)</option>
            <option value="AWAITING_QC">Awaiting QC</option>
            <option value="QUARANTINED">Quarantined</option>
            <option value="PACKING">Packing</option>
            <option value="INSPECTION">Inspection</option>
            <option value="CLEANING">Cleaning</option>
            <option value="RECEIVED">Received</option>
            <option value="RETURNED">Returned</option>
            <option value="DISPATCHED">Dispatched</option>
            <option value="EXPIRED">Expired</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
          >
            <option value="">All Kit Types</option>
            {kitTypes.map((kt) => (
              <option key={kt.id} value={kt.id}>
                {kt.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              setSearch('');
              setStatusFilter('');
              setTypeFilter('');
              loadData();
            }}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            title="Reset Filters"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Kit Code</th>
                <th className="py-3 px-4">Instrument Set Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Current Location</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Attempt #</th>
                <th className="py-3 px-4">Sterility Expiration</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading hospital kit catalog...
                  </td>
                </tr>
              ) : kits.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No kits match the selected criteria.
                  </td>
                </tr>
              ) : (
                kits.map((kit) => (
                  <tr key={kit.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="py-3 px-4">
                      <button
                        onClick={() => onSelectKitTrace(kit.kit_code)}
                        className="font-mono font-bold text-slate-900 hover:text-teal-700 flex items-center gap-1.5"
                      >
                        {kit.kit_code}
                      </button>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {kit.kit_name}
                      {kit.notes && <div className="text-[10px] text-slate-400 truncate max-w-xs">{kit.notes}</div>}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{kit.typeName || 'General Set'}</td>
                    <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">{kit.current_location}</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={kit.current_status} size="sm" />
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                      #{kit.processing_attempt_number}
                      {kit.processing_attempt_number > 1 && (
                        <div className="text-[9px] text-amber-600 font-semibold">Reprocessed</div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                      {kit.expiration_date || '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenQr(kit)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                          title="Print Barcode / QR Label"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onSelectKitTrace(kit.kit_code)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                        >
                          <GitBranch className="w-3.5 h-3.5 text-teal-600" />
                          Trace
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
          <span>Showing {kits.length} instrument kits</span>
          <span>Derives live database records</span>
        </div>
      </div>

      <QRModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        kit={selectedKitForQr}
        qrCodeUrl={qrCodeUrl}
      />

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Register New Surgical Kit"
        subtitle="Catalog a new instrument set into the central repository"
        maxWidth="md"
      >
        <form onSubmit={handleCreateKit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kit Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. KIT-0021"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Kit Type</label>
              <select
                value={newTypeId}
                onChange={(e) => setNewTypeId(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
              >
                {kitTypes.map((kt) => (
                  <option key={kt.id} value={kt.id}>
                    {kt.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Kit Descriptive Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. General Surgery Laparotomy Tray #7"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Department Owner</label>
            <select
              value={newDeptId}
              onChange={(e) => setNewDeptId(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
            <input
              type="text"
              placeholder="e.g. Double SMS wrap required; titanium micro-tips."
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg shadow-xs transition-colors"
            >
              {isSubmitting ? 'Registering...' : 'Register Kit'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
