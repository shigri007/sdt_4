
import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { FileText, Download, Printer, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

export const Reports: React.FC = () => {
  const [reportType, setReportType] = useState('failed-attempts');
  const [reportData, setReportData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, [reportType]);

  async function loadReport() {
    try {
      setIsLoading(true);
      const res = await api.getReport(reportType);
      if (res.success) {
        setReportData(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  const exportCsv = () => {
    if (reportData.length === 0) return;

    const headers = Object.keys(reportData[0]).join(',');
    const rows = reportData.map((row) =>
      Object.values(row)
        .map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`)
        .join(',')
    );

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `steritrack-${reportType}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-600" />
            Hospital Compliance & Sterility Reports
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Exportable workflow summaries for supervisors and project review.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-xs transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
          <button
            onClick={exportCsv}
            disabled={reportData.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg shadow-xs transition-colors"
          >
            <Download className="w-4 h-4 text-teal-400" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs">
        <button
          onClick={() => setReportType('failed-attempts')}
          className={`px-3 py-1.5 font-semibold rounded-lg transition-colors whitespace-nowrap ${
            reportType === 'failed-attempts'
              ? 'bg-rose-50 text-rose-800 border border-rose-200'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Failed Processing & Lethality Exceptions
        </button>

        <button
          onClick={() => setReportType('qc-activity')}
          className={`px-3 py-1.5 font-semibold rounded-lg transition-colors whitespace-nowrap ${
            reportType === 'qc-activity'
              ? 'bg-teal-50 text-teal-800 border border-teal-200'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Independent QC Signoff Ledger
        </button>

        <button
          onClick={() => setReportType('dispatch-fulfillment')}
          className={`px-3 py-1.5 font-semibold rounded-lg transition-colors whitespace-nowrap ${
            reportType === 'dispatch-fulfillment'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Dispatch & Fulfillment Log
        </button>

        <button
          onClick={() => setReportType('kit-status')}
          className={`px-3 py-1.5 font-semibold rounded-lg transition-colors whitespace-nowrap ${
            reportType === 'kit-status'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Total Kit Inventory Status
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400">Compiling report data...</div>
          ) : reportData.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">No records found for this report.</div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {Object.keys(reportData[0]).map((col) => (
                    <th key={col} className="py-3 px-4">
                      {col.replace(/([A-Z])/g, ' $1').toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {reportData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    {Object.values(row).map((val: any, cellIdx) => (
                      <td key={cellIdx} className="py-3 px-4 text-slate-800">
                        {String(val ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
