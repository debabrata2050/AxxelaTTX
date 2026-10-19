'use client';

import { create } from 'zustand';

export interface ContractInfo {
  contract_id: string;
  symbol: string;
  description: string;
  period: string;
  trade_type?: string;
  cp?: string;
  strike?: number | string | null;
  is_option?: boolean;
  grouping: string;
  price: number;
  business_date: string;
  row_count: number;
  buy_lots: number;
  sell_lots: number;
  net_delta: number;
  is_eligible: boolean;
  status_badge: string;
  status_message: string;
}

export interface ProductInfo {
  symbol: string;
  description: string;
  contract_count: number;
  periods: string[];
}

export interface SummaryData {
  filename: string;
  filepath: string;
  total_positions: number;
  total_products: number;
  total_contracts: number;
  eligible_contracts_count: number;
  total_eligible_lots: number;
  products: ProductInfo[];
  contracts: ContractInfo[];
}

export interface PreviewRow {
  sl_no: number;
  from_account: string;
  to_account: string;
  instr: string;
  instr_desp: string;
  buy_sell: 'Buy' | 'Sell';
  lots: number;
  contract_month: string;
  cp?: string;
  strike?: number | string | null;
  price: number;
  date: string;
  comments: string;
}

interface StoneXState {
  currentStep: number;
  summary: SummaryData | null;
  isLoading: boolean;
  errorMessage: string | null;
  successMessage: string | null;

  // Step 1: Products
  selectedProducts: string[];
  productSearch: string;
  onlyEligibleProductsFilter: boolean;

  // Step 2: Contracts
  selectedContracts: string[];
  contractSearch: string;
  onlyNetZeroContractsFilter: boolean;

  // Step 4: Preview & Export
  previewRows: PreviewRow[];
  isPreviewLoading: boolean;
  isExporting: boolean;
  exportFilename: string;

  // Actions
  setStep: (step: number) => boolean;
  setSummary: (summary: SummaryData | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (err: string | null) => void;
  setSuccess: (msg: string | null) => void;

  setProductSearch: (q: string) => void;
  setOnlyEligibleProductsFilter: (val: boolean) => void;
  toggleProduct: (symbol: string) => void;
  selectAllProducts: () => void;
  selectAllEligibleProducts: () => void;
  deselectIneligibleProducts: () => void;
  clearProducts: () => void;

  setContractSearch: (q: string) => void;
  setOnlyNetZeroContractsFilter: (val: boolean) => void;
  toggleContract: (contractId: string) => void;
  selectAllContractsForSelectedProducts: () => void;
  selectAllNetZeroContracts: () => void;
  deselectIneligibleContracts: () => void;
  clearContracts: () => void;

  excludeUnbalancedContracts: () => void;
  updateRowComment: (sl_no: number, comment: string) => void;
  setBulkComment: (comment: string) => void;
  fetchPreview: () => Promise<void>;
  exportExcel: () => Promise<void>;
  resetAll: () => void;

  // Validation helpers
  canProceedToStep: (targetStep: number) => { allowed: boolean; reason?: string };
}

export const useStoneXStore = create<StoneXState>((set, get) => ({
  currentStep: 0,
  summary: null,
  isLoading: false,
  errorMessage: null,
  successMessage: null,

  // Step 1: starts with empty selection per user decision
  selectedProducts: [],
  productSearch: '',
  onlyEligibleProductsFilter: false,

  // Step 2: starts empty
  selectedContracts: [],
  contractSearch: '',
  onlyNetZeroContractsFilter: false,

  previewRows: [],
  isPreviewLoading: false,
  isExporting: false,
  exportFilename: 'StoneX_Netting_Consolidated.xlsx',

  canProceedToStep: (targetStep: number) => {
    const { summary, selectedProducts, selectedContracts } = get();
    if (targetStep <= 0) return { allowed: true };

    if (!summary) {
      return { allowed: false, reason: 'Please upload a StoneX CSV positions file first.' };
    }

    if (targetStep >= 2) {
      if (selectedProducts.length === 0) {
        return { allowed: false, reason: 'Please select at least one product in Step 1.' };
      }
      const eligibleSymbols = new Set(
        summary.contracts.filter((c) => c.is_eligible).map((c) => c.symbol)
      );
      const ineligible = selectedProducts.filter((sym) => !eligibleSymbols.has(sym));
      if (ineligible.length > 0) {
        return {
          allowed: false,
          reason: `Ineligible: [${ineligible.join(', ')}] ${ineligible.length > 1 ? 'have' : 'has'} 0 net-zero contracts (Buy ≠ Sell). Netting requires balanced positions.`,
        };
      }
    }

    if (targetStep >= 3) {
      if (selectedContracts.length === 0) {
        return { allowed: false, reason: 'Please select at least one contract month in Step 2.' };
      }
      const selectedContractObjs = summary.contracts.filter((c) =>
        selectedContracts.includes(c.contract_id)
      );
      const ineligibleContracts = selectedContractObjs.filter(
        (c) => !c.is_eligible || Math.abs(c.net_delta) > 1e-5
      );
      if (ineligibleContracts.length > 0) {
        return {
          allowed: false,
          reason: `Ineligible contract(s) selected: [${ineligibleContracts.map((c) => `${c.symbol} ${c.period}`).join(', ')}] have open delta (Buy ≠ Sell). Only net-zero contracts can proceed.`,
        };
      }
      const representedSymbols = new Set(selectedContractObjs.map((c) => c.symbol));
      const missingProducts = selectedProducts.filter((sym) => !representedSymbols.has(sym));
      if (missingProducts.length > 0) {
        return {
          allowed: false,
          reason: `Coverage Required: Selected product(s) [${missingProducts.join(', ')}] have no contracts selected. At least 1 net-zero contract required per product.`,
        };
      }
    }

    if (targetStep >= 4) {
      // HARD GATE: Verify all selected contracts comply with The Netting Rule (Delta == 0)
      const selectedContractObjs = summary.contracts.filter((c) =>
        selectedContracts.includes(c.contract_id)
      );
      if (selectedContractObjs.length === 0) {
        return { allowed: false, reason: 'No contracts selected for export.' };
      }
      const unbalanced = selectedContractObjs.filter((c) => !c.is_eligible || Math.abs(c.net_delta) > 1e-5);
      if (unbalanced.length > 0) {
        return {
          allowed: false,
          reason: `Hard Gate Violation: ${unbalanced.length} selected contract(s) have open delta risk (Buy != Sell). Clearing account LCE30553 requires zero-delta transfer. Please exclude unbalanced contracts to proceed.`,
        };
      }
    }

    return { allowed: true };
  },

  setStep: (step: number) => {
    const check = get().canProceedToStep(step);
    if (!check.allowed) {
      set({ errorMessage: check.reason });
      return false;
    }
    set({ currentStep: step, errorMessage: null });
    return true;
  },

  setSummary: (summary: SummaryData | null) => {
    set({
      summary,
      currentStep: summary ? 1 : 0,
      selectedProducts: [], // empty selection on upload
      selectedContracts: [],
      previewRows: [],
      errorMessage: null,
      successMessage: null,
      exportFilename: summary
        ? `StoneX_Netting_${summary.filename.replace(/\.csv$/i, '')}.xlsx`
        : 'StoneX_Netting_Consolidated.xlsx',
    });
  },

  setLoading: (isLoading: boolean) => set({ isLoading }),
  setError: (errorMessage: string | null) => set({ errorMessage }),
  setSuccess: (successMessage: string | null) => set({ successMessage }),

  setProductSearch: (productSearch: string) => set({ productSearch }),
  setOnlyEligibleProductsFilter: (onlyEligibleProductsFilter: boolean) =>
    set({ onlyEligibleProductsFilter }),

  toggleProduct: (symbol: string) => {
    const { selectedProducts, summary } = get();
    const isSelected = selectedProducts.includes(symbol);
    const nextProducts = isSelected
      ? selectedProducts.filter((s) => s !== symbol)
      : [...selectedProducts, symbol];

    // If removing product, also remove its contracts
    let nextContracts = get().selectedContracts;
    if (isSelected && summary) {
      const removedContractIds = new Set(
        summary.contracts.filter((c) => c.symbol === symbol).map((c) => c.contract_id)
      );
      nextContracts = nextContracts.filter((cid) => !removedContractIds.has(cid));
    }

    set({ selectedProducts: nextProducts, selectedContracts: nextContracts, errorMessage: null });
  },

  selectAllProducts: () => {
    const { summary } = get();
    if (!summary) return;
    set({ selectedProducts: summary.products.map((p) => p.symbol), errorMessage: null });
  },

  selectAllEligibleProducts: () => {
    const { summary } = get();
    if (!summary) return;
    const eligibleSymbols = Array.from(
      new Set(summary.contracts.filter((c) => c.is_eligible).map((c) => c.symbol))
    );
    set({ selectedProducts: eligibleSymbols, errorMessage: null });
  },

  deselectIneligibleProducts: () => {
    const { summary, selectedProducts } = get();
    if (!summary) return;
    const eligibleSymbols = new Set(
      summary.contracts.filter((c) => c.is_eligible).map((c) => c.symbol)
    );
    const validProducts = selectedProducts.filter((sym) => eligibleSymbols.has(sym));
    const validSymbolSet = new Set(validProducts);
    const validContracts = get().selectedContracts.filter((cid) => {
      const c = summary.contracts.find((item) => item.contract_id === cid);
      return c && validSymbolSet.has(c.symbol);
    });
    set({ selectedProducts: validProducts, selectedContracts: validContracts, errorMessage: null });
  },

  clearProducts: () => set({ selectedProducts: [], selectedContracts: [] }),

  setContractSearch: (contractSearch: string) => set({ contractSearch }),
  setOnlyNetZeroContractsFilter: (onlyNetZeroContractsFilter: boolean) =>
    set({ onlyNetZeroContractsFilter }),

  toggleContract: (contractId: string) => {
    const { selectedContracts } = get();
    const nextContracts = selectedContracts.includes(contractId)
      ? selectedContracts.filter((c) => c !== contractId)
      : [...selectedContracts, contractId];
    set({ selectedContracts: nextContracts, errorMessage: null });
  },

  selectAllContractsForSelectedProducts: () => {
    const { summary, selectedProducts } = get();
    if (!summary) return;
    const productSet = new Set(selectedProducts);
    const contracts = summary.contracts
      .filter((c) => productSet.has(c.symbol))
      .map((c) => c.contract_id);
    set({ selectedContracts: contracts, errorMessage: null });
  },

  selectAllNetZeroContracts: () => {
    const { summary, selectedProducts } = get();
    if (!summary) return;
    const productSet = new Set(selectedProducts);
    const eligibleContracts = summary.contracts
      .filter((c) => productSet.has(c.symbol) && c.is_eligible)
      .map((c) => c.contract_id);
    set({ selectedContracts: eligibleContracts, errorMessage: null });
  },

  deselectIneligibleContracts: () => {
    const { summary, selectedContracts } = get();
    if (!summary) return;
    const eligibleSet = new Set(
      summary.contracts.filter((c) => c.is_eligible && Math.abs(c.net_delta) < 1e-5).map((c) => c.contract_id)
    );
    set({
      selectedContracts: selectedContracts.filter((cid) => eligibleSet.has(cid)),
      errorMessage: null,
    });
  },

  clearContracts: () => set({ selectedContracts: [] }),

  excludeUnbalancedContracts: () => {
    const { summary, selectedContracts } = get();
    if (!summary) return;
    const eligibleSet = new Set(
      summary.contracts.filter((c) => c.is_eligible).map((c) => c.contract_id)
    );
    const cleaned = selectedContracts.filter((cid) => eligibleSet.has(cid));
    set({
      selectedContracts: cleaned,
      errorMessage: null,
      successMessage: `Excluded unbalanced contracts. ${cleaned.length} net-zero contract(s) active.`,
    });
  },

  updateRowComment: (sl_no: number, comment: string) => {
    const { previewRows } = get();
    set({
      previewRows: previewRows.map((r) =>
        r.sl_no === sl_no ? { ...r, comments: comment } : r
      ),
    });
  },

  setBulkComment: (comment: string) => {
    const { previewRows } = get();
    set({
      previewRows: previewRows.map((r) => ({ ...r, comments: comment })),
    });
  },

  fetchPreview: async () => {
    const { summary, selectedProducts, selectedContracts } = get();
    if (!summary || selectedContracts.length === 0) {
      set({ previewRows: [] });
      return;
    }

    set({ isPreviewLoading: true, errorMessage: null });
    try {
      const res = await fetch('/api/stonex/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filepath: summary.filepath,
          symbols: selectedProducts,
          contract_ids: selectedContracts,
          eligible_only: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch preview rows.');
      }
      set({ previewRows: data.rows || [] });
    } catch (err: any) {
      set({ errorMessage: err.message || 'Error fetching preview rows.' });
    } finally {
      set({ isPreviewLoading: false });
    }
  },

  exportExcel: async () => {
    const { summary, selectedProducts, selectedContracts, exportFilename, previewRows } = get();
    if (!summary || selectedContracts.length === 0) return;

    const custom_comments: Record<string, string> = {};
    for (const r of previewRows) {
      if (r.comments && r.comments.trim() !== '') {
        custom_comments[String(r.sl_no)] = r.comments.trim();
      }
    }

    set({ isExporting: true, errorMessage: null });
    try {
      const res = await fetch('/api/stonex/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filepath: summary.filepath,
          symbols: selectedProducts,
          contract_ids: selectedContracts,
          eligible_only: true,
          filename: exportFilename,
          custom_comments,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Export failed.');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      set({ successMessage: `Downloaded ${exportFilename} successfully.` });
    } catch (err: any) {
      set({ errorMessage: err.message || 'Failed to export Excel file.' });
    } finally {
      set({ isExporting: false });
    }
  },

  resetAll: () =>
    set({
      currentStep: 0,
      summary: null,
      isLoading: false,
      errorMessage: null,
      successMessage: null,
      selectedProducts: [],
      selectedContracts: [],
      productSearch: '',
      onlyEligibleProductsFilter: false,
      contractSearch: '',
      onlyNetZeroContractsFilter: false,
      previewRows: [],
      isPreviewLoading: false,
      isExporting: false,
    }),
}));
