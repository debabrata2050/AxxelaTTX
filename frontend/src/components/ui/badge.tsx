import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-mono font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 select-none shadow-2xs',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary:
          'bg-slate-100 text-slate-700 border border-slate-200/80 dark:bg-secondary dark:text-secondary-foreground dark:border-border/50',
        destructive:
          'bg-red-50 text-red-700 border border-red-200 dark:bg-destructive/15 dark:text-destructive dark:border-destructive/30',
        outline:
          'border border-slate-200 text-slate-600 dark:border-border dark:text-muted-foreground',
        gold: 'bg-amber-500/12 text-amber-900 border border-amber-300/80 font-semibold dark:bg-amber-400/15 dark:text-amber-300 dark:border-amber-400/30',
        emerald:
          'bg-emerald-500/12 text-emerald-900 border border-emerald-300/80 font-semibold dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
        sky: 'bg-sky-500/12 text-sky-900 border border-sky-300/80 font-semibold dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30',
        indigo:
          'bg-indigo-500/12 text-indigo-900 border border-indigo-300/80 font-semibold dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30',
        amber:
          'bg-amber-500/12 text-amber-900 border border-amber-300/80 font-semibold dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
