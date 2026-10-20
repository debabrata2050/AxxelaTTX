'use client';

import React, { useState, useEffect } from 'react';
import { useTradeStore, AppModule } from '@/store/useTradeStore';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  activeModule?: AppModule;
  onOpenFileModal: () => void;
  onOpenRulesModal?: () => void;
}

const LiveClock = React.memo(function LiveClock() {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const formatted = new Date().toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      });
      setCurrentTime((prev) => (prev !== formatted ? formatted : prev));
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!currentTime) return null;

  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-card border border-border text-foreground shadow-xs shrink-0 select-none transition-colors"
      title="Local System Time"
    >
      <Clock className="size-3.5 text-primary shrink-0" />
      <span className="font-mono text-[11px] sm:text-xs font-semibold tracking-tight text-foreground">
        {currentTime}
      </span>
    </div>
  );
});

export const Header: React.FC<HeaderProps> = ({
  activeModule: propActiveModule,
  onOpenFileModal,
  onOpenRulesModal,
}) => {
  const {
    theme,
    activeModule: storeActiveModule,
    activeFilename,
    accountCount,
    tradeCount,
    toggleMobileDrawer,
  } = useTradeStore();

  const activeModule = propActiveModule ?? storeActiveModule;

  const { rows } = useOnboardingStore();
  const onboardingCount = rows.length;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDomDark =
        document.documentElement.getAttribute('data-theme') === 'dark' ||
        (document.documentElement.classList.contains('dark') &&
          !document.documentElement.classList.contains('light'));
      const activeTheme = isDomDark ? 'dark' : 'light';
      if (useTradeStore.getState().theme !== activeTheme) {
        useTradeStore.getState().setTheme(activeTheme);
      }
    }
  }, []);

  return (
    <header className="h-14 px-3 sm:px-6 lg:px-8 border-b border-border bg-card/60 backdrop-blur-md flex items-center justify-between sticky top-0 z-30 transition-colors">
      {/* ── Left: Hamburger Menu (Mobile/Tablet) ── */}
      <div className="flex items-center min-w-0">
        <Button
          variant="outline"
          size="icon"
          onClick={() => toggleMobileDrawer(true)}
          className="lg:hidden shrink-0"
          aria-label="Toggle navigation drawer"
        >
          <Menu className="size-4" />
        </Button>
      </div>

      {/* ── Center: Clean Spacer ── */}
      <div className="flex-1" />

      {/* ── Right: Contextual Stats & Smooth Theme Toggle ── */}
      <div className="flex items-center gap-2 sm:gap-3 text-xs font-mono">
        {/* Contextual Widget for Trade Mode */}
        {activeModule === 'trade' && (
          <div className="hidden min-[440px]:flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-card border border-border text-xs shadow-xs max-w-[160px] sm:max-w-xs truncate">
              <FileText className="size-3.5 text-primary shrink-0" />
              <span className="truncate font-mono font-medium text-foreground text-[11px]">
                {activeFilename || 'No file selected'}
              </span>
              <button
                type="button"
                onClick={onOpenFileModal}
                className="text-[11px] font-bold text-primary hover:underline shrink-0 ml-1 cursor-pointer"
              >
                Change
              </button>
            </div>

            <div className="hidden xl:flex items-center gap-1.5 text-[11px]">
              <Badge variant="secondary" className="font-normal text-muted-foreground">
                Acc: <strong className="text-primary font-bold ml-1">{accountCount}</strong>
              </Badge>
              <Badge variant="secondary" className="font-normal text-muted-foreground">
                Rec: <strong className="text-primary font-bold ml-1">{tradeCount}</strong>
              </Badge>
            </div>
          </div>
        )}

        {/* Contextual Widget for People Onboarding Mode */}
        {activeModule === 'onboarding' && (
          <div className="hidden min-[440px]:flex items-center gap-2">
            <Badge variant="emerald" className="flex items-center gap-1.5 py-1 px-3">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              <span>Drafts: {onboardingCount}</span>
            </Badge>

            {onOpenRulesModal && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOpenRulesModal}
                className="h-7 rounded-full px-3 text-[11px] gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <Settings2 className="size-3 text-primary" />
                <span className="hidden sm:inline">Config</span>
              </Button>
            )}
          </div>
        )}

        {/* Contextual Widget for StoneX Netting Mode */}
        {activeModule === 'stonex' && (
          <div className="hidden min-[440px]:flex items-center gap-2">
            <Badge variant="sky" className="flex items-center gap-1.5 py-1 px-3">
              <span className="size-1.5 rounded-full bg-sky-400" />
              <span>StoneX Netting: <strong className="text-primary font-mono ml-1">LCE30553</strong></span>
            </Badge>
          </div>
        )}

        {/* Contextual Widget for KGI Netting Mode */}
        {activeModule === 'kgi' && (
          <div className="hidden min-[440px]:flex items-center gap-2">
            <Badge variant="sky" className="flex items-center gap-1.5 py-1 px-3">
              <span className="size-1.5 rounded-full bg-sky-400" />
              <span>KGI Netting: <strong className="text-sky-300 font-mono ml-1">KT513Z</strong></span>
            </Badge>
          </div>
        )}

        {/* ── Live Local Time Clock Pill ── */}
        <LiveClock />

        {/* ── Modern Minimalist Theme Toggle (Preserves Ripple Transition) ── */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={(e) =>
            toggleTheme(
              e.currentTarget,
              (nextTheme) => useTradeStore.getState().setTheme(nextTheme)
            )
          }
          className="size-8.5 rounded-full border-border bg-card/80 hover:bg-muted text-foreground transition-all duration-300 relative overflow-hidden shrink-0 shadow-2xs"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          aria-label="Toggle theme"
        >
          <Sun className="size-4 text-amber-500 transition-all duration-500 rotate-0 scale-100 dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute size-4 text-amber-400 transition-all duration-500 rotate-90 scale-0 dark:rotate-0 dark:scale-100" />
        </Button>
      </div>
    </header>
  );
};
