'use client';

import React from 'react';
import { useTradeStore, AppModule } from '@/store/useTradeStore';
import { useOnboardingStore } from '@/store/useOnboardingStore';
import { useStoneXStore } from '@/store/useStoneXStore';
import { useKGIStore } from '@/store/useKGIStore';
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
  Scale,
  Layers,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const TRADE_STEPS = [
  { step: 0, title: 'File Source', desc: 'Select or upload CSV', icon: FileText },
  { step: 1, title: 'Transfer Routes', desc: 'Map sender to recipient', icon: ArrowRight },
  { step: 2, title: 'Filter Contracts', desc: 'Future/Options selection', icon: Filter },
  { step: 3, title: 'Pricing & Lots', desc: 'Execution & lot sizing', icon: Calculator },
  { step: 4, title: 'Review & Export', desc: '18-column Excel generator', icon: FileSpreadsheet },
];

interface SidebarProps {
  activeModule?: AppModule;
  onSelectModule?: (module: AppModule) => void;
  onResetConfirm: () => void;
  onResetOnboardingConfirm: () => void;
  onOpenRulesModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule: propActiveModule,
  onSelectModule,
  onResetConfirm,
  onResetOnboardingConfirm,
  onOpenRulesModal,
}) => {
  const {
    activeModule: storeActiveModule,
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

  const activeModule = propActiveModule ?? storeActiveModule;

  const handleSelectModule = (mod: AppModule) => {
    if (onSelectModule) onSelectModule(mod);
    setActiveModule(mod);
  };

  const { rows } = useOnboardingStore();
  const onboardingCount = rows.length;

  const stoneXStep = useStoneXStore((s) => s.currentStep);
  const setStoneXStep = useStoneXStore((s) => s.setStep);
  const canProceedToStoneXStep = useStoneXStore((s) => s.canProceedToStep);
  const resetStoneX = useStoneXStore((s) => s.resetAll);
  const stoneXSummary = useStoneXStore((s) => s.summary);

  const kgiStep = useKGIStore((s) => s.currentStep);
  const setKGIStep = useKGIStore((s) => s.setStep);
  const canProceedToKGIStep = useKGIStore((s) => s.canProceedToStep);
  const resetKGI = useKGIStore((s) => s.resetAll);
  const kgiSummary = useKGIStore((s) => s.summary);

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
      className={`hidden lg:flex flex-col border-r border-border bg-card dark:bg-card/90 transition-all duration-300 z-20 flex-shrink-0 ${isSidebarCollapsed ? 'w-20' : 'w-72'
        }`}
    >
      {/* ── Brand Header ── */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-border">
        {!isSidebarCollapsed && (
          <div
            onClick={() => handleSelectModule('home')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="Axxela Logo" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-foreground group-hover:text-amber-600 dark:group-hover:text-primary transition-colors">
                Axxela
              </div>
              <div className="text-[10px] text-amber-700 dark:text-primary font-mono font-medium">
                Operations Suite
              </div>
            </div>
          </div>
        )}
        {isSidebarCollapsed && (
          <div
            onClick={() => handleSelectModule('home')}
            className="mx-auto w-8 h-8 flex items-center justify-center cursor-pointer"
            title="Return to Home"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Axxela Logo" className="w-7 h-7 object-contain" />
          </div>
        )}

        <button
          onClick={toggleSidebarCollapsed}
          className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
          title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft
            className={`w-4 h-4 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''
              }`}
          />
        </button>
      </div>

      {/* ── Module Switcher (Top Workspace Level) ── */}
      <div className="p-3 border-b border-border space-y-1">
        {!isSidebarCollapsed && (
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono px-2 pb-1">
            Workspaces
          </div>
        )}

        {(
          [
            { id: 'home', label: 'Home', icon: Home, badge: null },
            {
              id: 'trade',
              label: 'Trade Transfer',
              icon: ArrowLeftRight,
              badge: activeFilename ? 'Active' : null,
            },
            {
              id: 'onboarding',
              label: 'People Onboarding',
              icon: Users,
              badge: onboardingCount > 0 ? `${onboardingCount}` : null,
            },
            {
              id: 'stonex',
              label: 'StoneX Netting',
              icon: Scale,
              badge: null,
            },
            {
              id: 'kgi',
              label: 'KGI Netting',
              icon: Layers,
              badge: null,
            },
          ] as {
            id: AppModule;
            label: string;
            icon: React.ComponentType<{ className?: string }>;
            badge: string | null;
          }[]
        ).map((m) => {
          const Icon = m.icon;
          const isActive = activeModule === m.id;

          return (
            <button
              key={m.id}
              onClick={() => handleSelectModule(m.id)}
              className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition-all border cursor-pointer ${isActive
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-primary font-bold shadow-xs'
                  : 'border-transparent text-slate-600 dark:text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-accent/40'
                } ${isSidebarCollapsed ? 'justify-center p-2.5' : ''}`}
              title={m.label}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs transition ${isActive
                    ? 'bg-gradient-to-r from-[#ffc81a] via-[#faa000] to-[#f58200] text-black font-bold shadow-2xs'
                    : 'bg-slate-100 dark:bg-muted text-slate-600 dark:text-muted-foreground'
                  }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>

              {!isSidebarCollapsed && (
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <span className="text-xs truncate">{m.label}</span>
                  {m.badge && (
                    <Badge
                      variant={
                        m.id === 'trade'
                          ? 'gold'
                          : m.id === 'onboarding'
                          ? 'emerald'
                          : 'sky'
                      }
                      className="text-[10px] px-2 py-0"
                    >
                      {m.badge}
                    </Badge>
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
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-primary shadow-xs font-bold'
                      : isCompleted
                        ? 'border-transparent text-foreground hover:bg-slate-100 dark:hover:bg-accent/40 opacity-90'
                        : 'border-transparent text-slate-500 dark:text-muted-foreground hover:bg-slate-100 dark:hover:bg-accent/40 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer'
                    } ${isSidebarCollapsed ? 'justify-center p-2.5' : ''}`}
                >
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-mono font-bold transition ${isActive
                        ? 'bg-gradient-to-r from-[#ffc81a] via-[#faa000] to-[#f58200] text-black font-bold shadow-2xs'
                        : isCompleted
                          ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold'
                          : 'bg-slate-100 dark:bg-muted text-slate-500 dark:text-muted-foreground'
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
              className={`w-full flex items-center gap-3 p-2.5 rounded-xl border border-border bg-card/60 text-xs text-foreground ${isSidebarCollapsed ? 'justify-center' : ''
                }`}
            >
              <UserPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              {!isSidebarCollapsed && (
                <div>
                  <div className="font-bold">Add Person</div>
                  <div className="text-[10px] text-muted-foreground">Real-time derivation form</div>
                </div>
              )}
            </div>

            <div
              className={`w-full flex items-center gap-3 p-2.5 rounded-xl border border-border bg-card/60 text-xs text-foreground ${isSidebarCollapsed ? 'justify-center' : ''
                }`}
            >
              <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              {!isSidebarCollapsed && (
                <div className="flex-1 flex items-center justify-between">
                  <div>
                    <div className="font-bold">Draft Records</div>
                    <div className="text-[10px] text-muted-foreground">Ready for export</div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-bold">
                    {onboardingCount}
                  </span>
                </div>
              )}
            </div>

            {onOpenRulesModal && (
              <button
                onClick={onOpenRulesModal}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl border border-transparent hover:border-border hover:bg-slate-100 dark:hover:bg-muted text-xs text-muted-foreground hover:text-foreground transition cursor-pointer ${isSidebarCollapsed ? 'justify-center' : ''
                  }`}
              >
                <Settings2 className="w-4 h-4 text-amber-600 dark:text-primary flex-shrink-0" />
                {!isSidebarCollapsed && (
                  <div>
                    <div className="font-semibold">Lookup Config</div>
                    <div className="text-[10px] text-muted-foreground">Configure tables & codes</div>
                  </div>
                )}
              </button>
            )}
          </div>
        )}

        {/* Scenario 3: StoneX Netting Active */}
        {activeModule === 'stonex' && (
          <div className="space-y-1.5">
            {!isSidebarCollapsed && (
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono px-2 py-1 flex items-center justify-between">
                <span>Netting Pipeline</span>
                <span className="text-[10px] text-sky-400">Step {stoneXStep + 1}/5</span>
              </div>
            )}

            {[
              { step: 0, title: 'CSV Source', desc: 'File Ingestion & KPIs', icon: FileSpreadsheet },
              { step: 1, title: 'Products', desc: 'Multi-Product Picker', icon: Layers },
              { step: 2, title: 'Contracts', desc: 'Delivery Period Selection', icon: Filter },
              { step: 3, title: 'Netting Audit', desc: 'Zero-Delta Validation', icon: Scale },
              { step: 4, title: 'Review & Export', desc: 'Consolidated Sheet LCE30553', icon: ArrowRight },
            ].map((s) => {
              const Icon = s.icon;
              const isActive = stoneXStep === s.step;
              const isDone = stoneXStep > s.step;
              const check = canProceedToStoneXStep(s.step);
              const isClickable = check.allowed;

              return (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => isClickable && setStoneXStep(s.step)}
                  disabled={!isClickable}
                  title={!isClickable ? check.reason : `Go to Step ${s.step}: ${s.title}`}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition border cursor-pointer ${
                    isActive
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-primary shadow-xs font-bold'
                      : isDone
                      ? 'border-transparent text-foreground hover:bg-slate-100 dark:hover:bg-accent/40 opacity-90'
                      : isClickable
                      ? 'border-transparent text-slate-500 dark:text-muted-foreground hover:bg-slate-100 dark:hover:bg-accent/40'
                      : 'border-transparent text-slate-400 dark:text-muted-foreground opacity-35 cursor-not-allowed'
                  } ${isSidebarCollapsed ? 'justify-center p-2.5' : ''}`}
                >
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-mono font-bold transition ${
                      isActive
                        ? 'bg-gradient-to-r from-[#ffc81a] via-[#faa000] to-[#f58200] text-black font-bold shadow-2xs'
                        : isDone
                        ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold'
                        : 'bg-slate-100 dark:bg-muted text-slate-500 dark:text-muted-foreground'
                    }`}
                  >
                    {isDone ? '✓' : s.step}
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

        {/* Scenario 4: KGI Netting Active */}
        {activeModule === 'kgi' && (
          <div className="space-y-1.5">
            {!isSidebarCollapsed && (
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono px-2 py-1 flex items-center justify-between">
                <span>KGI Pipeline</span>
                <span className="text-[10px] text-sky-400">Step {kgiStep + 1}/5</span>
              </div>
            )}

            {[
              { step: 0, title: 'CSV Source', desc: 'File Ingestion & KPIs', icon: FileSpreadsheet },
              { step: 1, title: 'Products', desc: 'Multi-Product Picker', icon: Layers },
              { step: 2, title: 'Contracts', desc: 'Contract Expiry Selection', icon: Filter },
              { step: 3, title: 'Netting Audit', desc: 'Zero-Delta Validation', icon: Scale },
              { step: 4, title: 'Review & Export', desc: 'Consolidated Form KT513Z', icon: ArrowRight },
            ].map((s) => {
              const Icon = s.icon;
              const isActive = kgiStep === s.step;
              const isDone = kgiStep > s.step;
              const check = canProceedToKGIStep(s.step);
              const isClickable = check.allowed;

              return (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => isClickable && setKGIStep(s.step)}
                  disabled={!isClickable}
                  title={!isClickable ? check.reason : `Go to Step ${s.step}: ${s.title}`}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition border cursor-pointer ${
                    isActive
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-primary shadow-xs font-bold'
                      : isDone
                      ? 'border-transparent text-foreground hover:bg-slate-100 dark:hover:bg-accent/40 opacity-90'
                      : isClickable
                      ? 'border-transparent text-slate-500 dark:text-muted-foreground hover:bg-slate-100 dark:hover:bg-accent/40'
                      : 'border-transparent text-slate-400 dark:text-muted-foreground opacity-35 cursor-not-allowed'
                  } ${isSidebarCollapsed ? 'justify-center p-2.5' : ''}`}
                >
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-mono font-bold transition ${
                      isActive
                        ? 'bg-gradient-to-r from-[#ffc81a] via-[#faa000] to-[#f58200] text-black font-bold shadow-2xs'
                        : isDone
                        ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold'
                        : 'bg-slate-100 dark:bg-muted text-slate-500 dark:text-muted-foreground'
                    }`}
                  >
                    {isDone ? '✓' : s.step}
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
      </div>

      {/* ── Footer Actions ── */}
      <div className="p-3 border-t border-border space-y-2">
        {activeModule === 'trade' && (
          <button
            onClick={onResetConfirm}
            className="w-full py-1.5 px-2 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 flex items-center justify-center gap-1.5 transition cursor-pointer"
            title="Reset active trade session data"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {!isSidebarCollapsed && <span>Reset Trade Session</span>}
          </button>
        )}

        {activeModule === 'onboarding' && (
          <button
            onClick={onResetOnboardingConfirm}
            className="w-full py-1.5 px-2 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 flex items-center justify-center gap-1.5 transition cursor-pointer"
            title="Reset people onboarding draft data"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {!isSidebarCollapsed && <span>Reset Onboarding Session</span>}
          </button>
        )}

        {activeModule === 'stonex' && stoneXSummary && (
          <button
            onClick={resetStoneX}
            className="w-full py-1.5 px-2 rounded-lg text-xs font-medium text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 flex items-center justify-center gap-1.5 transition cursor-pointer"
            title="Reset StoneX Netting Pipeline"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {!isSidebarCollapsed && <span>Reset StoneX Pipeline</span>}
          </button>
        )}

        {activeModule === 'kgi' && kgiSummary && (
          <button
            onClick={resetKGI}
            className="w-full py-1.5 px-2 rounded-lg text-xs font-medium text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 flex items-center justify-center gap-1.5 transition cursor-pointer"
            title="Reset KGI Netting Pipeline"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {!isSidebarCollapsed && <span>Reset KGI Pipeline</span>}
          </button>
        )}

        {!isSidebarCollapsed && (
          <div className="text-[10px] text-center text-muted-foreground font-mono">
            Axxela Operations
          </div>
        )}
      </div>
    </aside>
  );
};
