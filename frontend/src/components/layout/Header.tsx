'use client';

import React from 'react';
import { useTradeStore } from '@/store/useTradeStore';
import { Menu, Sun, Moon, FileText } from 'lucide-react';
import { toggleTheme } from '@/lib/theme';

interface HeaderProps {
  onOpenFileModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenFileModal }) => {
  const {
    theme,
    activeFilename,
    accountCount,
    tradeCount,
    toggleMobileDrawer,
  } = useTradeStore();

  return (
    <header className="h-14 px-4 sm:px-6 lg:px-8 border-b border-[var(--border-subtle)] bg-[var(--header-bg)] flex items-center justify-between sticky top-0 z-30 transition-colors">
      {/* Left: Mobile Menu & Active File Pill */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => toggleMobileDrawer(true)}
          className="p-1.5 rounded-lg border border-[var(--border-card)] text-[var(--text-sub)] hover:text-[var(--accent-gold)] lg:hidden transition active:scale-95 cursor-pointer"
          aria-label="Toggle navigation drawer"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Active File Widget with Change Button in Header */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--card-bg)] border border-[var(--border-card)] text-xs shadow-sm max-w-[280px] sm:max-w-md truncate">
          <FileText className="w-3.5 h-3.5 text-[var(--accent-gold)] flex-shrink-0" />
          <span className="truncate font-mono font-medium text-[var(--text-main)]">
            {activeFilename || 'No file selected'}
          </span>
          <button
            onClick={onOpenFileModal}
            className="text-[11px] font-bold text-[var(--accent-gold)] hover:underline flex-shrink-0 ml-1 cursor-pointer"
          >
            Change
          </button>
        </div>
      </div>

      {/* Right: Theme Toggle & Realtime Stats */}
      <div className="flex items-center gap-3 sm:gap-4 text-xs font-mono">
        {/* Theme Switcher in Header with Micro-Animations & View Transition Ripple */}
        <div className="flex items-center p-0.5 rounded-full bg-[var(--input-bg)] border border-[var(--border-card)] shadow-inner">
          <button
            type="button"
            onClick={(e) =>
              toggleTheme(
                e.currentTarget,
                (nextTheme) => useTradeStore.getState().setTheme(nextTheme),
                'dark'
              )
            }
            className={`group relative flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all duration-300 cursor-pointer active:scale-90 ${theme === 'dark'
                ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-black shadow-[0_2px_12px_rgba(251,225,52,0.4)] scale-[1.04]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:scale-105'
              }`}
            title="Dark Theme"
            aria-label="Switch to Dark Theme"
          >
            <Moon className="w-3.5 h-3.5 transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110" />
            <span className="hidden sm:inline">Dark</span>
          </button>

          <button
            type="button"
            onClick={(e) =>
              toggleTheme(
                e.currentTarget,
                (nextTheme) => useTradeStore.getState().setTheme(nextTheme),
                'light'
              )
            }
            className={`group relative flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all duration-300 cursor-pointer active:scale-90 ${theme === 'light'
                ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-black shadow-[0_2px_12px_rgba(212,155,14,0.4)] scale-[1.04]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:scale-105'
              }`}
            title="Light Theme"
            aria-label="Switch to Light Theme"
          >
            <Sun className="w-3.5 h-3.5 transition-transform duration-500 group-hover:rotate-90 group-hover:scale-110" />
            <span className="hidden sm:inline">Light</span>
          </button>
        </div>

        {/* Stats Counters */}
        <div className="hidden sm:flex items-center gap-2">
          <div className="px-3 py-1 rounded-full bg-[var(--card-bg)] border border-[var(--border-subtle)] text-[var(--text-muted)]">
            Accounts: <strong className="text-[var(--accent-gold)] font-bold">{accountCount}</strong>
          </div>
          <div className="px-3 py-1 rounded-full bg-[var(--card-bg)] border border-[var(--border-subtle)] text-[var(--text-muted)]">
            Records: <strong className="text-[var(--accent-gold)] font-bold">{tradeCount}</strong>
          </div>
        </div>
      </div>
    </header>
  );
};
