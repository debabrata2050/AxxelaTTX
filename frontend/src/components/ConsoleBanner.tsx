'use client';

import { useEffect } from 'react';

const BANNER = [
  "  /$$$$$$                                /$$                 /$$$$$$$$ /$$$$$$$$ /$$   /$$",
  " /$$__  $$                              | $$                |__  $$__/|__  $$__/| $$  / $$",
  "| $$  \\ $$ /$$   /$$ /$$   /$$  /$$$$$$ | $$  /$$$$$$          | $$      | $$   |  $$/ $$/",
  "| $$$$$$$$|  $$ /$$/|  $$ /$$/ /$$__  $$| $$ |____  $$         | $$      | $$    \\  $$$$/ ",
  "| $$__  $$ \\  $$$$/  \\  $$$$/ | $$$$$$$$| $$  /$$$$$$$         | $$      | $$     >$$  $$ ",
  "| $$  | $$  >$$  $$   >$$  $$ | $$_____/| $$ /$$__  $$         | $$      | $$    /$$/\\  $$",
  "| $$  | $$ /$$/\\  $$ /$$/\\  $$|  $$$$$$$| $$|  $$$$$$$         | $$      | $$   | $$  \\ $$",
  "|__/  |__/|__/  \\__/|__/  \\__/ \\_______/|__/ \\_______/         |__/      |__/   |__/  |__/"
].join('\n');

export const printBranding = (force = false) => {
  if (typeof window === 'undefined') return;

  const win = window as unknown as { __AXXELA_BANNER_PRINTED?: boolean };
  if (!force && win.__AXXELA_BANNER_PRINTED) return;
  win.__AXXELA_BANNER_PRINTED = true;

  console.log(
    `%c${BANNER}\n%c  AXXELA - TRADE TRANSFER (TTX)\n  Institutional Multi-Account Position Transfer\n`,
    'color: #fbe134; font-family: monospace; font-weight: bold; font-size: 11px; line-height: 1.25;',
    'color: #94a3b8; font-family: monospace; font-size: 11px; font-weight: 500;'
  );
};

export function ConsoleBanner() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Getter trigger on window.ttx & window.axxela
    // Typing ttx or ttx() manually allows forced reprint
    try {
      Object.defineProperty(window, 'ttx', {
        configurable: true,
        get() {
          printBranding(true);
          return () => '';
        },
      });
      Object.defineProperty(window, 'axxela', {
        configurable: true,
        get() {
          printBranding(true);
          return () => '';
        },
      });
    } catch {
      const win = window as unknown as { ttx?: () => void; axxela?: () => void };
      win.ttx = () => printBranding(true);
      win.axxela = () => printBranding(true);
    }

    // 2. Initial print on mount (guarded: once only)
    printBranding(false);

    // 3. DevTools Open Event Detection (docked window resize delta)
    const threshold = 160;
    const checkDevTools = () => {
      const widthDelta = window.outerWidth - window.innerWidth > threshold;
      const heightDelta = window.outerHeight - window.innerHeight > threshold;
      if (widthDelta || heightDelta) {
        printBranding(false);
      }
    };

    window.addEventListener('resize', checkDevTools);
    return () => {
      window.removeEventListener('resize', checkDevTools);
    };
  }, []);

  return null;
}
