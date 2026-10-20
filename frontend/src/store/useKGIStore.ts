'use client';

import { create } from 'zustand';

export interface KGIContractInfo {
  contract_id: string;
  contract: string;
  symbol: string;
  expirydate: string;
  formatted_expiry: string;
  del_month?: string;
  cpf: string;
  strike?: number | null;
  row_count: number;
  buy_lots: number;
  sell_lots: number;
  net_delta: number;
  price: number;
  is_eligible: boolean;
  status_badge: string;
  status_message: string;
}

export interface KGIProductInfo {
  contract: string;
  symbol: string;
  contract_count: number;
  net_zero_count: number;
  expiries: string[];
  total_positions: number;
}

export interface KGISummaryData {
  filename: string;
  filepath: string;
  total_positions: number;
  total_products: number;
  total_contracts: number;
  eligible_contracts_count: number;
  total_eligible_lots: number;
  products: KGIProductInfo[];
  contracts: KGIContractInfo[];
}

export interface KGIPreviewRow {
  sl_no: number;
  from_account: string;
  to_account: string;
  instr: string;
  instr_desp: string;
  buy_sell: 'B' | 'S' | string;
  lots: number;
  contract_month: string;
  cp?: string | null;
  strike?: number | null;
  price: number;
  date: string;
  comments: string;
}

export const formatKGIFilename = (date: Date = new Date()): string => {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `KGI_Netting_Instructions_${dd}.${mm}.${yyyy}.xlsx`;
};

interface KGIState {
  currentStep: number;
  summary: KGISummaryData | null;
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

  // Step 3 & 4: Destination & Export
  destinationAccount: string;
  previewRows: KGIPreviewRow[];
  isPreviewLoading: boolean;
  isExporting: boolean;
  exportFilename: string;
  customComments: Record<string, string>;

  // Actions
  setStep: (step: number) => boolean;
  setSummary: (summary: KGISummaryData | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (err: string | null) => void;
  setSuccess: (msg: string | null) => void;
  setDestinationAccount: (acc: string) => void;

  setProductSearch: (q: string) => void;
  setOnlyEligibleProductsFilter: (val: boolean) => void;
  toggleProduct: (contract: string) => void;
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

  updateRowComment: (sl_no: number, comment: string) => void;
  setBulkComment: (comment: string) => void;
  fetchPreview: () => Promise<void>;
  exportExcel: () => Promise<void>;
  resetAll: () => void;

  // Validation
  canProceedToStep: (targetStep: number) => { allowed: boolean; reason?: string };
}

export const useKGIStore = create<KGIState>((set, get) => ({
  currentStep: 0,
  summary: null,
  isLoading: false,
  errorMessage: null,
  successMessage: null,

  // Step 1
  selectedProducts: [],
  productSearch: '',
  onlyEligibleProductsFilter: false,

  // Step 2
  selectedContracts: [],
  contractSearch: '',
  onlyNetZeroContractsFilter: false,

  // Destination & Review
  destinationAccount: 'KT513Z',
  previewRows: [],
  isPreviewLoading: false,
  isExporting: false,
  exportFilename: formatKGIFilename(),
  customComments: {},

  canProceedToStep: (targetStep: number) => {
    const { summary, selectedProducts, selectedContracts } = get();
    if (targetStep <= 0) return { allowed: true };

    if (!summary) {
      return { allowed: false, reason: 'Please upload a KGI CSV positions feed first.' };
    }

    if (targetStep >= 2) {
      if (selectedProducts.length === 0) {
        return { allowed: false, reason: 'Please select at least one product in Step 1.' };
      }
      const eligibleContracts = new Set(
        summary.contracts.filter((c) => c.is_eligible).map((c) => c.contract)
      );
      const ineligible = selectedProducts.filter((p) => !eligibleContracts.has(p));
      if (ineligible.length > 0) {
        return {
          allowed: false,
          reason: `Ineligible: [${ineligible.join(', ')}] ${ineligible.length > 1 ? 'have' : 'has'} 0 net-zero contracts (Buy ≠ Sell). Netting requires balanced positions.`,
        };
      }
    }

    if (targetStep >= 3) {
      if (selectedContracts.length === 0) {
        return { allowed: false, reason: 'Please select at least one contract expiry in Step 2.' };
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
          reason: `Ineligible contract(s) selected: [${ineligibleContracts
            .map((c) => `${c.contract} ${c.formatted_expiry || c.expirydate}`)
            .join(', ')}] have open delta (Buy ≠ Sell). Only net-zero contracts can proceed.`,
        };
      }
      const representedProducts = new Set(selectedContractObjs.map((c) => c.contract));
      const missingProducts = selectedProducts.filter((p) => !representedProducts.has(p));
      if (missingProducts.length > 0) {
        return {
          allowed: false,
          reason: `Coverage Required: Selected product(s) [${missingProducts.join(
            ', '
          )}] have no contracts selected. At least 1 net-zero contract required per product.`,
        };
      }
    }

    if (targetStep >= 4) {
      const selectedContractObjs = summary.contracts.filter((c) =>
        selectedContracts.includes(c.contract_id)
      );
      if (selectedContractObjs.length === 0) {
        return { allowed: false, reason: 'No contracts selected for export.' };
      }
      const unbalanced = selectedContractObjs.filter(
        (c) => !c.is_eligible || Math.abs(c.net_delta) > 1e-5
      );
      if (unbalanced.length > 0) {
        return {
          allowed: false,
          reason: 'Cannot export: Unbalanced contracts present. Remove unbalanced items before export.',
        };
      }
    }

    return { allowed: true };
  },

  setStep: (step: number) => {
    const { canProceedToStep } = get();
    if (step > get().currentStep) {
      const check = canProceedToStep(step);
      if (!check.allowed) {
        set({ errorMessage: check.reason || 'Cannot proceed to next step.' });
        return false;
      }
    }
    set({ currentStep: step, errorMessage: null });
    return true;
  },

  setSummary: (summary) => set({ summary }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (errorMessage) => set({ errorMessage }),
  setSuccess: (successMessage) => set({ successMessage }),
  setDestinationAccount: (destinationAccount) => set({ destinationAccount }),

  setProductSearch: (productSearch) => set({ productSearch }),
  setOnlyEligibleProductsFilter: (onlyEligibleProductsFilter) =>
    set({ onlyEligibleProductsFilter }),

  toggleProduct: (contract: string) => {
    const { selectedProducts } = get();
    const next = selectedProducts.includes(contract)
      ? selectedProducts.filter((p) => p !== contract)
      : [...selectedProducts, contract];
    set({ selectedProducts: next, errorMessage: null });
  },

  selectAllProducts: () => {
    const { summary } = get();
    if (!summary) return;
    const all = summary.products.map((p) => p.contract);
    set({ selectedProducts: all, errorMessage: null });
  },

  selectAllEligibleProducts: () => {
    const { summary } = get();
    if (!summary) return;
    const eligible = summary.products
      .filter((p) => p.net_zero_count > 0)
      .map((p) => p.contract);
    set({ selectedProducts: eligible, errorMessage: null });
  },

  deselectIneligibleProducts: () => {
    const { summary, selectedProducts } = get();
    if (!summary) return;
    const eligibleSymbols = new Set(
      summary.contracts.filter((c) => c.is_eligible).map((c) => c.contract)
    );
    const cleaned = selectedProducts.filter((p) => eligibleSymbols.has(p));
    set({
      selectedProducts: cleaned,
      errorMessage: null,
      successMessage: 'Deselected products with zero net-zero contracts.',
    });
  },

  clearProducts: () => set({ selectedProducts: [], errorMessage: null }),

  setContractSearch: (contractSearch) => set({ contractSearch }),
  setOnlyNetZeroContractsFilter: (onlyNetZeroContractsFilter) =>
    set({ onlyNetZeroContractsFilter }),

  toggleContract: (contractId: string) => {
    const { selectedContracts } = get();
    const next = selectedContracts.includes(contractId)
      ? selectedContracts.filter((id) => id !== contractId)
      : [...selectedContracts, contractId];
    set({ selectedContracts: next, errorMessage: null });
  },

  selectAllContractsForSelectedProducts: () => {
    const { summary, selectedProducts } = get();
    if (!summary) return;
    const matching = summary.contracts
      .filter((c) => selectedProducts.includes(c.contract))
      .map((c) => c.contract_id);
    set({ selectedContracts: matching, errorMessage: null });
  },

  selectAllNetZeroContracts: () => {
    const { summary, selectedProducts } = get();
    if (!summary) return;
    const matching = summary.contracts
      .filter((c) => selectedProducts.includes(c.contract) && c.is_eligible)
      .map((c) => c.contract_id);
    set({ selectedContracts: matching, errorMessage: null });
  },

  deselectIneligibleContracts: () => {
    const { summary, selectedContracts } = get();
    if (!summary) return;
    const eligibleIds = new Set(
      summary.contracts.filter((c) => c.is_eligible && Math.abs(c.net_delta) <= 1e-5).map((c) => c.contract_id)
    );
    const cleaned = selectedContracts.filter((id) => eligibleIds.has(id));
    set({
      selectedContracts: cleaned,
      errorMessage: null,
      successMessage: 'Deselected contracts with open delta.',
    });
  },

  clearContracts: () => set({ selectedContracts: [], errorMessage: null }),

  updateRowComment: (sl_no: number, comment: string) => {
    const { customComments, previewRows } = get();
    const updated = { ...customComments, [String(sl_no)]: comment };
    const updatedRows = previewRows.map((r) =>
      r.sl_no === sl_no ? { ...r, comments: comment } : r
    );
    set({ customComments: updated, previewRows: updatedRows });
  },

  setBulkComment: (comment: string) => {
    const { previewRows } = get();
    const newComments: Record<string, string> = {};
    const updatedRows = previewRows.map((r) => {
      newComments[String(r.sl_no)] = comment;
      return { ...r, comments: comment };
    });
    set({
      customComments: newComments,
      previewRows: updatedRows,
      successMessage: `Applied comment to all ${previewRows.length} rows.`,
    });
  },

  fetchPreview: async () => {
    const { summary, selectedContracts, destinationAccount, customComments } = get();
    if (!summary || selectedContracts.length === 0) return;

    set({ isPreviewLoading: true, errorMessage: null });
    try {
      const resp = await fetch('/api/kgi/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filepath: summary.filepath,
          contract_ids: selectedContracts,
          destination_account: destinationAccount,
          eligible_only: true,
          custom_comments: customComments,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch preview rows.');
      }

      const res = await resp.json();
      const rows: KGIPreviewRow[] = res.rows || [];
      const updatedRows = rows.map((r) => {
        const existing = customComments[String(r.sl_no)];
        return existing !== undefined ? { ...r, comments: existing } : r;
      });
      set({ previewRows: updatedRows, isPreviewLoading: false });
    } catch (err: unknown) {
      set({
        errorMessage: err instanceof Error ? err.message : 'Error generating preview.',
        isPreviewLoading: false,
      });
    }
  },

  exportExcel: async () => {
    const {
      summary,
      selectedContracts,
      destinationAccount,
      customComments,
    } = get();

    if (!summary || selectedContracts.length === 0) {
      set({ errorMessage: 'No contracts selected for export.' });
      return;
    }

    const currentFilename = formatKGIFilename(new Date());

    set({ isExporting: true, errorMessage: null, exportFilename: currentFilename });
    try {
      const resp = await fetch('/api/kgi/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filepath: summary.filepath,
          contract_ids: selectedContracts,
          destination_account: destinationAccount,
          eligible_only: true,
          custom_comments: customComments,
          filename: currentFilename,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to export Excel.');
      }

      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = currentFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      set({
        isExporting: false,
        exportFilename: currentFilename,
        successMessage: `Export complete: ${currentFilename}`,
      });
    } catch (err: unknown) {
      set({
        errorMessage: err instanceof Error ? err.message : 'Export failed.',
        isExporting: false,
      });
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
      productSearch: '',
      onlyEligibleProductsFilter: false,
      selectedContracts: [],
      contractSearch: '',
      onlyNetZeroContractsFilter: false,
      destinationAccount: 'KT513Z',
      previewRows: [],
      isPreviewLoading: false,
      isExporting: false,
      exportFilename: formatKGIFilename(),
      customComments: {},
    }),
}));
