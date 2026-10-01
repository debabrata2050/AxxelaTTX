'use client';

import React from 'react';
import { useTradeStore } from '@/store/useTradeStore';
import { ArrowRight } from 'lucide-react';

export const BasketBar: React.FC = () => {
  const { routes, selectedContracts, allocations, priceMode, currentStep, setStep } =
    useTradeStore();

  const totalLots = Object.values(allocations).reduce((sum, a) => {
    return sum + (a.selected ? Number(a.transfer_qty) || 0 : 0);
  }, 0);

  const priceLabel =
    priceMode === 'price' ? 'Market' : priceMode === 'settle' ? 'Settle' : 'Fixed';

  const canProceed =
    (currentStep === 1 && routes.length > 0) ||
    (currentStep === 2 && selectedContracts.length > 0) ||
    (currentStep === 3 && totalLots > 0);

  if (currentStep === 0 || currentStep === 4) return null;

  return (
    <div className="sticky bottom-0 left-0 right-0 z-20 px-4 sm:px-8 py-3 bg-[var(--card-bg)]/95 backdrop-blur-md border-t border-[var(--border-card)] shadow-2xl flex flex-wrap items-center justify-between gap-3 transition">
      <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs font-mono">
        <div>
          <span className="text-[var(--text-muted)]">Routes: </span>
          <strong className="text-[var(--accent-gold)]">{routes.length} paired</strong>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">Contracts: </span>
          <strong className="text-[var(--accent-gold)]">{selectedContracts.length} selected</strong>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">Transfer Lots: </span>
          <strong className="text-[var(--accent-gold)]">{totalLots.toLocaleString()} Lots</strong>
        </div>
        <div className="hidden sm:inline-block">
          <span className="text-[var(--text-muted)]">Price Rule: </span>
          <strong className="text-[var(--text-main)]">{priceLabel}</strong>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setStep(currentStep + 1)}
          disabled={!canProceed}
          className="pill-btn-primary text-xs py-2 px-5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span>Continue</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
