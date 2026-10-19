'use client';

import React, { useState, useEffect } from 'react';
import { useTradeStore, AppModule } from '@/store/useTradeStore';
import { useOnboardingStore } from '@/store/useOnboardingStore';
import { apiClient } from '@/lib/apiClient';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileDrawer } from '@/components/layout/MobileDrawer';
import { BasketBar } from '@/components/layout/BasketBar';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { FileSwitchModal } from '@/components/ui/FileSwitchModal';
import { FeatureHub } from '@/components/home/FeatureHub';
import { OnboardingTab, RulesModal } from '@/components/onboarding/OnboardingTab';
import { StoneXNettingTab } from '@/components/stonex/StoneXNettingTab';
import { KGINettingTab } from '@/components/kgi/KGINettingTab';

import { Step0FileSelect } from '@/components/steps/Step0FileSelect';
import { Step1RouteMap } from '@/components/steps/Step1RouteMap';
import { Step2Contracts } from '@/components/steps/Step2Contracts';
import { Step3Allocations } from '@/components/steps/Step3Allocations';
import { Step4PreviewExport } from '@/components/steps/Step4PreviewExport';
import { Loader2, CheckCircle2, Circle, XCircle, AlertTriangle, Info } from 'lucide-react';

interface WorkspaceShellProps {
  defaultModule?: AppModule;
}

export function WorkspaceShell({ defaultModule }: WorkspaceShellProps) {
  const {
    activeModule,
    setActiveModule,
    currentStep,
    setStep,
    resetSession,
    sessionId,
    sessionMismatch,
    setSessionMismatch,
    multiTabConflict,
    setMultiTabConflict,
    setActiveFile,
    isLoading,
    loadingTitle,
    loadingSubtitle,
    loadingSteps,
    loadingProgress,
    alert,
    hideAlert,
  } = useTradeStore();

  const { clearAll: clearOnboardingAll } = useOnboardingStore();

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showOnboardingResetConfirm, setShowOnboardingResetConfirm] = useState(false);
  const [isFileSwitchModalOpen, setIsFileSwitchModalOpen] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [reconnectCandidate, setReconnectCandidate] = useState<any | null>(null);

  // SSR-safe currentModule initialized to defaultModule prop
  const [currentModule, setCurrentModule] = useState<AppModule>(defaultModule || 'home');

  // Sync defaultModule from route entry if specified
  useEffect(() => {
    if (defaultModule) {
      setActiveModule(defaultModule);
      setCurrentModule(defaultModule);
    }
  }, [defaultModule, setActiveModule]);

  // Sync with store activeModule updates
  useEffect(() => {
    setCurrentModule(activeModule);
  }, [activeModule]);

  // Sync with browser Back / Forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.toLowerCase();
      if (path.startsWith('/trade-transfer') || path.startsWith('/trade')) {
        setActiveModule('trade');
      } else if (path.startsWith('/people-onboard') || path.startsWith('/onboarding')) {
        setActiveModule('onboarding');
      } else if (path.startsWith('/stonex-netting') || path.startsWith('/stonex')) {
        setActiveModule('stonex');
      } else if (path.startsWith('/kgi-netting') || path.startsWith('/kgi')) {
        setActiveModule('kgi');
      } else if (path === '/' || path === '') {
        setActiveModule('home');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setActiveModule]);

  useEffect(() => {
    // Check backend status on mount to detect restarts or tab reconnection
    const storedId =
      typeof window !== 'undefined'
        ? sessionStorage.getItem('trade_session_id') || localStorage.getItem('trade_session_id')
        : null;

    apiClient
      .getStatus(storedId || undefined)
      .then((status) => {
        if (storedId) {
          if (!status.loaded || status.session_id !== storedId) {
            if (typeof window !== 'undefined') {
              sessionStorage.removeItem('trade_session_id');
              sessionStorage.removeItem('trade_file_path');
              localStorage.removeItem('trade_session_id');
              localStorage.removeItem('trade_file_path');
            }
            if (currentStep > 0) {
              setSessionMismatch(true);
            }
          } else if (currentStep === 0 && status.loaded && status.session_id === storedId) {
            setReconnectCandidate(status);
          }
        }
      })
      .catch(() => {});
  }, [currentStep, setSessionMismatch]);

  const handleResumeSession = () => {
    if (!reconnectCandidate) return;
    setActiveFile({
      filePath: reconnectCandidate.current_file || '',
      filename: reconnectCandidate.filename || '',
      clientGroup: reconnectCandidate.client_group || 'SYM',
      date: reconnectCandidate.default_date || '',
      accounts: (reconnectCandidate.accounts || []).map((a: any) =>
        typeof a === 'string' ? a : a.account
      ),
      recordCount: reconnectCandidate.total_rows || reconnectCandidate.total_records || 0,
      sessionId: reconnectCandidate.session_id,
    });
    setActiveModule('trade');
    setReconnectCandidate(null);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--canvas-bg)]">
      {/* ── Persistent Unified Sidebar (Desktop / Tablet) ── */}
      <Sidebar
        activeModule={currentModule}
        onSelectModule={(mod) => {
          setCurrentModule(mod);
          setActiveModule(mod);
        }}
        onResetConfirm={() => setShowResetConfirm(true)}
        onResetOnboardingConfirm={() => setShowOnboardingResetConfirm(true)}
        onOpenRulesModal={() => setShowRulesModal(true)}
      />

      {/* ── Mobile Drawer (Mobile viewports) ── */}
      <MobileDrawer
        activeModule={currentModule}
        onSelectModule={(mod) => {
          setCurrentModule(mod);
          setActiveModule(mod);
        }}
        onResetConfirm={() => setShowResetConfirm(true)}
        onResetOnboardingConfirm={() => setShowOnboardingResetConfirm(true)}
        onOpenRulesModal={() => setShowRulesModal(true)}
      />

      {/* ── Main Workspace ── */}
      <main className="flex-grow flex flex-col min-w-0 h-full overflow-hidden bg-[var(--canvas-bg)]">
        {/* Header with Feature Switcher & Contextual Actions */}
        <Header
          activeModule={currentModule}
          onOpenFileModal={() => setIsFileSwitchModalOpen(true)}
          onOpenRulesModal={() => setShowRulesModal(true)}
        />

        {/* Session Status Alerts & Banners */}
        {sessionMismatch && (
          <div className="bg-red-500/15 border-b border-red-500/30 px-4 sm:px-6 py-2.5 flex items-center justify-between text-xs text-red-300 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>Backend was restarted or session expired. Please reload your file to continue.</span>
            </div>
            <button
              onClick={() => {
                setSessionMismatch(false);
                resetSession();
              }}
              className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded text-red-200 font-semibold transition cursor-pointer"
            >
              Reload File
            </button>
          </div>
        )}

        {multiTabConflict && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 sm:px-6 py-2.5 flex items-center justify-between text-xs text-amber-300 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>Another browser tab loaded a new file. Your current session may be out of sync.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMultiTabConflict(false)}
                className="px-2.5 py-1 text-xs text-amber-300/80 hover:text-white transition cursor-pointer"
              >
                Dismiss
              </button>
              <button
                onClick={() => {
                  setMultiTabConflict(false);
                  resetSession();
                }}
                className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded text-amber-200 font-semibold transition cursor-pointer"
              >
                Reset Session
              </button>
            </div>
          </div>
        )}

        {reconnectCandidate && currentStep === 0 && (
          <div className="bg-emerald-500/15 border-b border-emerald-500/30 px-4 sm:px-6 py-2.5 flex items-center justify-between text-xs text-emerald-300 animate-in fade-in">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Active file session found on backend ({reconnectCandidate.filename}). Resume session?</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setReconnectCandidate(null)}
                className="px-2.5 py-1 text-xs text-slate-400 hover:text-white transition cursor-pointer"
              >
                Ignore
              </button>
              <button
                onClick={handleResumeSession}
                className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 rounded text-emerald-200 font-semibold transition cursor-pointer"
              >
                Resume Session
              </button>
            </div>
          </div>
        )}

        {/* ── Content Area ── */}
        <div className="flex-grow overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {/* View 1: Home Feature Hub */}
            {currentModule === 'home' && (
              <FeatureHub
                onSelectMode={(mode) => setActiveModule(mode)}
                onOpenFileModal={() => setIsFileSwitchModalOpen(true)}
                onOpenRules={() => setShowRulesModal(true)}
              />
            )}

            {/* View 2: Trade Transfer 5-Step Pipeline */}
            {currentModule === 'trade' && (
              <div key={currentStep} className="step-view-enter space-y-6">
                {currentStep === 0 && <Step0FileSelect />}
                {currentStep === 1 && <Step1RouteMap />}
                {currentStep === 2 && <Step2Contracts />}
                {currentStep === 3 && <Step3Allocations />}
                {currentStep === 4 && <Step4PreviewExport />}
              </div>
            )}

            {/* View 3: People Onboarding Portal */}
            {currentModule === 'onboarding' && (
              <div className="step-view-enter">
                <OnboardingTab />
              </div>
            )}

            {/* View 4: StoneX Netting Portal */}
            {currentModule === 'stonex' && (
              <div className="step-view-enter">
                <StoneXNettingTab />
              </div>
            )}

            {/* View 5: KGI Netting Portal */}
            {currentModule === 'kgi' && (
              <div className="step-view-enter">
                <KGINettingTab />
              </div>
            )}
          </div>
        </div>

        {/* Sticky Status Basket Bar — only in trade mode during active steps */}
        {currentModule === 'trade' && currentStep > 0 && <BasketBar />}
      </main>

      {/* ── Global Loading Overlay with Step Progress ── */}
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

      {/* ── Global Alert Modal ── */}
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

      {/* ── Reset Confirmation Modal ── */}
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

      {/* ── Onboarding Reset Confirmation Modal ── */}
      <ConfirmModal
        isOpen={showOnboardingResetConfirm}
        title="Reset Onboarding Session?"
        message="This will discard all drafted person records from memory."
        confirmLabel="Reset Everything"
        cancelLabel="Cancel"
        isDestructive={true}
        onConfirm={() => {
          setShowOnboardingResetConfirm(false);
          clearOnboardingAll();
        }}
        onCancel={() => setShowOnboardingResetConfirm(false)}
      />

      {/* ── File Switcher Modal ── */}
      <FileSwitchModal
        isOpen={isFileSwitchModalOpen}
        onClose={() => setIsFileSwitchModalOpen(false)}
      />

      {/* ── Global Rules Modal (for Onboarding & Hub) ── */}
      {showRulesModal && (
        <RulesModal onClose={() => setShowRulesModal(false)} />
      )}
    </div>
  );
}
