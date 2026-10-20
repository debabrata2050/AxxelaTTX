'use client';

import React from 'react';
import { useTradeStore } from '@/store/useTradeStore';
import { apiClient } from '@/lib/apiClient';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const BasketBar: React.FC = () => {
  const {
    routes,
    selectedContracts,
    allLoadedContracts,
    allocations,
    priceMode,
    currentStep,
    setStep,
    showAlert,
  } = useTradeStore();

  const totalLots = Object.values(allocations).reduce((sum, a) => {
    return sum + (a.selected ? Number(a.transfer_qty) || 0 : 0);
  }, 0);

  const priceLabel =
    priceMode === 'price' ? 'Market' : priceMode === 'settle' ? 'Settle' : 'Fixed';

  const uniqueSenders = Array.from(new Set(routes.map((r) => r.from)));
  const unfulfilledSenders = uniqueSenders.filter((s) => {
    return !selectedContracts.some((key) => {
      const item = allLoadedContracts[key];
      if (item?.account) return item.account.toUpperCase() === s.toUpperCase();
      if (key.includes('::')) return key.split('::')[0].toUpperCase() === s.toUpperCase();
      return false;
    });
  });

  const canProceed =
    (currentStep === 1 && routes.length > 0) ||
    (currentStep === 2 && selectedContracts.length > 0 && unfulfilledSenders.length === 0) ||
    (currentStep === 3 && totalLots > 0);

  if (currentStep === 0 || currentStep === 4) return null;

  const handleContinue = () => {
    if (currentStep === 1) {
      if (routes.length === 0) {
        showAlert('Route Required', 'Please configure at least one transfer route.');
        return;
      }
      setStep(2);
    } else if (currentStep === 2) {
      if (selectedContracts.length === 0) {
        showAlert('Contracts Required', 'Please select at least one contract to transfer.');
        return;
      }
      if (unfulfilledSenders.length > 0) {
        showAlert(
          'Missing Contract Selection',
          `Each sender account requires at least one contract.\n\nMissing: ${unfulfilledSenders.join(', ')}`
        );
        return;
      }
      const senders = Array.from(new Set(routes.map((r) => r.from.trim().toUpperCase())));
      apiClient.getTrades(
        senders,
        selectedContracts,
        selectedContracts.length > 0 ? 'ALL' : useTradeStore.getState().selectedProduct
      ).catch(() => {});
      setStep(3);
    } else if (currentStep === 3) {
      if (totalLots <= 0) {
        showAlert('Allocation Required', 'Please allocate at least one lot to transfer.');
        return;
      }
      setStep(4);
    }
  };

  return (
    <div className="sticky bottom-0 left-0 right-0 z-20 px-4 sm:px-8 py-3 bg-card/95 backdrop-blur-md border-t border-border shadow-2xl flex flex-wrap items-center justify-between gap-3 transition">
      <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs font-mono">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Routes:</span>
          <Badge variant="gold" className="text-[11px] px-2 py-0">
            {routes.length} paired
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Contracts:</span>
          <Badge variant="gold" className="text-[11px] px-2 py-0">
            {selectedContracts.length} selected
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Transfer Lots:</span>
          <Badge variant="gold" className="text-[11px] px-2 py-0 font-bold">
            {totalLots.toLocaleString()} Lots
          </Badge>
        </div>
        <div className="hidden sm:flex items-center gap-1.5">
          <span className="text-muted-foreground">Price Rule:</span>
          <Badge variant="secondary" className="text-[11px] px-2 py-0">
            {priceLabel}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setStep(currentStep - 1)}
          className="pill-btn-secondary text-xs cursor-pointer"
        >
          Back
        </button>
        <Button
          variant="gold"
          size="pill"
          onClick={handleContinue}
          disabled={!canProceed}
          className="gap-2 cursor-pointer"
        >
          <span>Continue</span>
          <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
};
