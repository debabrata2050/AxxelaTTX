'use client';

import React from 'react';
import { useTradeStore } from '@/store/useTradeStore';
import {
  FileText,
  ArrowRight,
  Filter,
  Calculator,
  FileSpreadsheet,
  ChevronLeft,
  RotateCcw,
} from 'lucide-react';

const STEPS = [
  { step: 0, title: 'File Source', desc: 'Select or upload CSV', icon: FileText },
  { step: 1, title: 'Transfer Routes', desc: 'Map sender to recipient', icon: ArrowRight },
  { step: 2, title: 'Filter Contracts', desc: 'Future/Options selection', icon: Filter },
  { step: 3, title: 'Pricing & Lots', desc: 'Execution & lot sizing', icon: Calculator },
  { step: 4, title: 'Review & Export', desc: '18-column Excel generator', icon: FileSpreadsheet },
];

interface SidebarProps {
  onResetConfirm: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onResetConfirm }) => {
  const {
    currentStep,
    setStep,
    isSidebarCollapsed,
    toggleSidebarCollapsed,
    activeFilePath,
    routes,
    selectedContracts,
    allLoadedContracts,
    showAlert,
  } = useTradeStore();

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
      {/* Brand Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-[var(--border-subtle)]">
        {!isSidebarCollapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="Axxela Logo" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">
                Axxela
              </div>
              <div className="text-[10px] text-[var(--accent-gold)] font-mono font-medium">
                Trade Transfer
              </div>
            </div>
          </div>
        )}
        {isSidebarCollapsed && (
          <div className="mx-auto w-8 h-8 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Axxela Logo" className="w-7 h-7 object-contain" />
          </div>
        )}

        <button
          onClick={toggleSidebarCollapsed}
          className="p-1.5 rounded-md hover:bg-white/5 text-[var(--text-muted)] hover:text-[var(--accent-gold)] transition"
          title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft
            className={`w-4 h-4 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''
              }`}
          />
        </button>
      </div>

      {/* Wizard Navigation Steps */}
      <nav className="flex-grow p-3 space-y-1.5 overflow-y-auto">
        {STEPS.map((s) => {
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
              className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition border ${isActive
                ? 'bg-[var(--card-hover)] border-[var(--accent-gold)] text-[var(--accent-gold)] shadow-sm font-bold'
                : isCompleted
                  ? 'border-transparent text-[var(--text-main)] hover:bg-white/5 opacity-90'
                  : 'border-transparent text-[var(--text-muted)] hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer'
                } ${isSidebarCollapsed ? 'justify-center p-3' : ''}`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-mono font-bold transition ${isActive
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
                  <div className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">{s.desc}</div>
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Actions */}
      <div className="p-3 border-t border-[var(--border-subtle)] space-y-2">
        <button
          onClick={onResetConfirm}
          className="w-full py-1.5 px-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 flex items-center justify-center gap-1.5 transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {!isSidebarCollapsed && <span>Reset Session</span>}
        </button>
        {!isSidebarCollapsed && (
          <div className="text-[10px] text-center text-[var(--text-muted)] font-mono">
            Axxela v3.4.2
          </div>
        )}
      </div>
    </aside>
  );
};
