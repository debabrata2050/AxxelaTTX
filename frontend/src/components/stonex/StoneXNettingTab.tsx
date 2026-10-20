'use client';

import React from 'react';
import { useStoneXStore } from '@/store/useStoneXStore';
import { StoneXStep0File } from '@/components/stonex/StoneXStep0File';
import { StoneXStep1Products } from '@/components/stonex/StoneXStep1Products';
import { StoneXStep2Contracts } from '@/components/stonex/StoneXStep2Contracts';
import { StoneXStep3Audit } from '@/components/stonex/StoneXStep3Audit';
import { StoneXStep4Export } from '@/components/stonex/StoneXStep4Export';
import {
  Scale,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';

export const StoneXNettingTab: React.FC = () => {
  const currentStep = useStoneXStore((s) => s.currentStep);
  const summary = useStoneXStore((s) => s.summary);
  const resetAll = useStoneXStore((s) => s.resetAll);
  const errorMessage = useStoneXStore((s) => s.errorMessage);
  const setError = useStoneXStore((s) => s.setError);

  return (
    <div className="space-y-5">
      {/* ── Top Header Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent-gold)]/10 text-[var(--accent-gold)] flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">
              StoneX Netting
            </h1>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1 font-mono">
            Consolidate zero-delta internal sub-account positions into clearing account LCE30553.
          </p>
        </div>

        {summary && (
          <button
            type="button"
            onClick={resetAll}
            className="px-4 py-2 rounded-xl text-xs font-mono font-medium text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition flex items-center gap-2 cursor-pointer self-start sm:self-auto"
            title="Upload a new positions file"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Upload New CSV</span>
          </button>
        )}
      </div>

      {/* ── Notification Banners ── */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span className="flex-1 font-mono">{errorMessage}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-400 hover:text-foreground cursor-pointer px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Step Views ── */}
      <div className="min-h-[400px]">
        {currentStep === 0 && <StoneXStep0File />}
        {currentStep === 1 && <StoneXStep1Products />}
        {currentStep === 2 && <StoneXStep2Contracts />}
        {currentStep === 3 && <StoneXStep3Audit />}
        {currentStep === 4 && <StoneXStep4Export />}
      </div>
    </div>
  );
};
