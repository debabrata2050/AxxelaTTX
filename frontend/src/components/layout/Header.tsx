'use client';

import React, { useState, useEffect } from 'react';
import { useTradeStore } from '@/store/useTradeStore';
import { useOnboardingStore } from '@/store/useOnboardingStore';
import {
  Menu,
  Sun,
  Moon,
  FileText,
  Settings2,
  Clock,
} from 'lucide-react';
import { toggleTheme } from '@/lib/theme';

interface HeaderProps {
  onOpenFileModal: () => void;
  onOpenRulesModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenFileModal,
  onOpenRulesModal,
}) => {
  const {
    theme,
    activeModule,
    activeFilename,
    accountCount,
    tradeCount,
    toggleMobileDrawer,
  } = useTradeStore();

  const { rows } = useOnboardingStore();
  const onboardingCount = rows.length;

  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    setMounted(true);
    const updateTime = () => {
      setCurrentTime(
        new Date().toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-14 px-3 sm:px-6 lg:px-8 border-b border-[var(--border-subtle)] bg-[var(--header-bg)] flex items-center justify-between sticky top-0 z-30 transition-colors">
      {/* ── Left: Hamburger Menu (Mobile/Tablet, perfect for 330px) ── */}
      <div className="flex items-center min-w-0">
        <button
          onClick={() => toggleMobileDrawer(true)}
          className="p-2 rounded-xl border border-[var(--border-card)] text-[var(--text-sub)] hover:text-[var(--accent-gold)] lg:hidden transition active:scale-95 cursor-pointer flex items-center justify-center flex-shrink-0"
          aria-label="Toggle navigation drawer"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* ── Center: Clean Spacer ── */}
      <div className="flex-1" />

      {/* ── Right: Contextual Stats & Smooth Theme Toggle ── */}
      <div className="flex items-center gap-2 sm:gap-3 text-xs font-mono">
        {/* Contextual Widget for Trade Mode (hidden on narrow screens < 440px for clean layout) */}
        {activeModule === 'trade' && (
          <div className="hidden min-[440px]:flex items-center gap-2">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--card-bg)] border border-[var(--border-card)] text-xs shadow-sm max-w-[160px] sm:max-w-xs truncate">
              <FileText className="w-3.5 h-3.5 text-[var(--accent-gold)] flex-shrink-0" />
              <span className="truncate font-mono font-medium text-[var(--text-main)] text-[11px]">
                {activeFilename || 'No file selected'}
              </span>
              <button
                onClick={onOpenFileModal}
                className="text-[11px] font-bold text-[var(--accent-gold)] hover:underline flex-shrink-0 ml-1 cursor-pointer"
              >
                Change
              </button>
            </div>

            <div className="hidden xl:flex items-center gap-1.5 text-[11px]">
              <div className="px-2.5 py-0.5 rounded-full bg-[var(--card-bg)] border border-[var(--border-subtle)] text-[var(--text-muted)]">
                Acc: <strong className="text-[var(--accent-gold)]">{accountCount}</strong>
              </div>
              <div className="px-2.5 py-0.5 rounded-full bg-[var(--card-bg)] border border-[var(--border-subtle)] text-[var(--text-muted)]">
                Rec: <strong className="text-[var(--accent-gold)]">{tradeCount}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Contextual Widget for People Onboarding Mode */}
        {activeModule === 'onboarding' && (
          <div className="hidden min-[440px]:flex items-center gap-2">
            <div className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Drafts: {onboardingCount}</span>
            </div>

            {onOpenRulesModal && (
              <button
                onClick={onOpenRulesModal}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-[var(--border-card)] bg-[var(--card-bg)] text-[11px] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--accent-gold)]/50 transition cursor-pointer"
              >
                <Settings2 className="w-3 h-3 text-[var(--accent-gold)]" />
                <span className="hidden sm:inline">Config</span>
              </button>
            )}
          </div>
        )}

        {/* ── Live Local Time Clock Pill ── */}
        {mounted && currentTime && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--card-bg)] border border-[var(--border-card)] text-[var(--text-sub)] shadow-sm flex-shrink-0 select-none transition-colors"
            title="Local System Time"
          >
            <Clock className="w-3.5 h-3.5 text-[var(--accent-gold)] flex-shrink-0" />
            <span className="font-mono text-[11px] sm:text-xs font-semibold tracking-tight text-[var(--text-main)]">
              {currentTime}
            </span>
          </div>
        )}

        {/* ── Ultra-Smooth Sliding Pill Theme Toggle Switch ── */}
        <button
          type="button"
          onClick={(e) =>
            toggleTheme(
              e.currentTarget,
              (nextTheme) => useTradeStore.getState().setTheme(nextTheme),
              theme === 'dark' ? 'light' : 'dark'
            )
          }
          className="relative w-14 h-7 rounded-full bg-[var(--input-bg)] border border-[var(--border-card)] p-0.5 cursor-pointer transition-colors duration-300 focus:outline-none flex items-center shadow-inner flex-shrink-0"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          aria-label="Toggle theme"
        >
          {/* Background Icons */}
          <div className="absolute inset-0 px-1.5 flex items-center justify-between pointer-events-none">
            <Moon className={`w-3.5 h-3.5 transition-opacity duration-300 ${theme === 'dark' ? 'opacity-0' : 'text-slate-400 opacity-60'}`} />
            <Sun className={`w-3.5 h-3.5 transition-opacity duration-300 ${theme === 'light' ? 'opacity-0' : 'text-amber-400 opacity-60'}`} />
          </div>

          {/* Sliding Thumb with Spring Easing & Icon Micro-Rotation */}
          <div
            className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center shadow-md transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              theme === 'dark'
                ? 'translate-x-0 bg-gradient-to-br from-amber-300 to-amber-500 text-black shadow-amber-400/30'
                : 'translate-x-7 bg-gradient-to-br from-yellow-400 to-amber-500 text-black shadow-amber-400/40'
            }`}
          >
            {theme === 'dark' ? (
              <Moon className="w-3.5 h-3.5 transition-transform duration-300 -rotate-12" />
            ) : (
              <Sun className="w-3.5 h-3.5 transition-transform duration-300 rotate-90" />
            )}
          </div>
        </button>
      </div>
    </header>
  );
};
