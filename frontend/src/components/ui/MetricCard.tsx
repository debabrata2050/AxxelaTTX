'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

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
    default:
      'border-slate-200 dark:border-border bg-white dark:bg-card/80 text-slate-900 dark:text-foreground hover:border-slate-300 dark:hover:border-border/80 shadow-xs hover:shadow-md',
    gold: 'border-amber-200 dark:border-amber-400/30 bg-amber-50/40 dark:bg-amber-400/5 text-amber-900 dark:text-amber-300 hover:border-amber-300 dark:hover:border-amber-400/50 shadow-xs hover:shadow-md',
    emerald:
      'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-500/5 text-emerald-900 dark:text-emerald-300 hover:border-emerald-300 dark:hover:border-emerald-500/50 shadow-xs hover:shadow-md',
    amber:
      'border-amber-200 dark:border-amber-500/30 bg-amber-50/40 dark:bg-amber-500/5 text-amber-900 dark:text-amber-300 hover:border-amber-300 dark:hover:border-amber-500/50 shadow-xs hover:shadow-md',
  };

  const iconBgStyles = {
    default: 'bg-slate-100 dark:bg-muted text-slate-600 dark:text-muted-foreground',
    gold: 'bg-amber-100/90 text-amber-800 dark:bg-amber-400/15 dark:text-amber-400',
    emerald: 'bg-emerald-100/90 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400',
    amber: 'bg-amber-100/90 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400',
  };

  return (
    <Card
      className={cn(
        'p-4 sm:p-5 flex items-center justify-between gap-4 transition-all duration-200 hover:-translate-y-0.5',
        variantStyles[variant],
        className
      )}
    >
      <div className="flex flex-col gap-1 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-muted-foreground truncate">
          {label}
        </p>
        <p className="text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-foreground truncate">
          {value}
        </p>
        {subtext && (
          <p className="text-[11px] text-slate-500 dark:text-muted-foreground truncate">{subtext}</p>
        )}
      </div>
      {icon && (
        <div
          className={cn(
            'size-11 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 shadow-2xs',
            iconBgStyles[variant]
          )}
        >
          {icon}
        </div>
      )}
    </Card>
  );
};
