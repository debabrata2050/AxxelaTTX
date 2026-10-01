'use client';

import React from 'react';
import { useTradeStore } from '@/store/useTradeStore';
import {
  FileText,
  ArrowRight,
  Filter,
  Calculator,
  FileSpreadsheet,
  X,
  RotateCcw,
} from 'lucide-react';

const STEPS = [
  { step: 0, title: 'File Source', desc: 'Select or upload CSV', icon: FileText },
  { step: 1, title: 'Transfer Routes', desc: 'Map sender to recipient', icon: ArrowRight },
  { step: 2, title: 'Filter Contracts', desc: 'Future/Options selection', icon: Filter },
  { step: 3, title: 'Pricing & Lots', desc: 'Execution & lot sizing', icon: Calculator },
  { step: 4, title: 'Review & Export', desc: '18-column Excel generator', icon: FileSpreadsheet },
];

interface MobileDrawerProps {
  onResetConfirm: () => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({ onResetConfirm }) => {
  const {
    currentStep,
    setStep,
    isMobileDrawerOpen,
    toggleMobileDrawer,
    activeFilePath,
    routes,
    selectedContracts,
  } = useTradeStore();

  const handleStepClick = (targetStep: number) => {
    if (targetStep > 0 && !activeFilePath) return;
    if (targetStep >= 2 && routes.length === 0) return;
    if (targetStep >= 3 && selectedContracts.length === 0) return;
    setStep(targetStep);
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
        className={`fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-[var(--sidebar-bg)] border-r border-[var(--border-card)] shadow-2xl flex flex-col z-50 transform transition-transform duration-300 cubic-bezier(0.16, 1, 0.3, 1) ${isMobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <div className="h-14 px-4 flex items-center justify-between border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="Axxela Logo" className="w-7 h-7 object-contain" />
            </div>
            <span className="font-bold text-xs uppercase tracking-wider text-[var(--text-main)]">
              Axxela Transfer
            </span>
          </div>
          <button
            onClick={() => toggleMobileDrawer(false)}
            className="p-1 rounded-md text-[var(--text-muted)] hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-grow p-4 space-y-2 overflow-y-auto">
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
                    ? 'bg-[var(--card-hover)] border-[var(--accent-gold)] text-[var(--accent-gold)] font-bold shadow-sm'
                    : isCompleted
                      ? 'border-transparent text-[var(--text-main)] hover:bg-white/5'
                      : 'border-transparent text-[var(--text-muted)] hover:bg-white/5 disabled:opacity-40'
                  }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono font-bold ${isActive
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
        </nav>

        <div className="p-4 border-t border-[var(--border-subtle)] space-y-2">
          <button
            onClick={() => {
              toggleMobileDrawer(false);
              onResetConfirm();
            }}
            className="w-full py-2 px-3 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 flex items-center justify-center gap-2 border border-red-500/20 transition"
          >
            <RotateCcw className="w-4 h-4" />
            Reset All Data
          </button>
        </div>
      </div>
    </div>
  );
};
