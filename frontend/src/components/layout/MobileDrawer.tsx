'use client';

import React from 'react';
import { useTradeStore, AppModule } from '@/store/useTradeStore';
import { useOnboardingStore } from '@/store/useOnboardingStore';
import {
  FileText,
  ArrowRight,
  Filter,
  Calculator,
  FileSpreadsheet,
  X,
  RotateCcw,
  Home,
  ArrowLeftRight,
  Users,
  Settings2,
  UserPlus,
} from 'lucide-react';

const TRADE_STEPS = [
  { step: 0, title: 'File Source', desc: 'Select or upload CSV', icon: FileText },
  { step: 1, title: 'Transfer Routes', desc: 'Map sender to recipient', icon: ArrowRight },
  { step: 2, title: 'Filter Contracts', desc: 'Future/Options selection', icon: Filter },
  { step: 3, title: 'Pricing & Lots', desc: 'Execution & lot sizing', icon: Calculator },
  { step: 4, title: 'Review & Export', desc: '18-column Excel generator', icon: FileSpreadsheet },
];

interface MobileDrawerProps {
  onResetConfirm: () => void;
  onResetOnboardingConfirm: () => void;
  onOpenRulesModal?: () => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  onResetConfirm,
  onResetOnboardingConfirm,
  onOpenRulesModal,
}) => {
  const {
    activeModule,
    setActiveModule,
    currentStep,
    setStep,
    isMobileDrawerOpen,
    toggleMobileDrawer,
    activeFilePath,
    activeFilename,
    routes,
    selectedContracts,
    allLoadedContracts,
    showAlert,
  } = useTradeStore();

  const { rows } = useOnboardingStore();
  const onboardingCount = rows.length;

  const handleStepClick = (targetStep: number) => {
    if (targetStep > 0 && !activeFilePath) return;
    if (targetStep >= 2 && routes.length === 0) return;
    if (targetStep >= 3) {
      if (selectedContracts.length === 0) {
        showAlert('Contracts Required', 'Please select at least one contract before proceeding.');
        return;
      }
      const uniqueSenders: string[] = Array.from(new Set(routes.map((r) => r.from)));
      const unfulfilled = uniqueSenders.filter((s: string) => {
        return !selectedContracts.some((key) => {
          const item = allLoadedContracts[key];
          if (item?.account) return item.account.toUpperCase() === s.toUpperCase();
          if (key.includes('::')) return key.split('::')[0].toUpperCase() === s.toUpperCase();
          return false;
        });
      });
      if (unfulfilled.length > 0) {
        showAlert(
          'Missing Contract Selection',
          `Each sender account requires at least one contract.\n\nMissing: ${unfulfilled.join(', ')}`
        );
        return;
      }
    }
    setStep(targetStep);
    toggleMobileDrawer(false);
  };

  const handleSelectModule = (module: AppModule) => {
    setActiveModule(module);
    toggleMobileDrawer(false);
  };

  return (
    <div
      className={`fixed inset-0 z-50 lg:hidden transition-all duration-300 ${isMobileDrawerOpen ? 'visible pointer-events-auto' : 'invisible pointer-events-none'
        }`}
    >
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300 ease-in-out ${isMobileDrawerOpen ? 'opacity-100' : 'opacity-0'
          }`}
        onClick={() => toggleMobileDrawer(false)}
      />

      {/* Sliding Drawer */}
      <div
        className={`fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-[var(--sidebar-bg)] border-r border-[var(--border-card)] shadow-2xl flex flex-col z-50 transform transition-transform duration-300 cubic-bezier(0.16, 1, 0.3, 1) ${isMobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {/* Brand Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-[var(--border-subtle)]">
          <div
            onClick={() => handleSelectModule('home')}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="Axxela Logo" className="w-7 h-7 object-contain" />
            </div>
            <div>
              <div className="font-bold text-xs uppercase tracking-wider text-[var(--text-main)]">
                Axxela
              </div>
              <div className="text-[10px] text-[var(--accent-gold)] font-mono">Operations Suite</div>
            </div>
          </div>
          <button
            onClick={() => toggleMobileDrawer(false)}
            className="p-1 rounded-md text-[var(--text-muted)] hover:text-white cursor-pointer"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workspaces Switcher */}
        <div className="p-3 border-b border-[var(--border-subtle)] space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono px-2 pb-1">
            Workspaces
          </div>

          {(
            [
              { id: 'home', label: 'Home Hub', icon: Home, badge: null },
              {
                id: 'trade',
                label: 'Trade Transfer',
                icon: ArrowLeftRight,
                badge: activeFilename ? 'Active' : null,
                badgeColor: 'text-amber-300 bg-amber-400/10 border-amber-400/20',
              },
              {
                id: 'onboarding',
                label: 'People Onboarding',
                icon: Users,
                badge: onboardingCount > 0 ? `${onboardingCount}` : null,
                badgeColor: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20',
              },
            ] as {
              id: AppModule;
              label: string;
              icon: React.ComponentType<{ className?: string }>;
              badge: string | null;
              badgeColor?: string;
            }[]
          ).map((m) => {
            const Icon = m.icon;
            const isActive = activeModule === m.id;

            return (
              <button
                key={m.id}
                onClick={() => handleSelectModule(m.id)}
                className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition border cursor-pointer ${isActive
                    ? 'bg-[var(--card-hover)] border-[var(--accent-gold)] text-[var(--accent-gold)] font-bold shadow-xs'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/5'
                  }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${isActive ? 'bg-[var(--accent-gold)] text-black' : 'bg-white/5 text-[var(--text-muted)]'
                      }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs">{m.label}</span>
                </div>

                {m.badge && (
                  <span
                    className={`text-[10px] font-mono font-semibold px-2 py-0.2 rounded-full border ${m.badgeColor || ''
                      }`}
                  >
                    {m.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Contextual navigation area */}
        <nav className="flex-grow p-3 space-y-2 overflow-y-auto">
          {activeModule === 'trade' && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono px-2 py-1">
                Transfer Pipeline
              </div>

              {TRADE_STEPS.map((s) => {
                const Icon = s.icon;
                const isActive = currentStep === s.step;
                const isCompleted = currentStep > s.step;
                const isDisabled =
                  (s.step > 0 && !activeFilePath) ||
                  (s.step >= 2 && routes.length === 0) ||
                  (s.step >= 3 && selectedContracts.length === 0);

                return (
                  <button
                    key={s.step}
                    onClick={() => handleStepClick(s.step)}
                    disabled={isDisabled}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition border cursor-pointer ${isActive
                        ? 'bg-[var(--card-hover)] border-[var(--accent-gold)] text-[var(--accent-gold)] font-bold shadow-sm'
                        : isCompleted
                          ? 'border-transparent text-[var(--text-main)] hover:bg-white/5'
                          : 'border-transparent text-[var(--text-muted)] hover:bg-white/5 disabled:opacity-40'
                      }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-mono font-bold ${isActive
                          ? 'bg-[var(--accent-gold)] text-black'
                          : isCompleted
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-white/5 text-[var(--text-muted)]'
                        }`}
                    >
                      {isCompleted ? '✓' : s.step}
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-bold truncate">{s.title}</div>
                      <div className="text-[10px] text-[var(--text-muted)] truncate">{s.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {activeModule === 'onboarding' && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono px-2 py-1">
                Onboarding Tools
              </div>

              <div className="p-3 rounded-xl border border-[var(--border-card)] bg-[var(--card-bg)] text-xs flex items-center gap-2.5">
                <UserPlus className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold">Add Person Entry</span>
              </div>

              <div className="p-3 rounded-xl border border-[var(--border-card)] bg-[var(--card-bg)] text-xs flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold">Draft Records</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold">
                  {onboardingCount}
                </span>
              </div>

              {onOpenRulesModal && (
                <button
                  onClick={() => {
                    toggleMobileDrawer(false);
                    onOpenRulesModal();
                  }}
                  className="w-full p-3 rounded-xl border border-[var(--border-card)] hover:border-[var(--accent-gold)]/50 bg-[var(--card-bg)] text-xs flex items-center gap-2.5 cursor-pointer text-left"
                >
                  <Settings2 className="w-4 h-4 text-[var(--accent-gold)]" />
                  <span className="font-semibold">Lookup Config Manager</span>
                </button>
              )}
            </div>
          )}
        </nav>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[var(--border-subtle)] space-y-2">
          {activeModule === 'trade' && (
            <button
              onClick={() => {
                toggleMobileDrawer(false);
                onResetConfirm();
              }}
              className="w-full py-2 px-3 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 flex items-center justify-center gap-2 border border-red-500/20 transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Trade Session
            </button>
          )}

          {activeModule === 'onboarding' && (
            <button
              onClick={() => {
                toggleMobileDrawer(false);
                onResetOnboardingConfirm();
              }}
              className="w-full py-2 px-3 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 flex items-center justify-center gap-2 border border-red-500/20 transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Onboarding Session
            </button>
          )}
          <div className="text-[10px] text-center text-[var(--text-muted)] font-mono">
            Axxela Operations
          </div>
        </div>
      </div>
    </div>
  );
};
