import { create } from 'zustand';
import {
  ContractItem,
  PriceMode,
  ProductType,
  TradeAllocation,
  TradeRecord,
  TransferRoute,
} from '@/types/trade.types';

let sessionChannel: BroadcastChannel | null = null;
const TAB_ID = typeof window !== 'undefined' ? Math.random().toString(36).slice(2, 9) : 'server';

if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    sessionChannel = new BroadcastChannel('trade_session');
    sessionChannel.onmessage = (event) => {
      const data = event.data;
      if (data && data.tabId !== TAB_ID) {
        const currentSession = useTradeStore.getState().sessionId;
        if (currentSession && data.sessionId && data.sessionId !== currentSession) {
          useTradeStore.getState().setMultiTabConflict(true);
        }
      }
    };
  } catch (e) {
    console.warn('BroadcastChannel error', e);
  }
}

function broadcastSession(sessionId: string | null) {
  if (sessionChannel && sessionId) {
    try {
      sessionChannel.postMessage({
        sessionId,
        tabId: TAB_ID,
        timestamp: Date.now(),
      });
    } catch (e) {
      console.warn('BroadcastChannel postMessage error', e);
    }
  }
}

export type AppModule = 'home' | 'trade' | 'onboarding';

interface TradeState {
  theme: 'dark' | 'light';
  activeModule: AppModule;
  currentStep: number;
  isMobileDrawerOpen: boolean;
  isSidebarCollapsed: boolean;

  // Session & Lifecycle
  sessionId: string | null;
  sessionMismatch: boolean;
  multiTabConflict: boolean;


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
  allLoadedContracts: Record<string, ContractItem>;
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
  outputMode: 'paired' | 'batched';

  // Feedback & UI State
  isLoading: boolean;
  loadingTitle: string;
  loadingSubtitle: string;
  loadingSteps: import('@/types/trade.types').LoadingStepItem[];
  loadingProgress: number;
  alert: { title: string; message: string } | null;

  // Actions
  setActiveModule: (module: AppModule) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;
  setStep: (step: number) => void;
  toggleMobileDrawer: (open?: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setSessionMismatch: (mismatch: boolean) => void;
  setMultiTabConflict: (conflict: boolean) => void;

  setActiveFile: (data: {
    filePath: string;
    filename: string;
    clientGroup?: string;
    date?: string;
    accounts?: string[];
    recordCount?: number;
    sessionId?: string;
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
  setOutputMode: (mode: 'paired' | 'batched') => void;

  showLoading: (title: string, subtitle?: string) => void;
  showLoadingSteps: (title: string, subtitle: string, stepLabels: string[]) => void;
  updateLoadingStep: (
    stepIndexOrId: number | string,
    status: 'pending' | 'in_progress' | 'completed' | 'error',
    progress?: number
  ) => void;
  setLoadingProgress: (progress: number) => void;
  hideLoading: () => void;
  showAlert: (title: string, message: string) => void;
  hideAlert: () => void;
  resetSession: () => void;
}

const STORAGE_KEY = 'axxela_trade_wizard_session';

export const useTradeStore = create<TradeState>((set, get) => ({
  theme: 'dark',
  activeModule: 'home',
  currentStep: 0,
  isMobileDrawerOpen: false,
  isSidebarCollapsed: false,

  sessionId: null,
  sessionMismatch: false,
  multiTabConflict: false,

  activeFilePath: null,
  activeFilename: null,
  clientGroup: 'SYM',
  defaultDate: null,
  accountCount: 0,
  tradeCount: 0,

  routes: [],

  contracts: [],
  allLoadedContracts: {},
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
  outputMode: 'paired',

  isLoading: false,
  loadingTitle: '',
  loadingSubtitle: '',
  loadingSteps: [],
  loadingProgress: 0,
  alert: null,

  setActiveModule: (module) => set({ activeModule: module }),

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

  setStep: (step) =>
    set((state) => {
      const isBackward = step < state.currentStep;
      return {
        currentStep: step,
        isMobileDrawerOpen: false,
        ...(isBackward && state.previewRows.length > 0 ? { previewRows: [], previewSummary: null } : {}),
      };
    }),

  toggleMobileDrawer: (open) =>
    set((state) => ({
      isMobileDrawerOpen: open !== undefined ? open : !state.isMobileDrawerOpen,
    })),

  toggleSidebarCollapsed: () =>
    set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

  setSessionMismatch: (sessionMismatch) => set({ sessionMismatch }),
  setMultiTabConflict: (multiTabConflict) => set({ multiTabConflict }),

  setActiveFile: ({ filePath, filename, clientGroup, date, accounts, recordCount, sessionId }) => {
    const sId = sessionId || null;
    if (typeof window !== 'undefined') {
      if (sId) localStorage.setItem('trade_session_id', sId);
      if (filePath) localStorage.setItem('trade_file_path', filePath);
    }
    broadcastSession(sId);
    set({
      sessionId: sId,
      sessionMismatch: false,
      multiTabConflict: false,
      activeFilePath: filePath,
      activeFilename: filename,
      clientGroup: clientGroup || 'SYM',
      defaultDate: date || null,
      accountCount: accounts ? accounts.length : 0,
      tradeCount: recordCount || 0,
      currentStep: 1,
      routes: [],
      contracts: [],
      allLoadedContracts: {},
      selectedContracts: [],
      allocations: {},
      previewRows: [],
      previewSummary: null,
      exportFilename: '',
      outputMode: 'paired',
    });
  },

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

  setContracts: (contracts) =>
    set((state) => {
      const nextMap = { ...state.allLoadedContracts };
      contracts.forEach((c) => {
        const key =
          c.contract_key ||
          (c.account ? `${c.account}::${c.contract_id || c.contractcode}` : c.contract_id || c.contractcode);
        if (key) {
          nextMap[key] = c;
        }
      });

      // Edge case 6: Clean allocations for contracts that are no longer part of active list
      const validCodes = new Set(contracts.map((c) => c.contractcode || c.contract_id));
      const validTrades = state.trades.filter((t) => validCodes.has(t.contractcode));
      const validTradeIds = new Set(validTrades.map((t) => t.row_id));
      const filteredAlloc: Record<string, TradeAllocation> = {};
      Object.keys(state.allocations).forEach((rid) => {
        if (validTradeIds.has(rid)) {
          filteredAlloc[rid] = state.allocations[rid];
        }
      });

      return { contracts, allLoadedContracts: nextMap, trades: validTrades, allocations: filteredAlloc };
    }),

  setOutputMode: (mode) => set({ outputMode: mode }),

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
                ? t.settle ?? t.price
                : state.priceMode === 'manual' && state.globalManualPrice !== null
                ? state.globalManualPrice
                : t.price,
            to_account: defaultTo,
            price_mode: state.priceMode,
          };
        } else {
          // Edge case 12: preserve explicit custom_price and price_mode; fill default to_account if not set
          if (!newAllocations[t.row_id].to_account && defaultTo) {
            newAllocations[t.row_id].to_account = defaultTo;
          }
        }
      });

      // Prune allocations not in new trades
      const activeRowIds = new Set(trades.map((t) => t.row_id));
      const cleanedAlloc: Record<string, TradeAllocation> = {};
      Object.keys(newAllocations).forEach((rid) => {
        if (activeRowIds.has(rid)) {
          cleanedAlloc[rid] = newAllocations[rid];
        }
      });

      return { trades, allocations: cleanedAlloc };
    }),

  setPriceMode: (mode) =>
    set((state) => {
      const updatedAlloc = { ...state.allocations };
      state.trades.forEach((t) => {
        if (updatedAlloc[t.row_id]) {
          // Explicitly set every row to the chosen mode so dropdowns stay in sync
          updatedAlloc[t.row_id].price_mode = mode;
          if (mode === 'settle') {
            updatedAlloc[t.row_id].custom_price = t.settle ?? t.price;
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
            updatedAlloc[t.row_id].price_mode = 'manual';
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
            price_mode: null,
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
    set({
      isLoading: true,
      loadingTitle: title,
      loadingSubtitle: subtitle,
      loadingSteps: [],
      loadingProgress: 0,
    }),

  showLoadingSteps: (title, subtitle, stepLabels) =>
    set({
      isLoading: true,
      loadingTitle: title,
      loadingSubtitle: subtitle,
      loadingProgress: 10,
      loadingSteps: stepLabels.map((lbl, idx) => ({
        id: `step-${idx}`,
        label: lbl,
        status: idx === 0 ? 'in_progress' : 'pending',
      })),
    }),

  updateLoadingStep: (stepIndexOrId, status, progress) =>
    set((state) => {
      const nextSteps = state.loadingSteps.map((s, idx) => {
        const matches =
          typeof stepIndexOrId === 'number' ? idx === stepIndexOrId : s.id === stepIndexOrId;
        if (matches) {
          return { ...s, status };
        }
        return s;
      });
      return {
        loadingSteps: nextSteps,
        loadingProgress: progress !== undefined ? progress : state.loadingProgress,
      };
    }),

  setLoadingProgress: (progress) => set({ loadingProgress: progress }),

  hideLoading: () =>
    set({
      isLoading: false,
      loadingSteps: [],
      loadingProgress: 0,
    }),

  showAlert: (title, message) => set({ alert: { title, message } }),

  hideAlert: () => set({ alert: null }),

  resetSession: () => {
    fetch('/api/unload-file', { method: 'POST' }).catch(() => {});
    if (typeof window !== 'undefined') {
      localStorage.removeItem('trade_session_id');
      localStorage.removeItem('trade_file_path');
    }
    set({
      sessionId: null,
      sessionMismatch: false,
      multiTabConflict: false,
      currentStep: 0,
      activeFilePath: null,
      activeFilename: null,
      clientGroup: 'SYM',
      defaultDate: null,
      accountCount: 0,
      tradeCount: 0,
      routes: [],
      contracts: [],
      allLoadedContracts: {},
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
      outputMode: 'paired',
      loadingSteps: [],
      loadingProgress: 0,
      alert: null,
      isLoading: false,
    });
  },
}));
