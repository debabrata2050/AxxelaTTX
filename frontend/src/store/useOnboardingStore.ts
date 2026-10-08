import { create } from 'zustand';
import {
  OnboardingRow,
  OnboardingUserInput,
  OnboardingDerived,
  EMPTY_USER_INPUT,
} from '@/types/onboarding.types';
import { fetchDerivedPreview, exportOnboardingExcel } from '@/lib/onboardingClient';

const genId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

interface OnboardingState {
  rows: OnboardingRow[];
  isExporting: boolean;
  exportError: string | null;

  addRow: (input: OnboardingUserInput, derived: OnboardingDerived) => void;
  removeRow: (id: string) => void;
  clearAll: () => void;
  exportExcel: (filename?: string) => Promise<void>;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  rows: [],
  isExporting: false,
  exportError: null,

  addRow(input, derived) {
    const row: OnboardingRow = { ...input, id: genId(), derived };
    set((s) => ({ rows: [...s.rows, row] }));
  },

  removeRow(id) {
    set((s) => ({ rows: s.rows.filter((r) => r.id !== id) }));
  },

  clearAll() {
    set({ rows: [] });
  },

  async exportExcel(filename = 'Onboarding.xlsx') {
    const { rows } = get();
    if (!rows.length) return;
    set({ isExporting: true, exportError: null });
    try {
      // Send only user-input fields; backend re-derives everything
      const payload: OnboardingUserInput[] = rows.map(({ id: _id, derived: _d, ...input }) => input);
      const blob = await exportOnboardingExcel(payload, filename);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      set({ exportError: e.message || 'Export failed' });
    } finally {
      set({ isExporting: false });
    }
  },
}));

// ─── Helper: call backend preview and return derived fields ───────────────────
export async function previewDerived(
  input: Partial<OnboardingUserInput>,
): Promise<OnboardingDerived> {
  return fetchDerivedPreview(input);
}
