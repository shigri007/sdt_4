
import React from 'react';
import { KitStatusCode, PriorityCode } from '../types/index.js';

interface StatusBadgeProps {
  status: KitStatusCode | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  switch (status) {
    case 'AVAILABLE':
      return (
        <span className={`inline-flex items-center font-medium rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
          Available
        </span>
      );
    case 'QUARANTINED':
      return (
        <span className={`inline-flex items-center font-medium rounded-md bg-rose-50 text-rose-700 border border-rose-200/80 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5" />
          Quarantined
        </span>
      );
    case 'PROCESSING':
      return (
        <span className={`inline-flex items-center font-medium rounded-md bg-sky-50 text-sky-700 border border-sky-200/80 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mr-1.5 animate-pulse" />
          In Sterilizer
        </span>
      );
    case 'AWAITING_QC':
      return (
        <span className={`inline-flex items-center font-medium rounded-md bg-amber-50 text-amber-700 border border-amber-200/80 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
          Awaiting QC
        </span>
      );
    case 'QC_APPROVED':
      return (
        <span className={`inline-flex items-center font-medium rounded-md bg-teal-50 text-teal-700 border border-teal-200/80 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mr-1.5" />
          QC Approved
        </span>
      );
    case 'RETURNED':
      return (
        <span className={`inline-flex items-center font-medium rounded-md bg-slate-100 text-slate-700 border border-slate-300 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500 mr-1.5" />
          Returned
        </span>
      );
    case 'RECEIVED':
      return (
        <span className={`inline-flex items-center font-medium rounded-md bg-blue-50 text-blue-700 border border-blue-200 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5" />
          Received
        </span>
      );
    case 'CLEANING':
      return (
        <span className={`inline-flex items-center font-medium rounded-md bg-cyan-50 text-cyan-700 border border-cyan-200 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 mr-1.5" />
          Cleaning
        </span>
      );
    case 'INSPECTION':
      return (
        <span className={`inline-flex items-center font-medium rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-1.5" />
          Inspection
        </span>
      );
    case 'PACKING':
      return (
        <span className={`inline-flex items-center font-medium rounded-md bg-purple-50 text-purple-700 border border-purple-200 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mr-1.5" />
          Packing
        </span>
      );
    case 'DISPATCHED':
      return (
        <span className={`inline-flex items-center font-medium rounded-md bg-teal-50 text-teal-700 border border-teal-200 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mr-1.5" />
          Dispatched
        </span>
      );
    case 'RECEIVED_BY_DEPT':
      return (
        <span className={`inline-flex items-center font-medium rounded-md bg-blue-50 text-blue-800 border border-blue-200 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mr-1.5" />
          Received at Dept
        </span>
      );
    case 'EXPIRED':
      return (
        <span className={`inline-flex items-center font-medium rounded-md bg-red-50 text-red-700 border border-red-200 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-red-600 mr-1.5" />
          Expired
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center font-medium rounded-md bg-slate-100 text-slate-700 border border-slate-200 ${sizeClasses}`}>
          {status}
        </span>
      );
  }
};

interface PriorityBadgeProps {
  priority: PriorityCode | string;
  size?: 'sm' | 'md';
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, size = 'md' }) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  switch (priority) {
    case 'URGENT':
      return (
        <span className={`inline-flex items-center font-semibold rounded-md bg-rose-50 text-rose-700 border border-rose-200/90 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-600 mr-1.5 animate-pulse" />
          Urgent
        </span>
      );
    case 'HIGH':
      return (
        <span className={`inline-flex items-center font-medium rounded-md bg-amber-50 text-amber-800 border border-amber-200 ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
          High
        </span>
      );
    case 'ROUTINE':
    default:
      return (
        <span className={`inline-flex items-center font-medium rounded-md bg-slate-100 text-slate-700 border border-slate-200 ${sizeClasses}`}>
          Routine
        </span>
      );
  }
};
