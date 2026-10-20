'use client';

import React, { useMemo, useCallback } from 'react';
import { useKGIStore, KGIContractInfo } from '@/store/useKGIStore';
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
  contract: KGIContractInfo;
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
            ? 'bg-sky-500/10 border-sky-400 shadow-xs'
            : 'bg-[var(--input-bg)] border-[var(--border-card)] hover:border-[var(--border-subtle)] hover:bg-white/5'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors shrink-0 ${
              isSelected
                ? 'bg-sky-400 text-black'
                : 'border border-[var(--border-card)] bg-white/5'
            }`}
          >
            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-xs text-sky-400">
                [{contract.contract}]
              </span>
              <span className="font-mono font-bold text-xs text-[var(--text-main)]">
                {contract.formatted_expiry || contract.expirydate}
              </span>
              {contract.cpf && contract.cpf !== 'F' && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  {contract.cpf} {contract.strike ? `@ ${contract.strike}` : ''}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] font-mono truncate mt-0.5">
              Feed Expiry: {contract.expirydate} • {contract.row_count} positions
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

export const KGIStep2Contracts: React.FC = () => {
  const summary = useKGIStore((s) => s.summary);
  const selectedProducts = useKGIStore((s) => s.selectedProducts);
  const selectedContracts = useKGIStore((s) => s.selectedContracts);
  const toggleContract = useKGIStore((s) => s.toggleContract);
  const selectAllNetZeroContracts = useKGIStore((s) => s.selectAllNetZeroContracts);
  const deselectIneligibleContracts = useKGIStore((s) => s.deselectIneligibleContracts);
  const clearContracts = useKGIStore((s) => s.clearContracts);
  const contractSearch = useKGIStore((s) => s.contractSearch);
  const setContractSearch = useKGIStore((s) => s.setContractSearch);
  const onlyNetZeroFilter = useKGIStore((s) => s.onlyNetZeroContractsFilter);
  const setOnlyNetZeroFilter = useKGIStore((s) => s.setOnlyNetZeroContractsFilter);
  const setStep = useKGIStore((s) => s.setStep);
  const errorMessage = useKGIStore((s) => s.errorMessage);

  // Contracts scoped to selected products
  const scopedContracts = useMemo(() => {
    if (!summary) return [];
    return summary.contracts.filter((c) => selectedProducts.includes(c.contract));
  }, [summary, selectedProducts]);

  // Product coverage calculation: how many contracts are selected for each product
  const productCoverageMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of selectedProducts) {
      map.set(p, 0);
    }
    if (!summary) return map;
    for (const c of summary.contracts) {
      if (selectedContracts.includes(c.contract_id) && map.has(c.contract)) {
        map.set(c.contract, (map.get(c.contract) || 0) + 1);
      }
    }
    return map;
  }, [summary, selectedProducts, selectedContracts]);

  // Filtered contracts
  const filteredContracts = useMemo(() => {
    return scopedContracts.filter((c) => {
      if (onlyNetZeroFilter && !c.is_eligible) return false;
      if (contractSearch.trim()) {
        const q = contractSearch.toLowerCase();
        return (
          c.contract.toLowerCase().includes(q) ||
          c.expirydate.toLowerCase().includes(q) ||
          (c.formatted_expiry && c.formatted_expiry.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [scopedContracts, onlyNetZeroFilter, contractSearch]);

  const handleNext = () => {
    setStep(3);
  };

  if (!summary) return null;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* ── Product Coverage Tracker Pills Bar ── */}
      <div className="p-3.5 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-card)] shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-sky-400" />
            Product Coverage Tracker ({selectedProducts.length} selected in Step 1)
          </span>
          <span className="text-[10px] font-mono text-[var(--text-muted)]">
            Click product pill to filter list
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {selectedProducts.map((p) => {
            const count = productCoverageMap.get(p) || 0;
            const hasCoverage = count > 0;
            const isFilterActive = contractSearch.toLowerCase() === p.toLowerCase();

            return (
              <button
                key={p}
                type="button"
                onClick={() => setContractSearch(isFilterActive ? '' : p)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  isFilterActive
                    ? 'ring-2 ring-sky-400 bg-sky-500/20 text-white'
                    : hasCoverage
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                    : 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
                }`}
                title={
                  hasCoverage
                    ? `${p}: ${count} contract(s) selected`
                    : `${p}: 0 contracts selected (Required before proceeding)`
                }
              >
                <span>[{p}]</span>
                <span>{count}</span>
                {hasCoverage ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Toolbar Card ── */}
      <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-card)] shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[var(--border-card)] pb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-sky-500/10 text-sky-400 text-xs font-mono font-bold flex items-center justify-center">
              2
            </span>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wider font-mono">
                Step 2: Select Contract Expiries
              </h3>
              <p className="text-[11px] text-[var(--text-muted)] font-mono">
                Selected: <strong className="text-sky-400">{selectedContracts.length}</strong> of{' '}
                {scopedContracts.length} contract partitions
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={selectAllNetZeroContracts}
              className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition cursor-pointer"
            >
              Select All Net-Zero ({scopedContracts.filter((c) => c.is_eligible).length})
            </button>
            {selectedContracts.length > 0 && (
              <button
                type="button"
                onClick={clearContracts}
                className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium text-rose-400 hover:text-rose-300 bg-rose-500/10 border border-rose-500/30 transition cursor-pointer flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Search & Filter Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Filter by product or expiry date..."
              value={contractSearch}
              onChange={(e) => setContractSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-[var(--input-bg)] border border-[var(--border-card)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-sky-400 font-mono"
            />
            {contractSearch && (
              <button
                type="button"
                onClick={() => setContractSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            )}
          </div>

          <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--input-bg)] border border-[var(--border-card)] cursor-pointer text-xs font-mono text-[var(--text-muted)] hover:text-[var(--text-main)] select-none">
            <input
              type="checkbox"
              checked={onlyNetZeroFilter}
              onChange={(e) => setOnlyNetZeroFilter(e.target.checked)}
              className="rounded accent-sky-400"
            />
            <Filter className="w-3.5 h-3.5" />
            <span>Only Net-Zero ({scopedContracts.filter((c) => c.is_eligible).length})</span>
          </label>
        </div>
      </div>

      {/* ── Contract List ── */}
      <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-card)] shadow-xs">
        {filteredContracts.length === 0 ? (
          <div className="p-8 text-center text-xs font-mono text-[var(--text-muted)]">
            No contract partitions match current filter.
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {filteredContracts.map((c) => (
              <ContractRowItem
                key={c.contract_id}
                contract={c}
                isSelected={selectedContracts.includes(c.contract_id)}
                onToggle={toggleContract}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Error Banner & Action ── */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2 text-rose-300 text-xs font-mono">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
          {errorMessage.includes('Ineligible contract') && (
            <button
              type="button"
              onClick={deselectIneligibleContracts}
              className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-mono font-semibold transition shrink-0 cursor-pointer"
            >
              Deselect Ineligible
            </button>
          )}
        </div>
      )}

      {/* ── Navigation Footer ── */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="px-4 py-2.5 rounded-xl bg-[var(--input-bg)] hover:bg-muted border border-border text-xs font-mono font-medium text-muted-foreground hover:text-foreground transition flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Products</span>
        </button>

        <button
          type="button"
          onClick={handleNext}
          disabled={selectedContracts.length === 0}
          className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-md"
        >
          <span>Audit Netting (Step 3)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
