'use client';

import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'gold' | 'emerald' | 'amber';
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtext,
  icon,
  variant = 'default',
  className = '',
}) => {
  const variantStyles = {
    default: 'border-[var(--border-card)] bg-[var(--card-bg)] text-[var(--text-main)]',
    gold: 'border-[var(--accent-gold)]/40 bg-[var(--accent-gold)]/5 text-[var(--accent-gold)]',
    emerald: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400',
    amber: 'border-amber-500/30 bg-amber-500/5 text-amber-400',
  };

  const iconBgStyles = {
    default: 'bg-[var(--input-bg)] text-[var(--text-muted)]',
    gold: 'bg-[var(--accent-gold)]/15 text-[var(--accent-gold)]',
    emerald: 'bg-emerald-500/15 text-emerald-400',
    amber: 'bg-amber-500/15 text-amber-400',
  };

  return (
    <div
      className={`p-4 sm:p-5 rounded-2xl border shadow-sm flex items-center justify-between gap-4 transition ${variantStyles[variant]} ${className}`}
    >
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {label}
        </p>
        <p className="text-2xl font-black font-mono tracking-tight text-[var(--text-main)]">
          {value}
        </p>
        {subtext && <p className="text-[11px] text-[var(--text-muted)]">{subtext}</p>}
      </div>
      {icon && (
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBgStyles[variant]}`}>
          {icon}
        </div>
      )}
    </div>
  );
};
