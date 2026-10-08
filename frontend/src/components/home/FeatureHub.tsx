'use client';

import React, { useState, useEffect } from 'react';
import { useTradeStore } from '@/store/useTradeStore';
import { useOnboardingStore } from '@/store/useOnboardingStore';
import { ArrowLeftRight, Users, ArrowUpRight } from 'lucide-react';

interface FeatureHubProps {
  onSelectMode: (mode: 'trade' | 'onboarding') => void;
  onOpenFileModal?: () => void;
  onOpenRules?: () => void;
}

export const FeatureHub: React.FC<FeatureHubProps> = ({ onSelectMode }) => {
  const { activeFilePath, activeFilename, currentStep } = useTradeStore();
  const { rows } = useOnboardingStore();

  const hasActiveTradeSession = Boolean(activeFilePath || activeFilename);
  const onboardingCount = rows.length;

  // Keyboard shortcut navigation (1 for Trade, 2 for Onboarding)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === '1' || e.key.toLowerCase() === 't') {
        e.preventDefault();
        onSelectMode('trade');
      } else if (e.key === '2' || e.key.toLowerCase() === 'p') {
        e.preventDefault();
        onSelectMode('onboarding');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelectMode]);

  return (
    <div className="relative min-h-[calc(100vh-8rem)] flex flex-col justify-center items-center py-8 px-4 overflow-hidden select-none">
      {/* ── Main Content Container ── */}
      <div className="relative z-10 w-full max-w-4xl flex flex-col items-center space-y-10 animate-in fade-in duration-300">
        {/* ── Premium Centered Brand Header ── */}
        <div className="flex flex-col items-center text-center space-y-4">
          {/* Logo */}
          <div className="relative cursor-pointer transition-transform duration-300 hover:scale-105">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-card)] shadow-lg flex items-center justify-center p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="Axxela Logo" className="w-full h-full object-contain" />
            </div>
          </div>

          {/* Brand Typography */}
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-5xl font-black tracking-widest uppercase text-[var(--text-main)]">
              Axxela
            </h1>
            <p className="text-xs uppercase font-mono tracking-widest text-[var(--accent-gold)] font-bold">
              Select Workspace
            </p>
          </div>
        </div>

        {/* ── Minimalist Feature Cards Grid ── */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-7">
          {/* ── Card 1: Trade Position Transfer ── */}
          <div
            onClick={() => onSelectMode('trade')}
            className="group relative flex items-center justify-between p-6 sm:p-7 rounded-3xl bg-[var(--card-bg)] border border-[var(--border-card)] hover:border-amber-400/60 shadow-md hover:shadow-xl cursor-pointer transition-all duration-300 hover:-translate-y-1.5 active:scale-98"
          >
            {/* Subtle Active Session Pulse */}
            {hasActiveTradeSession && (
              <span className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-[10px] font-mono font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span>Active (Step {currentStep + 1})</span>
              </span>
            )}

            <div className="flex items-center gap-4 sm:gap-5 min-w-0">
              {/* Symbol */}
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-amber-400/10 border border-amber-400/25 flex items-center justify-center text-[var(--accent-gold)] shadow-inner transition-all duration-300 group-hover:scale-105 group-hover:bg-amber-400/20 flex-shrink-0">
                <ArrowLeftRight className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>

              {/* Title */}
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-bold text-[var(--text-main)] group-hover:text-[var(--accent-gold)] transition-colors truncate">
                  Trade Position Transfer
                </h2>
                <div className="text-[11px] font-mono text-[var(--text-muted)] mt-0.5">
                  Portfolio Transfer Engine
                </div>
              </div>
            </div>

            {/* Launch Arrow */}
            <div className="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-[var(--accent-gold)] border border-transparent group-hover:border-[var(--accent-gold)] flex items-center justify-center text-[var(--text-muted)] group-hover:text-black transition-all duration-300 flex-shrink-0 ml-3">
              <ArrowUpRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
          </div>

          {/* ── Card 2: People Onboarding ── */}
          <div
            onClick={() => onSelectMode('onboarding')}
            className="group relative flex items-center justify-between p-6 sm:p-7 rounded-3xl bg-[var(--card-bg)] border border-[var(--border-card)] hover:border-emerald-500/60 shadow-md hover:shadow-xl cursor-pointer transition-all duration-300 hover:-translate-y-1.5 active:scale-98"
          >
            {/* Subtle Drafts Badge */}
            {onboardingCount > 0 && (
              <span className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{onboardingCount} Drafts</span>
              </span>
            )}

            <div className="flex items-center gap-4 sm:gap-5 min-w-0">
              {/* Symbol */}
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shadow-inner transition-all duration-300 group-hover:scale-105 group-hover:bg-emerald-500/20 flex-shrink-0">
                <Users className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>

              {/* Title */}
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-bold text-[var(--text-main)] group-hover:text-emerald-400 transition-colors truncate">
                  People Onboarding
                </h2>
                <div className="text-[11px] font-mono text-[var(--text-muted)] mt-0.5">
                  Personnel Provisioning
                </div>
              </div>
            </div>

            {/* Launch Arrow */}
            <div className="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-emerald-400 border border-transparent group-hover:border-emerald-400 flex items-center justify-center text-[var(--text-muted)] group-hover:text-black transition-all duration-300 flex-shrink-0 ml-3">
              <ArrowUpRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
          </div>
        </div>

        {/* ── Minimal Keyboard Shortcut Hint ── */}
        <div className="flex items-center gap-2 text-[11px] font-mono text-[var(--text-muted)] opacity-60">
          <span>Keyboard:</span>
          <kbd className="px-1.5 py-0.5 rounded bg-[var(--input-bg)] border border-[var(--border-card)] text-[10px]">1</kbd>
          <span>Trade</span>
          <span className="opacity-30">•</span>
          <kbd className="px-1.5 py-0.5 rounded bg-[var(--input-bg)] border border-[var(--border-card)] text-[10px]">2</kbd>
          <span>Onboarding</span>
        </div>
      </div>
    </div>
  );
};
