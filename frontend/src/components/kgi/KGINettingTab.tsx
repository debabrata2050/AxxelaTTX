'use client';

import React from 'react';
import { useKGIStore } from '@/store/useKGIStore';
import { KGIStep0File } from '@/components/kgi/KGIStep0File';
import { KGIStep1Products } from '@/components/kgi/KGIStep1Products';
import { KGIStep2Contracts } from '@/components/kgi/KGIStep2Contracts';
import { KGIStep3Audit } from '@/components/kgi/KGIStep3Audit';
import { KGIStep4Export } from '@/components/kgi/KGIStep4Export';
import {
  Layers,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

export const KGINettingTab: React.FC = () => {
  const currentStep = useKGIStore((s) => s.currentStep);
  const summary = useKGIStore((s) => s.summary);
  const resetAll = useKGIStore((s) => s.resetAll);
  const errorMessage = useKGIStore((s) => s.errorMessage);
  const successMessage = useKGIStore((s) => s.successMessage);
  const setError = useKGIStore((s) => s.setError);
  const setSuccess = useKGIStore((s) => s.setSuccess);

  return (
    <div className="space-y-5">
      {/* ── Top Header Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">
              KGI Netting
            </h1>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1 font-mono">
            Consolidate zero-delta institutional positions into clearing account KT513Z.
          </p>
        </div>

        {summary && (
          <button
            type="button"
            onClick={resetAll}
            className="px-4 py-2 rounded-xl text-xs font-mono font-medium text-[var(--text-muted)] hover:text-white hover:bg-white/5 border border-[var(--border-card)] transition flex items-center gap-2 cursor-pointer self-start sm:self-auto"
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
            className="text-rose-400 hover:text-white cursor-pointer px-1"
          >
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span className="flex-1 font-mono">{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccess(null)}
            className="text-emerald-400 hover:text-white cursor-pointer px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Step Views (No Stepper Nav Bar per user preference) ── */}
      <div className="min-h-[400px]">
        {currentStep === 0 && <KGIStep0File />}
        {currentStep === 1 && <KGIStep1Products />}
        {currentStep === 2 && <KGIStep2Contracts />}
        {currentStep === 3 && <KGIStep3Audit />}
        {currentStep === 4 && <KGIStep4Export />}
      </div>
    </div>
  );
};
