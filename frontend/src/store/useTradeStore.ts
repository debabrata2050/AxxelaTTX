import { create } from 'zustand';
import {
  ContractItem,
  PriceMode,
  ProductType,
  TradeAllocation,
  TradeRecord,
  TransferRoute,
} from '@/types/trade.types';

interface TradeState {
  theme: 'dark' | 'light';
  currentStep: number;
  isMobileDrawerOpen: boolean;
  isSidebarCollapsed: boolean;

  // Active File & Metadata
  activeFilePath: string | null;
  activeFilename: string | null;
  clientGroup: string;
  defaultDate: string | null;
  accountCount: number;
  tradeCount: number;

  // Step 1: Routes
  routes: TransferRoute[];

  // Step 2: Contracts & Filtering
  contracts: ContractItem[];
  selectedContracts: string[];
  selectedProduct: ProductType;
  selectedSenderAccount: string;
  contractSearchQuery: string;

  // Step 3: Pricing & Allocations
  trades: TradeRecord[];
  allocations: Record<string, TradeAllocation>;
  priceMode: PriceMode;
  globalManualPrice: number | null;

  // Step 4: Preview & Export
  previewHeaders: string[];
  previewRows: (string | number | null)[][];
  previewSummary: any;
  exportFilename: string;

  // Feedback & UI State
  isLoading: boolean;
  loadingTitle: string;
  loadingSubtitle: string;
  alert: { title: string; message: string } | null;

  // Actions
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;
  setStep: (step: number) => void;
  toggleMobileDrawer: (open?: boolean) => void;
  toggleSidebarCollapsed: () => void;

  setActiveFile: (data: {
    filePath: string;
    filename: string;
    clientGroup?: string;
    date?: string;
    accounts?: string[];
    recordCount?: number;
  }) => void;

  addRoute: (from: string, to: string) => boolean;
  removeRoute: (index: number) => void;

  setContracts: (contracts: ContractItem[]) => void;
  setSelectedProduct: (prod: ProductType) => void;
  setSelectedSenderAccount: (acc: string) => void;
  setContractSearchQuery: (q: string) => void;
  toggleContract: (contractId: string) => void;
  selectAllContracts: () => void;
  clearAllContracts: () => void;

  setTrades: (trades: TradeRecord[]) => void;
  setPriceMode: (mode: PriceMode) => void;
  setGlobalManualPrice: (price: number | null) => void;
  updateAllocation: (rowId: string, updates: Partial<TradeAllocation>) => void;
  fillAllBalances: () => void;
  resetAllocations: () => void;
  toggleTradeCheckAll: (checked: boolean) => void;

  setPreviewData: (headers: string[], rows: (string | number | null)[][], summary: any) => void;
  updatePreviewCell: (r: number, c: number, val: string | number | null) => void;
  setExportFilename: (name: string) => void;

  showLoading: (title: string, subtitle?: string) => void;
  hideLoading: () => void;
  showAlert: (title: string, message: string) => void;
  hideAlert: () => void;
  resetSession: () => void;
}

const STORAGE_KEY = 'axxela_trade_wizard_session';

export const useTradeStore = create<TradeState>((set, get) => ({
  theme: 'dark',
  currentStep: 0,
  isMobileDrawerOpen: false,
  isSidebarCollapsed: false,

  activeFilePath: null,
  activeFilename: null,
  clientGroup: 'SYM',
  defaultDate: null,
  accountCount: 0,
  tradeCount: 0,

  routes: [],

  contracts: [],
  selectedContracts: [],
  selectedProduct: 'ALL',
  selectedSenderAccount: 'ALL',
  contractSearchQuery: '',

  trades: [],
  allocations: {},
  priceMode: 'price',
  globalManualPrice: null,

  previewHeaders: [],
  previewRows: [],
  previewSummary: null,
  exportFilename: '',

  isLoading: false,
  loadingTitle: '',
  loadingSubtitle: '',
  alert: null,

  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      document.documentElement.classList.toggle('light', theme === 'light');
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('trade_theme', theme);
    }
    set({ theme });
  },

  toggleTheme: () => {
    const nextTheme = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(nextTheme);
  },

  setStep: (step) => set({ currentStep: step, isMobileDrawerOpen: false }),

  toggleMobileDrawer: (open) =>
    set((state) => ({
      isMobileDrawerOpen: open !== undefined ? open : !state.isMobileDrawerOpen,
    })),

  toggleSidebarCollapsed: () =>
    set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

  setActiveFile: ({ filePath, filename, clientGroup, date, accounts, recordCount }) =>
    set({
      activeFilePath: filePath,
      activeFilename: filename,
      clientGroup: clientGroup || 'SYM',
      defaultDate: date || null,
      accountCount: accounts ? accounts.length : 0,
      tradeCount: recordCount || 0,
      currentStep: 1,
      routes: [],
      selectedContracts: [],
      allocations: {},
      previewRows: [],
      exportFilename: '',
    }),

  addRoute: (from, to) => {
    const uFrom = from.trim().toUpperCase();
    const uTo = to.trim().toUpperCase();
    if (!uFrom || !uTo) return false;
    if (uFrom === uTo) return false;

    const existing = get().routes;
    if (existing.some((r) => r.from === uFrom && r.to === uTo)) return false;

    set({ routes: [...existing, { from: uFrom, to: uTo }] });
    return true;
  },

  removeRoute: (index) =>
    set((state) => ({
      routes: state.routes.filter((_, i) => i !== index),
    })),

  setContracts: (contracts) => set({ contracts }),

  setSelectedProduct: (prod) => set({ selectedProduct: prod }),

  setSelectedSenderAccount: (acc) => set({ selectedSenderAccount: acc }),

  setContractSearchQuery: (q) => set({ contractSearchQuery: q }),

  toggleContract: (contractId) =>
    set((state) => {
      const exists = state.selectedContracts.includes(contractId);
      return {
        selectedContracts: exists
          ? state.selectedContracts.filter((id) => id !== contractId)
          : [...state.selectedContracts, contractId],
      };
    }),

  selectAllContracts: () =>
    set((state) => ({
      selectedContracts: state.contracts.map(
        (c) =>
          c.contract_key ||
          (c.account ? `${c.account}::${c.contract_id || c.contractcode}` : c.contract_id || c.contractcode)
      ),
    })),

  clearAllContracts: () =>
    set((state) => {
      const visibleIds = state.contracts.map(
        (c) =>
          c.contract_key ||
          (c.account ? `${c.account}::${c.contract_id || c.contractcode}` : c.contract_id || c.contractcode)
      );
      const anySelected = visibleIds.some((id) => state.selectedContracts.includes(id));
      if (anySelected) {
        return {
          selectedContracts: state.selectedContracts.filter((id) => !visibleIds.includes(id)),
        };
      }
      return { selectedContracts: [] };
    }),

  setTrades: (trades) =>
    set((state) => {
      const newAllocations = { ...state.allocations };
      trades.forEach((t) => {
        const accStr = String(t.account || '').toUpperCase();
        const matchingRoutes = state.routes.filter((r) => r.from.toUpperCase() === accStr);
        const defaultTo = matchingRoutes.length > 0 ? matchingRoutes[0].to : '';

        if (!newAllocations[t.row_id]) {
          newAllocations[t.row_id] = {
            selected: true,
            transfer_qty: t.qtybalance,
            custom_price:
              state.priceMode === 'settle'
                ? t.settle || t.price
                : state.priceMode === 'manual' && state.globalManualPrice !== null
                ? state.globalManualPrice
                : t.price,
            to_account: defaultTo,
          };
        } else if (!newAllocations[t.row_id].to_account && defaultTo) {
          newAllocations[t.row_id].to_account = defaultTo;
        }
      });
      return { trades, allocations: newAllocations };
    }),

  setPriceMode: (mode) =>
    set((state) => {
      const updatedAlloc = { ...state.allocations };
      state.trades.forEach((t) => {
        if (updatedAlloc[t.row_id]) {
          if (mode === 'settle') {
            updatedAlloc[t.row_id].custom_price = t.settle || t.price;
          } else if (mode === 'manual' && state.globalManualPrice !== null) {
            updatedAlloc[t.row_id].custom_price = state.globalManualPrice;
          } else {
            updatedAlloc[t.row_id].custom_price = t.price;
          }
        }
      });
      return { priceMode: mode, allocations: updatedAlloc };
    }),

  setGlobalManualPrice: (price) =>
    set((state) => {
      const updatedAlloc = { ...state.allocations };
      if (state.priceMode === 'manual' && price !== null) {
        state.trades.forEach((t) => {
          if (updatedAlloc[t.row_id]) {
            updatedAlloc[t.row_id].custom_price = price;
          }
        });
      }
      return { globalManualPrice: price, allocations: updatedAlloc };
    }),

  updateAllocation: (rowId, updates) =>
    set((state) => ({
      allocations: {
        ...state.allocations,
        [rowId]: {
          ...(state.allocations[rowId] || {
            selected: true,
            transfer_qty: 0,
            custom_price: 0,
            to_account: '',
          }),
          ...updates,
        },
      },
    })),

  fillAllBalances: () =>
    set((state) => {
      const nextAlloc = { ...state.allocations };
      state.trades.forEach((t) => {
        if (nextAlloc[t.row_id]) {
          nextAlloc[t.row_id].selected = true;
          nextAlloc[t.row_id].transfer_qty = t.qtybalance;
        }
      });
      return { allocations: nextAlloc };
    }),

  resetAllocations: () =>
    set((state) => {
      const nextAlloc = { ...state.allocations };
      state.trades.forEach((t) => {
        if (nextAlloc[t.row_id]) {
          nextAlloc[t.row_id].selected = false;
          nextAlloc[t.row_id].transfer_qty = 0;
        }
      });
      return { allocations: nextAlloc };
    }),

  toggleTradeCheckAll: (checked) =>
    set((state) => {
      const nextAlloc = { ...state.allocations };
      state.trades.forEach((t) => {
        if (nextAlloc[t.row_id]) {
          nextAlloc[t.row_id].selected = checked;
          if (checked && nextAlloc[t.row_id].transfer_qty === 0) {
            nextAlloc[t.row_id].transfer_qty = t.qtybalance;
          }
        }
      });
      return { allocations: nextAlloc };
    }),

  setPreviewData: (headers, rows, summary) =>
    set({ previewHeaders: headers, previewRows: rows, previewSummary: summary }),

  updatePreviewCell: (r, c, val) =>
    set((state) => {
      const nextRows = state.previewRows.map((row, ri) =>
        ri === r ? row.map((cell, ci) => (ci === c ? val : cell)) : row
      );
      return { previewRows: nextRows };
    }),

  setExportFilename: (name) => set({ exportFilename: name }),

  showLoading: (title, subtitle = '') =>
    set({ isLoading: true, loadingTitle: title, loadingSubtitle: subtitle }),

  hideLoading: () => set({ isLoading: false }),

  showAlert: (title, message) => set({ alert: { title, message } }),

  hideAlert: () => set({ alert: null }),

  resetSession: () => {
    fetch('/api/unload-file', { method: 'POST' }).catch(() => {});
    set({
      currentStep: 0,
      activeFilePath: null,
      activeFilename: null,
      clientGroup: 'SYM',
      defaultDate: null,
      accountCount: 0,
      tradeCount: 0,
      routes: [],
      contracts: [],
      selectedContracts: [],
      selectedProduct: 'ALL',
      selectedSenderAccount: 'ALL',
      contractSearchQuery: '',
      trades: [],
      allocations: {},
      priceMode: 'price',
      globalManualPrice: null,
      previewHeaders: [],
      previewRows: [],
      previewSummary: null,
      exportFilename: '',
      alert: null,
      isLoading: false,
    });
  },
}));
