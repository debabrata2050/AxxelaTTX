'use client';

import React from 'react';
import { useStoneXStore } from '@/store/useStoneXStore';
import {
  FileSpreadsheet,
  Layers,
  Calendar,
  Scale,
  Download,
  ChevronRight,
  ChevronLeft,
  Check,
} from 'lucide-react';

const STEPS = [
  { step: 0, title: 'CSV Source', short: 'File', icon: FileSpreadsheet },
  { step: 1, title: 'Products', short: 'Products', icon: Layers },
  { step: 2, title: 'Contracts', short: 'Contracts', icon: Calendar },
  { step: 3, title: 'Netting Audit', short: 'Audit', icon: Scale },
  { step: 4, title: 'Review & Export', short: 'Export', icon: Download },
];

export const StoneXStepper: React.FC = () => {
  const currentStep = useStoneXStore((s) => s.currentStep);
  const setStep = useStoneXStore((s) => s.setStep);
  const canProceedToStep = useStoneXStore((s) => s.canProceedToStep);
  const summary = useStoneXStore((s) => s.summary);

  if (!summary && currentStep === 0) {
    return null;
  }

  return (
    <div className="p-3 sm:p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-card)] shadow-xs">
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 sm:pb-0">
        {STEPS.map((s, idx) => {
          const Icon = s.icon;
          const isActive = currentStep === s.step;
          const isDone = currentStep > s.step;
          const check = canProceedToStep(s.step);
          const isClickable = check.allowed;

          return (
            <React.Fragment key={s.step}>
              <button
                type="button"
                onClick={() => isClickable && setStep(s.step)}
                disabled={!isClickable}
                title={!isClickable ? check.reason : `Go to Step ${s.step}: ${s.title}`}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[var(--accent-gold)] text-black font-bold shadow-xs'
                    : isDone
                    ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15 border border-emerald-500/20'
                    : isClickable
                    ? 'text-[var(--text-muted)] hover:text-white hover:bg-white/5'
                    : 'text-[var(--text-muted)] opacity-35 cursor-not-allowed'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-mono font-bold shrink-0 ${
                    isActive
                      ? 'bg-black text-[var(--accent-gold)]'
                      : isDone
                      ? 'bg-emerald-500 text-black'
                      : 'bg-white/5 text-[var(--text-muted)]'
                  }`}
                >
                  {isDone ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : s.step}
                </div>

                <div className="min-w-0">
                  <span className="text-xs font-mono tracking-tight block truncate">
                    {s.title}
                  </span>
                </div>
              </button>

              {idx < STEPS.length - 1 && (
                <div className="hidden md:flex items-center text-[var(--border-card)] shrink-0">
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted)] opacity-40" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
