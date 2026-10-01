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
import { Loader2, CheckCircle2, Circle, XCircle } from 'lucide-react';

export default function WizardPage() {
  const {
    currentStep,
    setStep,
    resetSession,
    isLoading,
    loadingTitle,
    loadingSubtitle,
    loadingSteps,
    loadingProgress,
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

      {/* Global Loading Overlay with Step-by-Step Progress */}
      {isLoading && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          {loadingSteps && loadingSteps.length > 0 ? (
            <div className="p-6 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-card)] shadow-2xl flex flex-col gap-4 w-full max-w-md">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-[var(--text-main)] flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-[var(--accent-gold)] animate-spin" />
                    <span>{loadingTitle || 'Processing Trade Data...'}</span>
                  </h4>
                  {loadingSubtitle && (
                    <p className="text-xs text-[var(--text-muted)] font-mono truncate max-w-[280px]">
                      {loadingSubtitle}
                    </p>
                  )}
                </div>
                <span className="text-xs font-mono font-bold text-[var(--accent-gold)] px-2.5 py-0.5 rounded-md bg-[var(--accent-gold)]/10 border border-[var(--accent-gold)]/20">
                  {Math.round(loadingProgress)}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-[var(--input-bg)] rounded-full h-2 overflow-hidden border border-[var(--border-card)]">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 via-[var(--accent-gold)] to-emerald-400 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, loadingProgress))}%` }}
                />
              </div>

              {/* Step by Step Progress Items */}
              <div className="space-y-2 pt-1">
                {loadingSteps.map((step, idx) => {
                  const isDone = step.status === 'completed';
                  const isActive = step.status === 'in_progress';
                  const isError = step.status === 'error';

                  return (
                    <div
                      key={step.id || idx}
                      className={`flex items-center gap-3 p-2.5 rounded-xl text-xs transition border ${
                        isDone
                          ? 'bg-emerald-500/5 border-emerald-500/20 text-[var(--text-main)]'
                          : isActive
                          ? 'bg-[var(--accent-gold)]/10 border-[var(--accent-gold)]/30 text-[var(--accent-gold)] font-medium'
                          : isError
                          ? 'bg-red-500/10 border-red-500/20 text-red-400'
                          : 'border-transparent text-[var(--text-muted)] opacity-50'
                      }`}
                    >
                      <div className="flex-shrink-0">
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : isActive ? (
                          <Loader2 className="w-4 h-4 text-[var(--accent-gold)] animate-spin" />
                        ) : isError ? (
                          <XCircle className="w-4 h-4 text-red-400" />
                        ) : (
                          <Circle className="w-4 h-4 text-[var(--text-muted)] opacity-40" />
                        )}
                      </div>
                      <span className="flex-1 font-mono text-[11px] leading-tight">
                        {step.label}
                      </span>
                      {isDone && (
                        <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider font-mono">
                          Done
                        </span>
                      )}
                      {isActive && (
                        <span className="text-[10px] text-[var(--accent-gold)] font-bold uppercase tracking-wider font-mono animate-pulse">
                          Running
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-card)] shadow-2xl flex flex-col items-center gap-3 max-w-sm text-center">
              <Loader2 className="w-8 h-8 text-[var(--accent-gold)] animate-spin" />
              <h4 className="text-sm font-bold text-[var(--text-main)]">{loadingTitle}</h4>
              {loadingSubtitle && (
                <p className="text-xs text-[var(--text-muted)] font-mono">{loadingSubtitle}</p>
              )}
            </div>
          )}
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
