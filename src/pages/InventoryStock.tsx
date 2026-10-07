// Zero arbitrary duplicated counts; strictly derived from kit records

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api.js';
import { StatCard } from '../components/StatCard.js';
import { Boxes, CheckCircle2, ShieldAlert, Layers, Truck, AlertTriangle } from 'lucide-react';

export const InventoryStock: React.FC = () => {
  const inventoryQuery = useQuery({
    queryKey: ['inventory-summary'],
    queryFn: async () => (await api.getInventorySummary()).data,
  });
  const summary = inventoryQuery.data ?? [];
  const isLoading = inventoryQuery.isLoading;

  const totalStock = summary.reduce((acc, curr) => acc + curr.totalStock, 0);
  const totalAvailable = summary.reduce((acc, curr) => acc + curr.available, 0);
  const totalProcessing = summary.reduce((acc, curr) => acc + curr.processing, 0);
  const totalQuarantined = summary.reduce((acc, curr) => acc + curr.quarantined, 0);
  const totalInCirculation = summary.reduce((acc, curr) => acc + curr.inCirculation, 0);
  const totalExpired = summary.reduce((acc, curr) => acc + curr.expired, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Derived Inventory & Stock Availability
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          All numbers are mathematically derived from primary kit state records. Zero manual stock inflation.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <StatCard label="Total Physical Kits" value={totalStock} icon={Boxes} variant="default" />
        <StatCard label="Available for Dispatch" value={totalAvailable} icon={CheckCircle2} variant="success" />
        <StatCard label="In Reprocessing Bay" value={totalProcessing} icon={Layers} variant="info" />
        <StatCard label="Quarantined" value={totalQuarantined} icon={ShieldAlert} variant="danger" />
        <StatCard label="In Circulation (OR/ER)" value={totalInCirculation} icon={Truck} variant="default" />
        <StatCard label="Sterility Expired" value={totalExpired} icon={AlertTriangle} variant={totalExpired > 0 ? 'warning' : 'default'} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Stock Availability Breakdown by Surgical Kit Category
          </span>
          <span className="text-[11px] text-slate-500 font-mono">Real-time counts</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Kit Type & Code</th>
                <th className="py-3 px-4">Surgical Discipline</th>
                <th className="py-3 px-4 text-center">Total Registered</th>
                <th className="py-3 px-4 text-center text-emerald-700">Available Ready</th>
                <th className="py-3 px-4 text-center text-sky-700">In Reprocessing</th>
                <th className="py-3 px-4 text-center text-rose-700">Quarantined</th>
                <th className="py-3 px-4 text-center text-slate-700">In Procedure / Dispatched</th>
                <th className="py-3 px-4 text-right">Availability Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                    Deriving inventory counts from primary records...
                  </td>
                </tr>
              ) : (
                summary.map((item) => (
                  <tr key={item.kitTypeId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-sans">
                      <div className="font-bold text-slate-900">{item.kitTypeName}</div>
                      <div className="font-mono text-[10px] text-slate-400">{item.kitTypeCode}</div>
                    </td>

                    <td className="py-3 px-4 font-sans text-slate-600">
                      {item.category}
                    </td>

                    <td className="py-3 px-4 text-center font-bold text-slate-800">
                      {item.totalStock}
                    </td>

                    <td className="py-3 px-4 text-center font-bold text-emerald-700 bg-emerald-50/30">
                      {item.available}
                    </td>

                    <td className="py-3 px-4 text-center font-semibold text-sky-700">
                      {item.processing}
                    </td>

                    <td className="py-3 px-4 text-center font-semibold text-rose-700">
                      {item.quarantined}
                    </td>

                    <td className="py-3 px-4 text-center text-slate-700">
                      {item.inCirculation}
                    </td>

                    <td className="py-3 px-4 text-right font-sans">
                      {item.available >= 2 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Optimal Stock
                        </span>
                      ) : item.available === 1 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                          <AlertTriangle className="w-3.5 h-3.5" /> Low Availability
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700">
                          <ShieldAlert className="w-3.5 h-3.5" /> Depleted / Zero Ready
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
