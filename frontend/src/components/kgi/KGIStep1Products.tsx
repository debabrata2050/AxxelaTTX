'use client';

import React, { useMemo, useCallback } from 'react';
import { useKGIStore, KGIProductInfo } from '@/store/useKGIStore';
import {
  Search,
  Filter,
  Check,
  CheckCircle2,
  X,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Layers,
} from 'lucide-react';

interface ProductCardProps {
  product: KGIProductInfo;
  isSelected: boolean;
  eligibleCount: number;
  onToggle: (contract: string) => void;
}

const ProductCardItem: React.FC<ProductCardProps> = React.memo(
  ({ product, isSelected, eligibleCount, onToggle }) => {
    const hasNetZero = eligibleCount > 0;
    const isBlocking = isSelected && !hasNetZero;

    return (
      <div
        onClick={() => onToggle(product.contract)}
        className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between gap-2.5 ${
          isBlocking
            ? 'bg-rose-500/10 border-rose-500/50 shadow-xs'
            : isSelected
            ? 'bg-sky-500/10 border-sky-400 shadow-xs'
            : 'bg-[var(--input-bg)] border-[var(--border-card)] hover:border-[var(--border-subtle)] hover:bg-white/5'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors shrink-0 ${
                isBlocking
                  ? 'bg-rose-500 text-white'
                  : isSelected
                  ? 'bg-sky-400 text-black'
                  : 'border border-[var(--border-card)] bg-white/5'
              }`}
            >
              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>

            <span className="font-mono font-bold text-xs text-[var(--text-main)] truncate">
              [{product.contract}]
            </span>
          </div>

          {hasNetZero ? (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 shrink-0" />
              <span>{eligibleCount} Net-Zero</span>
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-[var(--text-muted)] bg-white/5 shrink-0">
              {product.contract_count} expiries
            </span>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] font-mono">
          <span>{product.total_positions} positions</span>
          <span className="text-[10px]">{product.expiries.length} expiries</span>
        </div>
      </div>
    );
  }
);
ProductCardItem.displayName = 'ProductCardItem';

export const KGIStep1Products: React.FC = () => {
  const summary = useKGIStore((s) => s.summary);
  const selectedProducts = useKGIStore((s) => s.selectedProducts);
  const toggleProduct = useKGIStore((s) => s.toggleProduct);
  const selectAllProducts = useKGIStore((s) => s.selectAllProducts);
  const selectAllEligibleProducts = useKGIStore((s) => s.selectAllEligibleProducts);
  const deselectIneligibleProducts = useKGIStore((s) => s.deselectIneligibleProducts);
  const clearProducts = useKGIStore((s) => s.clearProducts);
  const productSearch = useKGIStore((s) => s.productSearch);
  const setProductSearch = useKGIStore((s) => s.setProductSearch);
  const onlyEligibleFilter = useKGIStore((s) => s.onlyEligibleProductsFilter);
  const setOnlyEligibleFilter = useKGIStore((s) => s.setOnlyEligibleProductsFilter);
  const setStep = useKGIStore((s) => s.setStep);
  const errorMessage = useKGIStore((s) => s.errorMessage);

  const eligibleCountMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!summary) return map;
    for (const c of summary.contracts) {
      if (c.is_eligible) {
        map.set(c.contract, (map.get(c.contract) || 0) + 1);
      }
    }
    return map;
  }, [summary]);

  const filteredProducts = useMemo(() => {
    if (!summary) return [];
    return summary.products.filter((p) => {
      if (onlyEligibleFilter && (eligibleCountMap.get(p.contract) || 0) === 0) {
        return false;
      }
      if (productSearch.trim()) {
        const q = productSearch.toLowerCase();
        return p.contract.toLowerCase().includes(q);
      }
      return true;
    });
  }, [summary, onlyEligibleFilter, productSearch, eligibleCountMap]);

  const selectedCount = selectedProducts.length;

  const handleNext = () => {
    setStep(2);
  };

  if (!summary) return null;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* ── Toolbar Card ── */}
      <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-card)] shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[var(--border-card)] pb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-sky-500/10 text-sky-400 text-xs font-mono font-bold flex items-center justify-center">
              1
            </span>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wider font-mono">
                Step 1: Select Products (Contracts)
              </h3>
              <p className="text-[11px] text-[var(--text-muted)] font-mono">
                Selected: <strong className="text-sky-400">{selectedCount}</strong> of{' '}
                {summary.products.length} products
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={selectAllEligibleProducts}
              className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition cursor-pointer"
            >
              Select All Net-Zero ({summary.products.filter((p) => p.net_zero_count > 0).length})
            </button>
            <button
              type="button"
              onClick={selectAllProducts}
              className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium text-muted-foreground hover:text-foreground bg-muted border border-border transition cursor-pointer"
            >
              Select All
            </button>
            {selectedCount > 0 && (
              <button
                type="button"
                onClick={clearProducts}
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
              placeholder="Search product code (e.g. TF, BTP, ETP)..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-[var(--input-bg)] border border-[var(--border-card)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-sky-400 font-mono"
            />
          </div>

          <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--input-bg)] border border-[var(--border-card)] cursor-pointer text-xs font-mono text-[var(--text-muted)] hover:text-[var(--text-main)] select-none">
            <input
              type="checkbox"
              checked={onlyEligibleFilter}
              onChange={(e) => setOnlyEligibleFilter(e.target.checked)}
              className="rounded accent-sky-400"
            />
            <Filter className="w-3.5 h-3.5" />
            <span>Only Net-Zero Eligible ({summary.products.filter((p) => p.net_zero_count > 0).length})</span>
          </label>
        </div>
      </div>

      {/* ── Product Grid ── */}
      <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-card)] shadow-xs">
        {filteredProducts.length === 0 ? (
          <div className="p-8 text-center text-xs font-mono text-[var(--text-muted)]">
            No products match current filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[500px] overflow-y-auto pr-1">
            {filteredProducts.map((p) => {
              const eligibleCount = eligibleCountMap.get(p.contract) || 0;
              return (
                <ProductCardItem
                  key={p.contract}
                  product={p}
                  isSelected={selectedProducts.includes(p.contract)}
                  eligibleCount={eligibleCount}
                  onToggle={toggleProduct}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ── Concise Error Banner & Action ── */}
      {errorMessage && errorMessage.includes('Ineligible') && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2 text-rose-300 text-xs font-mono">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={deselectIneligibleProducts}
            className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-mono font-semibold transition shrink-0 cursor-pointer"
          >
            Deselect Ineligible
          </button>
        </div>
      )}

      {/* ── Navigation Footer ── */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => setStep(0)}
          className="px-4 py-2.5 rounded-xl bg-[var(--input-bg)] hover:bg-muted border border-border text-xs font-mono font-medium text-muted-foreground hover:text-foreground transition flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Ingestion</span>
        </button>

        <button
          type="button"
          onClick={handleNext}
          disabled={selectedCount === 0}
          className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-md"
        >
          <span>Select Contract Expiries (Step 2)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
