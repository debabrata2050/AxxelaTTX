'use client';

import React, { useMemo, useCallback } from 'react';
import { useStoneXStore, ContractInfo } from '@/store/useStoneXStore';
import {
  Search,
  Filter,
  Check,
  CheckCircle2,
  AlertTriangle,
  X,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Calendar,
} from 'lucide-react';

interface ContractRowProps {
  contract: ContractInfo;
  isSelected: boolean;
  onToggle: (id: string) => void;
}

const ContractRowItem: React.FC<ContractRowProps> = React.memo(
  ({ contract, isSelected, onToggle }) => {
    return (
      <div
        onClick={() => onToggle(contract.contract_id)}
        className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isSelected
            ? 'bg-[var(--accent-gold)]/10 border-[var(--accent-gold)] shadow-xs'
            : 'bg-[var(--input-bg)] border-[var(--border-card)] hover:border-[var(--border-subtle)] hover:bg-white/5'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors shrink-0 ${
              isSelected
                ? 'bg-[var(--accent-gold)] text-black'
                : 'border border-[var(--border-card)] bg-white/5'
            }`}
          >
            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-xs text-[var(--accent-gold)]">
                [{contract.symbol}]
              </span>
              <span className="font-mono font-bold text-xs text-[var(--text-main)]">
                {contract.period}
              </span>
              {contract.is_option && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                  {contract.cp === 'C' ? 'Call' : contract.cp === 'P' ? 'Put' : contract.cp} {contract.strike ? `@ ${contract.strike}` : ''}
                </span>
              )}
              {contract.grouping && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-white/5 text-[var(--text-muted)] border border-white/10">
                  Grp: {contract.grouping}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
              {contract.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Buy / Sell Lots Pill */}
          <div className="text-right text-[11px] font-mono">
            <span className="text-emerald-400 font-bold">+{contract.buy_lots}B</span>
            <span className="text-[var(--text-muted)] mx-1">/</span>
            <span className="text-rose-400 font-bold">-{contract.sell_lots}S</span>
          </div>

          {/* Status Badge */}
          {contract.is_eligible ? (
            <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>NET ZERO</span>
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              <span>DELTA {contract.net_delta > 0 ? `+${contract.net_delta}` : contract.net_delta}</span>
            </span>
          )}
        </div>
      </div>
    );
  }
);
ContractRowItem.displayName = 'ContractRowItem';

export const StoneXStep2Contracts: React.FC = () => {
  const summary = useStoneXStore((s) => s.summary);
  const selectedProducts = useStoneXStore((s) => s.selectedProducts);
  const selectedContracts = useStoneXStore((s) => s.selectedContracts);
  const toggleContract = useStoneXStore((s) => s.toggleContract);
  const selectAllContractsForSelectedProducts = useStoneXStore(
    (s) => s.selectAllContractsForSelectedProducts
  );
  const selectAllNetZeroContracts = useStoneXStore((s) => s.selectAllNetZeroContracts);
  const deselectIneligibleContracts = useStoneXStore((s) => s.deselectIneligibleContracts);
  const clearContracts = useStoneXStore((s) => s.clearContracts);
  const contractSearch = useStoneXStore((s) => s.contractSearch);
  const setContractSearch = useStoneXStore((s) => s.setContractSearch);
  const onlyNetZeroFilter = useStoneXStore((s) => s.onlyNetZeroContractsFilter);
  const setOnlyNetZeroFilter = useStoneXStore((s) => s.setOnlyNetZeroContractsFilter);
  const setStep = useStoneXStore((s) => s.setStep);

  // Filter all contracts for the selected products
  const contractsForSelectedProducts = useMemo(() => {
    if (!summary) return [];
    const prodSet = new Set(selectedProducts);
    return summary.contracts.filter((c) => prodSet.has(c.symbol));
  }, [summary, selectedProducts]);

  const netZeroCount = useMemo(() => {
    return contractsForSelectedProducts.filter((c) => c.is_eligible).length;
  }, [contractsForSelectedProducts]);

  // Track product coverage
  const productCoverage = useMemo(() => {
    if (!summary) return [];
    const map = new Map<string, { total: number; selected: number }>();
    for (const p of selectedProducts) {
      map.set(p, { total: 0, selected: 0 });
    }
    for (const c of summary.contracts) {
      if (map.has(c.symbol)) {
        const entry = map.get(c.symbol)!;
        entry.total += 1;
        if (selectedContracts.includes(c.contract_id)) {
          entry.selected += 1;
        }
      }
    }
    return selectedProducts.map((p) => ({
      symbol: p,
      ...(map.get(p) || { total: 0, selected: 0 }),
    }));
  }, [summary, selectedProducts, selectedContracts]);

  // Detect any selected contracts that are not net-zero
  const ineligibleSelectedContracts = useMemo(() => {
    if (!summary) return [];
    const set = new Set(selectedContracts);
    return summary.contracts.filter(
      (c) => set.has(c.contract_id) && (!c.is_eligible || Math.abs(c.net_delta) > 1e-5)
    );
  }, [summary, selectedContracts]);

  // Missing product representation
  const missingProducts = useMemo(() => {
    return productCoverage.filter((pc) => pc.selected === 0).map((pc) => pc.symbol);
  }, [productCoverage]);

  const canProceed =
    selectedContracts.length > 0 &&
    ineligibleSelectedContracts.length === 0 &&
    missingProducts.length === 0;

  // Apply search and Net-Zero filter
  const filteredContracts = useMemo(() => {
    return contractsForSelectedProducts.filter((c) => {
      if (onlyNetZeroFilter && !c.is_eligible) return false;
      if (!contractSearch.trim()) return true;
      const q = contractSearch.toLowerCase();
      return (
        c.symbol.toLowerCase().includes(q) ||
        c.period.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.grouping.toLowerCase().includes(q)
      );
    });
  }, [contractsForSelectedProducts, onlyNetZeroFilter, contractSearch]);

  const handleToggle = useCallback(
    (cid: string) => {
      toggleContract(cid);
    },
    [toggleContract]
  );

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-card)] shadow-xs space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[var(--border-card)] pb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-[var(--accent-gold)]/10 text-[var(--accent-gold)] text-xs font-mono font-bold flex items-center justify-center">
              2
            </span>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wider font-mono">
                Step 2: Select Delivery Months / Contracts
              </h3>
              <p className="text-[11px] text-[var(--text-muted)] font-mono">
                Across {selectedProducts.length} selected product(s): {selectedProducts.join(', ')}.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-[var(--input-bg)] border border-[var(--border-card)] text-xs font-mono text-[var(--text-muted)]">
              Selected: <strong className="text-[var(--accent-gold)]">{selectedContracts.length}</strong> / {contractsForSelectedProducts.length}
            </span>
          </div>
        </div>

        {/* Product Coverage Tracker Pills */}
        {selectedProducts.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1 pb-1 border-b border-[var(--border-card)]/40">
            <span className="text-[11px] font-mono text-[var(--text-muted)] flex items-center gap-1.5 mr-1">
              <span>Coverage:</span>
            </span>
            {productCoverage.map((pc) => {
              const isFulfilled = pc.selected > 0;
              const isFiltered = contractSearch === pc.symbol;
              return (
                <button
                  key={pc.symbol}
                  type="button"
                  onClick={() => setContractSearch(isFiltered ? '' : pc.symbol)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition flex items-center gap-1.5 cursor-pointer ${
                    isFiltered
                      ? 'ring-2 ring-[var(--accent-gold)]'
                      : ''
                  } ${
                    isFulfilled
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                      : 'bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                  }`}
                  title={`Click to filter contracts for ${pc.symbol}`}
                >
                  <span className="font-bold">[{pc.symbol}]</span>
                  <span>{isFulfilled ? `${pc.selected} selected ✓` : '0 selected ⚠'}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Search & Bulk Action Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Keyword Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search contract month (Oct-26, Nov-26) or code..."
              value={contractSearch}
              onChange={(e) => setContractSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-[var(--input-bg)] border border-[var(--border-card)] text-xs font-mono text-[var(--text-main)] outline-none focus:border-[var(--accent-gold)]"
            />
            {contractSearch && (
              <button
                type="button"
                onClick={() => setContractSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Net-Zero Quick Toggle */}
          <button
            type="button"
            onClick={() => setOnlyNetZeroFilter(!onlyNetZeroFilter)}
            className={`px-3 py-2 rounded-xl border text-xs font-mono transition flex items-center justify-center gap-1.5 cursor-pointer ${
              onlyNetZeroFilter
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold'
                : 'bg-[var(--input-bg)] border-[var(--border-card)] text-[var(--text-muted)] hover:text-white'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Show Net-Zero Only</span>
          </button>

          {/* Quick Select Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAllNetZeroContracts}
              className="px-3 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              title="Select all net-zero contracts"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Select Net-Zero ({netZeroCount})</span>
            </button>

            <button
              type="button"
              onClick={selectAllContractsForSelectedProducts}
              className="px-3 py-2 rounded-xl border border-[var(--border-card)] bg-[var(--input-bg)] hover:bg-white/5 text-[var(--text-muted)] hover:text-white text-xs font-mono transition cursor-pointer"
            >
              All ({contractsForSelectedProducts.length})
            </button>

            {selectedContracts.length > 0 && (
              <button
                type="button"
                onClick={clearContracts}
                className="px-2.5 py-2 rounded-xl text-xs font-mono text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Contract Rows List */}
        <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
          {filteredContracts.length === 0 ? (
            <div className="py-12 text-center text-xs font-mono text-[var(--text-muted)]">
              No contract months match current filters.
            </div>
          ) : (
            filteredContracts.map((c) => (
              <ContractRowItem
                key={c.contract_id}
                contract={c}
                isSelected={selectedContracts.includes(c.contract_id)}
                onToggle={handleToggle}
              />
            ))
          )}
        </div>
      </div>

      {/* Validation Banners */}
      {selectedContracts.length === 0 && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2.5 font-mono">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Contract Selection Required: Select at least one contract month to audit The Netting Rule.</span>
        </div>
      )}

      {ineligibleSelectedContracts.length > 0 && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              Ineligible Contract: <strong>[{ineligibleSelectedContracts.map((c) => `${c.symbol} ${c.period}`).join(', ')}]</strong> {ineligibleSelectedContracts.length > 1 ? 'have' : 'has'} open delta risk (Buy &ne; Sell). Only net-zero contracts can proceed.
            </span>
          </div>
          <button
            type="button"
            onClick={deselectIneligibleContracts}
            className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-xs font-semibold cursor-pointer shrink-0 transition"
          >
            Deselect Ineligible ({ineligibleSelectedContracts.length})
          </button>
        </div>
      )}

      {missingProducts.length > 0 && selectedContracts.length > 0 && (
        <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2.5 font-mono animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Coverage Required: Selected product(s) <strong>[{missingProducts.join(', ')}]</strong> have no contracts selected. Every selected product must contain at least one net-zero contract.
          </span>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="px-4 py-2.5 rounded-xl border border-[var(--border-card)] bg-[var(--card-bg)] text-xs font-mono text-[var(--text-muted)] hover:text-white transition flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back: Products</span>
        </button>

        <button
          type="button"
          onClick={() => setStep(3)}
          disabled={!canProceed}
          title={
            !canProceed
              ? ineligibleSelectedContracts.length > 0
                ? 'Remove ineligible contracts with open delta to proceed.'
                : missingProducts.length > 0
                ? `Every selected product must have at least one contract. Missing: [${missingProducts.join(', ')}]`
                : 'Select at least one contract month.'
              : undefined
          }
          className="px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 bg-[var(--accent-gold)] text-black hover:opacity-95 shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <span>Next: Audit Netting ({selectedContracts.length} Selected)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
