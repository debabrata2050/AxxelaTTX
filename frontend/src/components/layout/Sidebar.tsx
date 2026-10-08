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
  ChevronLeft,
  RotateCcw,
  Home,
  ArrowLeftRight,
  Users,
  Settings2,
  UserPlus,
  Compass,
} from 'lucide-react';

const TRADE_STEPS = [
  { step: 0, title: 'File Source', desc: 'Select or upload CSV', icon: FileText },
  { step: 1, title: 'Transfer Routes', desc: 'Map sender to recipient', icon: ArrowRight },
  { step: 2, title: 'Filter Contracts', desc: 'Future/Options selection', icon: Filter },
  { step: 3, title: 'Pricing & Lots', desc: 'Execution & lot sizing', icon: Calculator },
  { step: 4, title: 'Review & Export', desc: '18-column Excel generator', icon: FileSpreadsheet },
];

interface SidebarProps {
  onResetConfirm: () => void;
  onResetOnboardingConfirm: () => void;
  onOpenRulesModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onResetConfirm,
  onResetOnboardingConfirm,
  onOpenRulesModal,
}) => {
  const {
    activeModule,
    setActiveModule,
    currentStep,
    setStep,
    isSidebarCollapsed,
    toggleSidebarCollapsed,
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
  };

  return (
    <aside
      className={`hidden lg:flex flex-col border-r border-[var(--border-subtle)] bg-[var(--sidebar-bg)] transition-all duration-300 z-20 flex-shrink-0 ${isSidebarCollapsed ? 'w-20' : 'w-72'
        }`}
    >
      {/* ── Brand Header ── */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-[var(--border-subtle)]">
        {!isSidebarCollapsed && (
          <div
            onClick={() => setActiveModule('home')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="Axxela Logo" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)] group-hover:text-[var(--accent-gold)] transition-colors">
                Axxela
              </div>
              <div className="text-[10px] text-[var(--accent-gold)] font-mono font-medium">
                Operations Suite
              </div>
            </div>
          </div>
        )}
        {isSidebarCollapsed && (
          <div
            onClick={() => setActiveModule('home')}
            className="mx-auto w-8 h-8 flex items-center justify-center cursor-pointer"
            title="Return to Home Hub"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Axxela Logo" className="w-7 h-7 object-contain" />
          </div>
        )}

        <button
          onClick={toggleSidebarCollapsed}
          className="p-1.5 rounded-md hover:bg-white/5 text-[var(--text-muted)] hover:text-[var(--accent-gold)] transition cursor-pointer"
          title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft
            className={`w-4 h-4 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''
              }`}
          />
        </button>
      </div>

      {/* ── Module Switcher (Top Workspace Level) ── */}
      <div className="p-3 border-b border-[var(--border-subtle)]/60 space-y-1">
        {!isSidebarCollapsed && (
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono px-2 pb-1">
            Workspaces
          </div>
        )}

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
              onClick={() => setActiveModule(m.id)}
              className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition-all border cursor-pointer ${isActive
                  ? 'bg-[var(--card-hover)] border-[var(--accent-gold)] text-[var(--accent-gold)] font-bold shadow-xs'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/5'
                } ${isSidebarCollapsed ? 'justify-center p-2.5' : ''}`}
              title={m.label}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs transition ${isActive
                    ? 'bg-[var(--accent-gold)] text-black'
                    : 'bg-white/5 text-[var(--text-muted)]'
                  }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>

              {!isSidebarCollapsed && (
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <span className="text-xs truncate">{m.label}</span>
                  {m.badge && (
                    <span
                      className={`text-[10px] font-mono font-semibold px-2 py-0.2 rounded-full border ${m.badgeColor || ''
                        }`}
                    >
                      {m.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Contextual Navigation Area ── */}
      <div className="flex-grow p-3 space-y-3 overflow-y-auto">
        {/* Scenario 1: Trade Transfer Active */}
        {activeModule === 'trade' && (
          <div className="space-y-1.5">
            {!isSidebarCollapsed && (
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono px-2 py-1">
                Transfer Pipeline
              </div>
            )}

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
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition border ${isActive
                      ? 'bg-[var(--card-hover)] border-[var(--accent-gold)] text-[var(--accent-gold)] shadow-xs font-bold'
                      : isCompleted
                        ? 'border-transparent text-[var(--text-main)] hover:bg-white/5 opacity-90'
                        : 'border-transparent text-[var(--text-muted)] hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer'
                    } ${isSidebarCollapsed ? 'justify-center p-2.5' : ''}`}
                >
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-mono font-bold transition ${isActive
                        ? 'bg-[var(--accent-gold)] text-black'
                        : isCompleted
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-white/5 text-[var(--text-muted)]'
                      }`}
                  >
                    {isCompleted ? '✓' : s.step}
                  </div>

                  {!isSidebarCollapsed && (
                    <div className="truncate">
                      <div className="text-xs font-bold truncate leading-tight">{s.title}</div>
                      <div className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">
                        {s.desc}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Scenario 2: People Onboarding Active */}
        {activeModule === 'onboarding' && (
          <div className="space-y-1.5">
            {!isSidebarCollapsed && (
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono px-2 py-1">
                Onboarding Tools
              </div>
            )}

            <div
              className={`w-full flex items-center gap-3 p-2.5 rounded-xl border border-[var(--border-card)] bg-[var(--card-bg)] text-xs text-[var(--text-main)] ${isSidebarCollapsed ? 'justify-center' : ''
                }`}
            >
              <UserPlus className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              {!isSidebarCollapsed && (
                <div>
                  <div className="font-bold">Add Person</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Real-time derivation form</div>
                </div>
              )}
            </div>

            <div
              className={`w-full flex items-center gap-3 p-2.5 rounded-xl border border-[var(--border-card)] bg-[var(--card-bg)] text-xs text-[var(--text-main)] ${isSidebarCollapsed ? 'justify-center' : ''
                }`}
            >
              <Users className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              {!isSidebarCollapsed && (
                <div className="flex-1 flex items-center justify-between">
                  <div>
                    <div className="font-bold">Draft Records</div>
                    <div className="text-[10px] text-[var(--text-muted)]">Ready for export</div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold">
                    {onboardingCount}
                  </span>
                </div>
              )}
            </div>

            {onOpenRulesModal && (
              <button
                onClick={onOpenRulesModal}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl border border-transparent hover:border-[var(--accent-gold)]/30 hover:bg-white/5 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] transition cursor-pointer ${isSidebarCollapsed ? 'justify-center' : ''
                  }`}
              >
                <Settings2 className="w-4 h-4 text-[var(--accent-gold)] flex-shrink-0" />
                {!isSidebarCollapsed && (
                  <div>
                    <div className="font-semibold">Lookup Config</div>
                    <div className="text-[10px] text-[var(--text-muted)]">Configure tables & codes</div>
                  </div>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Footer Actions ── */}
      <div className="p-3 border-t border-[var(--border-subtle)] space-y-2">
        {activeModule === 'trade' && (
          <button
            onClick={onResetConfirm}
            className="w-full py-1.5 px-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 flex items-center justify-center gap-1.5 transition cursor-pointer"
            title="Reset active trade session data"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {!isSidebarCollapsed && <span>Reset Trade Session</span>}
          </button>
        )}

        {activeModule === 'onboarding' && (
          <button
            onClick={onResetOnboardingConfirm}
            className="w-full py-1.5 px-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 flex items-center justify-center gap-1.5 transition cursor-pointer"
            title="Reset people onboarding draft data"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {!isSidebarCollapsed && <span>Reset Onboarding Session</span>}
          </button>
        )}

        {!isSidebarCollapsed && (
          <div className="text-[10px] text-center text-[var(--text-muted)] font-mono">
            Axxela Operations
          </div>
        )}
      </div>
    </aside>
  );
};
