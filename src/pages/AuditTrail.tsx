// ==========================================================
// SteriTrack: Append-Only Audit Trail
// Searchable application event history
// ==========================================================

import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { AuditEvent } from '../types/index.js';
import {
  History,
  Search,
  Filter,
  User,
  Activity,
  Calendar,
  Code,
  RefreshCw,
} from 'lucide-react';

export const AuditTrail: React.FC = () => {
  const [logs, setLogs] = useState<AuditEvent[]>([]);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditEvent | null>(null);

  useEffect(() => {
    loadLogs();
  }, [entityFilter]);

  async function loadLogs() {
    try {
      setIsLoading(true);
      const params: Record<string, string> = {};
      if (entityFilter) params.entityType = entityFilter;
      if (search) params.search = search;

      const res = await api.getAuditLogs(params);
      if (res.success) {
        setLogs(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadLogs();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-teal-600" />
            Hospital Compliance Audit Trail
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Searchable history of workflow transitions, priority changes, QC decisions, and user actions.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by ID, action, user, or justification..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </form>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
          >
            <option value="">All Entity Modules</option>
            <option value="KIT">Kits</option>
            <option value="BATCH">Sterilization Batches</option>
            <option value="QC_REVIEW">Quality Control Reviews</option>
            <option value="REQUEST">Clinical Requisitions</option>
            <option value="DISPATCH">Dispatches</option>
            <option value="RECEIPT">Department Receipts</option>
            <option value="USER">User Sessions</option>
          </select>

          <button
            onClick={() => {
              setSearch('');
              setEntityFilter('');
              loadLogs();
            }}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            title="Reset Filters"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Transition</th>
                <th className="py-3 px-4">Audit Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                    Loading activity history...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                    No audit records match the selected criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  let metadataObj: any = null;
                  try {
                    metadataObj = log.metadata_json ? JSON.parse(log.metadata_json) : null;
                  } catch {}

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {log.created_at}
                      </td>

                      <td className="py-3 px-4 font-sans">
                        <div className="font-semibold text-slate-900">{log.actor_name}</div>
                        <div className="text-[10px] text-slate-400 uppercase font-mono">
                          {log.actor_role.split('_')[0]}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900">{log.entity_id}</span>
                        <div className="text-[10px] text-slate-400 font-sans">{log.entity_type}</div>
                      </td>

                      <td className="py-3 px-4 font-sans font-bold text-slate-800">
                        {log.action.replace(/_/g, ' ')}
                      </td>

                      <td className="py-3 px-4 font-mono">
                        {log.previous_state && log.new_state ? (
                          <div className="text-slate-600">
                            {log.previous_state} → <strong className="text-teal-700">{log.new_state}</strong>
                          </div>
                        ) : log.new_state ? (
                          <span className="text-teal-700 font-semibold">{log.new_state}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-sans max-w-xs truncate text-slate-600">
                        {metadataObj ? (
                          <span title={JSON.stringify(metadataObj)}>
                            {metadataObj.reason || metadataObj.justification || JSON.stringify(metadataObj)}
                          </span>
                        ) : (
                          '—'
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
    </div>
  );
};
