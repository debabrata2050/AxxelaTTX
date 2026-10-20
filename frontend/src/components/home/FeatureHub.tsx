'use client';

import React from 'react';
import { useTradeStore } from '@/store/useTradeStore';
import { useOnboardingStore } from '@/store/useOnboardingStore';
import { ArrowLeftRight, Users, ArrowUpRight, Scale, Layers } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface FeatureHubProps {
  onSelectMode: (mode: 'trade' | 'onboarding' | 'stonex' | 'kgi') => void;
  onOpenFileModal?: () => void;
  onOpenRules?: () => void;
}

const WORKSPACES = [
  {
    id: 'trade' as const,
    title: 'Trade Position Transfer',
    route: '/trade-transfer',
    desc: 'Portfolio Transfer Engine',
    icon: ArrowLeftRight,
    badgeVariant: 'gold' as const,
    cardBg:
      'bg-gradient-to-br from-amber-500/12 via-card to-card dark:from-amber-500/10 dark:via-card/95 dark:to-card',
    iconContainer:
      'bg-gradient-to-br from-[#ffd54f] via-[#faa000] to-[#f57c00] text-black shadow-lg shadow-amber-500/30 border border-amber-300/70',
    hoverBorder: 'hover:border-amber-500/70 dark:hover:border-amber-400/70 hover:shadow-amber-500/15',
    hoverText: 'group-hover:text-amber-800 dark:group-hover:text-amber-300',
    arrowGradient: 'from-[#ffd54f] via-[#faa000] to-[#f57c00]',
  },
  {
    id: 'onboarding' as const,
    title: 'People Onboarding',
    route: '/people-onboard',
    desc: 'Personnel Provisioning',
    icon: Users,
    badgeVariant: 'emerald' as const,
    cardBg:
      'bg-gradient-to-br from-emerald-500/12 via-card to-card dark:from-emerald-500/10 dark:via-card/95 dark:to-card',
    iconContainer:
      'bg-gradient-to-br from-[#34d399] via-[#10b981] to-[#047857] text-black shadow-lg shadow-emerald-500/30 border border-emerald-300/70',
    hoverBorder: 'hover:border-emerald-500/70 dark:hover:border-emerald-400/70 hover:shadow-emerald-500/15',
    hoverText: 'group-hover:text-emerald-800 dark:group-hover:text-emerald-300',
    arrowGradient: 'from-[#34d399] via-[#10b981] to-[#047857]',
  },
  {
    id: 'stonex' as const,
    title: 'StoneX Netting',
    route: '/stonex-netting',
    desc: 'Consolidation (LCE30553)',
    icon: Scale,
    badgeVariant: 'sky' as const,
    cardBg:
      'bg-gradient-to-br from-sky-500/12 via-card to-card dark:from-sky-500/10 dark:via-card/95 dark:to-card',
    iconContainer:
      'bg-gradient-to-br from-[#38bdf8] via-[#0ea5e9] to-[#0284c7] text-black shadow-lg shadow-sky-500/30 border border-sky-300/70',
    hoverBorder: 'hover:border-sky-500/70 dark:hover:border-sky-400/70 hover:shadow-sky-500/15',
    hoverText: 'group-hover:text-sky-800 dark:group-hover:text-sky-300',
    arrowGradient: 'from-[#38bdf8] via-[#0ea5e9] to-[#0284c7]',
  },
  {
    id: 'kgi' as const,
    title: 'KGI Netting',
    route: '/kgi-netting',
    desc: 'Consolidation (KT513Z)',
    icon: Layers,
    badgeVariant: 'indigo' as const,
    cardBg:
      'bg-gradient-to-br from-indigo-500/12 via-card to-card dark:from-indigo-500/10 dark:via-card/95 dark:to-card',
    iconContainer:
      'bg-gradient-to-br from-[#a5b4fc] via-[#6366f1] to-[#4338ca] text-black shadow-lg shadow-indigo-500/30 border border-indigo-300/70',
    hoverBorder: 'hover:border-indigo-500/70 dark:hover:border-indigo-400/70 hover:shadow-indigo-500/15',
    hoverText: 'group-hover:text-indigo-800 dark:group-hover:text-indigo-300',
    arrowGradient: 'from-[#a5b4fc] via-[#6366f1] to-[#4338ca]',
  },
];

export const FeatureHub: React.FC<FeatureHubProps> = ({ onSelectMode }) => {
  const { activeFilePath, activeFilename, currentStep } = useTradeStore();
  const { rows } = useOnboardingStore();

  const hasActiveTradeSession = Boolean(activeFilePath || activeFilename);
  const onboardingCount = rows.length;

  return (
    <div className="relative min-h-[calc(100vh-8rem)] flex flex-col justify-center items-center py-10 px-4 overflow-hidden select-none">
      {/* ── Main Content Container ── */}
      <div className="relative z-10 w-full max-w-4xl flex flex-col items-center gap-8 sm:gap-10 animate-in fade-in duration-300">
        {/* ── Brand Header ── */}
        <div className="flex flex-col items-center text-center gap-4">
          <div className="relative group cursor-pointer transition-transform duration-300 hover:scale-105">
            {/* Ambient luxury gold gradient glow */}
            <div className="absolute -inset-3 rounded-3xl bg-gradient-to-tr from-amber-400/25 via-yellow-400/20 to-amber-500/25 dark:from-amber-500/35 dark:via-yellow-400/25 dark:to-amber-600/35 blur-xl opacity-60 dark:opacity-75 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            {/* Gradient border badge container */}
            <div className="relative size-16 sm:size-20 rounded-2xl p-[1.5px] bg-gradient-to-b from-amber-400/80 via-amber-500/40 to-amber-500/20 dark:from-amber-400/70 dark:via-amber-500/30 dark:to-amber-500/10 shadow-lg dark:shadow-2xl">
              <div className="w-full h-full rounded-[14px] bg-white dark:bg-gradient-to-b dark:from-card/90 dark:via-card dark:to-black/60 flex items-center justify-center p-3.5 backdrop-blur-sm border border-amber-400/40 dark:border-amber-500/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo.svg"
                  alt="Axxela Logo"
                  className="w-full h-full object-contain drop-shadow-[0_2px_10px_rgba(251,191,36,0.4)]"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1">
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight uppercase text-slate-950 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-b dark:from-white dark:via-slate-100 dark:to-slate-300">
              Axxela
            </h1>
          </div>
        </div>

        {/* ── Feature Cards Grid ── */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {WORKSPACES.map((ws) => {
            const Icon = ws.icon;
            const isTrade = ws.id === 'trade';
            const isOnboarding = ws.id === 'onboarding';

            return (
              <Card
                key={ws.id}
                onClick={() => onSelectMode(ws.id)}
                className={cn(
                  'group relative flex items-center justify-between p-5 sm:p-6 rounded-2xl border border-slate-200/90 dark:border-border/80 cursor-pointer transition-all duration-300 hover:-translate-y-1 active:scale-[0.99] shadow-xs hover:shadow-xl dark:hover:shadow-2xl backdrop-blur-xs',
                  ws.cardBg,
                  ws.hoverBorder
                )}
              >
                {/* Active Indicators */}
                {isTrade && hasActiveTradeSession && (
                  <Badge
                    variant="gold"
                    className="absolute top-3.5 right-3.5 flex items-center gap-1.5 px-2.5 py-0.5"
                  >
                    <span className="size-1.5 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse" />
                    <span>Active (Step {currentStep + 1})</span>
                  </Badge>
                )}

                {isOnboarding && onboardingCount > 0 && (
                  <Badge
                    variant="emerald"
                    className="absolute top-3.5 right-3.5 flex items-center gap-1.5 px-2.5 py-0.5"
                  >
                    <span className="size-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                    <span>{onboardingCount} Drafts</span>
                  </Badge>
                )}

                <div className="flex items-center gap-4 sm:gap-4.5 min-w-0">
                  {/* Symbol with rich gradient background */}
                  <div
                    className={cn(
                      'size-13 sm:size-14 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-108 group-hover:rotate-1 shrink-0',
                      ws.iconContainer
                    )}
                  >
                    <Icon className="size-6 sm:size-7 drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" />
                  </div>

                  {/* Title & Path */}
                  <div className="min-w-0">
                    <h2
                      className={cn(
                        'text-base sm:text-lg font-bold text-slate-900 dark:text-foreground transition-colors truncate',
                        ws.hoverText
                      )}
                    >
                      {ws.title}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <Badge variant={ws.badgeVariant} className="text-[10px] px-2 py-0 font-mono">
                        {ws.route}
                      </Badge>
                      <span className="text-[11px] font-mono text-slate-500 dark:text-muted-foreground font-medium truncate">
                        {ws.desc}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Launch Arrow Action */}
                <div className="relative size-9 sm:size-10 rounded-xl overflow-hidden text-slate-700 dark:text-muted-foreground group-hover:text-black transition-colors duration-300 shrink-0 ml-3 flex items-center justify-center shadow-xs">
                  {/* Base surface with border */}
                  <div className="absolute inset-0 rounded-xl bg-slate-100 dark:bg-accent/40 border border-slate-200/90 dark:border-border/60 transition-opacity duration-300 group-hover:opacity-0" />

                  {/* Gradient hover surface (borderless, seamless, zero subpixel fringe) */}
                  <div
                    className={cn(
                      'absolute inset-0 rounded-xl bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300',
                      ws.arrowGradient
                    )}
                  />

                  {/* Arrow Icon */}
                  <ArrowUpRight className="relative z-10 size-4.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};
