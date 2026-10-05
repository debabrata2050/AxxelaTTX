'use client';

const STORAGE_KEY = 'trade_theme';
const TRANSITION_MS = 750;

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => {
    ready: Promise<void>;
    finished: Promise<void>;
  };
};

function clearThemeTransition(root: HTMLElement) {
  delete root.dataset.themeTransition;
  root.style.removeProperty('--theme-transition-duration');
  root.style.removeProperty('--theme-transition-clip-from');
}

/**
 * Native View-Transition with expanding circular ripple mask.
 * Adapts coordinates from click event origin.
 */
export function toggleTheme(
  origin?: HTMLElement | null,
  onThemeChange?: (theme: 'dark' | 'light') => void,
  targetTheme?: 'dark' | 'light'
) {
  if (typeof window === 'undefined') return;

  const root = document.documentElement;
  if (root.dataset.themeTransition === 'active') return;

  const isDark = root.classList.contains('dark') || root.getAttribute('data-theme') === 'dark';
  if (targetTheme && ((targetTheme === 'dark' && isDark) || (targetTheme === 'light' && !isDark))) {
    return;
  }
  const nextTheme: 'dark' | 'light' = targetTheme || (isDark ? 'light' : 'dark');

  const transitionDocument = document as ViewTransitionDocument;
  if (typeof transitionDocument.startViewTransition === 'function') {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const bounds = origin?.getBoundingClientRect();
    const x = bounds ? bounds.left + bounds.width / 2 : width / 2;
    const y = bounds ? bounds.top + bounds.height / 2 : height / 2;
    const xPercent = (x / width) * 100;
    const yPercent = (y / height) * 100;
    const radius = Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
    const maxRadius = Math.hypot(width, height) / Math.SQRT2;
    const clipFrom = `circle(0% at ${xPercent}% ${yPercent}%)`;
    const clipTo = `circle(${(radius / maxRadius) * 100}% at ${xPercent}% ${yPercent}%)`;

    root.dataset.themeTransition = 'active';
    root.style.setProperty('--theme-transition-duration', `${TRANSITION_MS}ms`);
    root.style.setProperty('--theme-transition-clip-from', clipFrom);

    const transition = transitionDocument.startViewTransition(() => {
      applyTheme(root, nextTheme);
      onThemeChange?.(nextTheme);
    });

    transition.ready
      .then(() => {
        root.animate(
          { clipPath: [clipFrom, clipTo] },
          {
            duration: TRANSITION_MS,
            easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
            fill: 'forwards',
            pseudoElement: '::view-transition-new(root)',
          } as KeyframeAnimationOptions & { pseudoElement: string }
        );
      })
      .catch(() => undefined);

    transition.finished
      .catch(() => undefined)
      .finally(() => clearThemeTransition(root));
    return;
  }

  // Fallback for browsers without View Transitions
  root.dataset.themeTransition = 'fallback';
  window.setTimeout(() => {
    delete root.dataset.themeTransition;
  }, TRANSITION_MS);
  applyTheme(root, nextTheme);
  onThemeChange?.(nextTheme);
}

export function applyTheme(root: HTMLElement, theme: 'dark' | 'light') {
  const isDark = theme === 'dark';
  root.classList.toggle('dark', isDark);
  root.classList.toggle('light', !isDark);
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = isDark ? 'dark' : 'light';

  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage throws in private browsing
  }
}
