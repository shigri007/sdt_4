
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: LucideIcon;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  trend?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  icon: Icon,
  variant = 'default',
}) => {
  const accentClasses = {
    default: 'text-slate-900 border-slate-200 bg-white',
    success: 'text-emerald-700 border-emerald-200/80 bg-white',
    warning: 'text-amber-700 border-amber-200/80 bg-white',
    danger: 'text-rose-700 border-rose-200/80 bg-white',
    info: 'text-sky-700 border-sky-200/80 bg-white',
  }[variant];

  const iconBgClasses = {
    default: 'bg-slate-100 text-slate-700',
    success: 'bg-emerald-50 text-emerald-600',
    warning: 'bg-amber-50 text-amber-600',
    danger: 'bg-rose-50 text-rose-600',
    info: 'bg-sky-50 text-sky-600',
  }[variant];

  return (
    <div className={`p-4 rounded-xl border shadow-xs transition-shadow hover:shadow-sm ${accentClasses}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        {Icon && (
          <div className={`p-1.5 rounded-lg ${iconBgClasses}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
          {value}
        </span>
      </div>
      {subtext && <div className="text-[11px] text-slate-500 mt-1">{subtext}</div>}
    </div>
  );
};
