'use client';

import React, { useState } from 'react';
import { useTradeStore } from '@/store/useTradeStore';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileDrawer } from '@/components/layout/MobileDrawer';
import { BasketBar } from '@/components/layout/BasketBar';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { FileSwitchModal } from '@/components/ui/FileSwitchModal';

import { Step0FileSelect } from '@/components/steps/Step0FileSelect';
import { Step1RouteMap } from '@/components/steps/Step1RouteMap';
import { Step2Contracts } from '@/components/steps/Step2Contracts';
import { Step3Allocations } from '@/components/steps/Step3Allocations';
import { Step4PreviewExport } from '@/components/steps/Step4PreviewExport';
import { Loader2 } from 'lucide-react';

export default function WizardPage() {
  const {
    currentStep,
    setStep,
    resetSession,
    isLoading,
    loadingTitle,
    loadingSubtitle,
    alert,
    hideAlert,
  } = useTradeStore();

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isFileSwitchModalOpen, setIsFileSwitchModalOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--canvas-bg)]">
      {/* Sidebar for Desktop / Tablet */}
      <Sidebar onResetConfirm={() => setShowResetConfirm(true)} />

      {/* Mobile Drawer */}
      <MobileDrawer onResetConfirm={() => setShowResetConfirm(true)} />

      {/* Main Workspace */}
      <main className="flex-grow flex flex-col min-w-0 h-full overflow-hidden bg-[var(--canvas-bg)]">
        {/* Header with Title Bar File Indicator, Theme Toggle, No Green Dot */}
        <Header onOpenFileModal={() => setIsFileSwitchModalOpen(true)} />

        {/* Content Area */}
        <div className="flex-grow overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <div key={currentStep} className="step-view-enter space-y-6">
              {currentStep === 0 && <Step0FileSelect />}
              {currentStep === 1 && <Step1RouteMap />}
              {currentStep === 2 && <Step2Contracts />}
              {currentStep === 3 && <Step3Allocations />}
              {currentStep === 4 && <Step4PreviewExport />}
            </div>
          </div>
        </div>

        {/* Sticky Status Basket Bar */}
        <BasketBar />
      </main>

      {/* Global Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="p-6 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-card)] shadow-2xl flex flex-col items-center gap-3 max-w-sm text-center">
            <Loader2 className="w-8 h-8 text-[var(--accent-gold)] animate-spin" />
            <h4 className="text-sm font-bold text-[var(--text-main)]">{loadingTitle}</h4>
            {loadingSubtitle && (
              <p className="text-xs text-[var(--text-muted)] font-mono">{loadingSubtitle}</p>
            )}
          </div>
        </div>
      )}

      {/* Global Alert Modal */}
      <ConfirmModal
        isOpen={alert !== null}
        title={alert?.title || 'Notice'}
        message={alert?.message || ''}
        confirmLabel="OK"
        cancelLabel=""
        isDestructive={false}
        onConfirm={hideAlert}
        onCancel={hideAlert}
      />

      {/* Reset Confirmation Modal */}
      <ConfirmModal
        isOpen={showResetConfirm}
        title="Reset Current Session?"
        message="This will discard all configured transfer pairs, contract selections, and lot allocations."
        confirmLabel="Reset Everything"
        cancelLabel="Cancel"
        isDestructive={true}
        onConfirm={() => {
          setShowResetConfirm(false);
          resetSession();
        }}
        onCancel={() => setShowResetConfirm(false)}
      />

      {/* File Switcher Modal */}
      <FileSwitchModal
        isOpen={isFileSwitchModalOpen}
        onClose={() => setIsFileSwitchModalOpen(false)}
      />
    </div>
  );
}
