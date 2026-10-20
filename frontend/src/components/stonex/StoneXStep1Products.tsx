'use client';

import React, { useMemo, useCallback } from 'react';
import { useStoneXStore, ProductInfo } from '@/store/useStoneXStore';
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
import { Button } from '@/components/ui/button';

interface ProductCardProps {
  product: ProductInfo;
  isSelected: boolean;
  eligibleCount: number;
  onToggle: (sym: string) => void;
}

const ProductCardItem: React.FC<ProductCardProps> = React.memo(
  ({ product, isSelected, eligibleCount, onToggle }) => {
    const hasNetZero = eligibleCount > 0;
    const isBlocking = isSelected && !hasNetZero;

    return (
      <div
        onClick={() => onToggle(product.symbol)}
        className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between gap-2.5 ${
          isBlocking
            ? 'bg-rose-500/10 border-rose-500/50 shadow-xs'
            : isSelected
            ? 'bg-[var(--accent-gold)]/10 border-[var(--accent-gold)] shadow-xs'
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
                  ? 'bg-[var(--accent-gold)] text-black'
                  : 'border border-[var(--border-card)] bg-white/5'
              }`}
            >
              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>

            <span className="font-mono font-bold text-xs text-[var(--text-main)] truncate">
              [{product.symbol}]
            </span>
          </div>

          {hasNetZero ? (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 shrink-0" />
              <span>{eligibleCount} Net-Zero</span>
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-[var(--text-muted)] bg-white/5 shrink-0">
              {product.contract_count} mos
            </span>
          )}
        </div>

        <p className="text-[11px] text-[var(--text-muted)] line-clamp-1">
          {product.description}
        </p>
      </div>
    );
  }
);
ProductCardItem.displayName = 'ProductCardItem';

export const StoneXStep1Products: React.FC = () => {
  const summary = useStoneXStore((s) => s.summary);
  const selectedProducts = useStoneXStore((s) => s.selectedProducts);
  const toggleProduct = useStoneXStore((s) => s.toggleProduct);
  const selectAllProducts = useStoneXStore((s) => s.selectAllProducts);
  const deselectIneligibleProducts = useStoneXStore((s) => s.deselectIneligibleProducts);
  const clearProducts = useStoneXStore((s) => s.clearProducts);
  const productSearch = useStoneXStore((s) => s.productSearch);
  const setProductSearch = useStoneXStore((s) => s.setProductSearch);
  const onlyEligibleFilter = useStoneXStore((s) => s.onlyEligibleProductsFilter);
  const setOnlyEligibleFilter = useStoneXStore((s) => s.setOnlyEligibleProductsFilter);
  const setStep = useStoneXStore((s) => s.setStep);
  const errorMessage = useStoneXStore((s) => s.errorMessage);

  // Map product symbol to count of eligible net-zero contracts
  const eligibleCountMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!summary) return map;
    for (const c of summary.contracts) {
      if (c.is_eligible) {
        map.set(c.symbol, (map.get(c.symbol) || 0) + 1);
      }
    }
    return map;
  }, [summary]);

  // Identify any selected product that lacks net-zero contracts
  const ineligibleSelectedProducts = useMemo(() => {
    return selectedProducts.filter((sym) => (eligibleCountMap.get(sym) || 0) === 0);
  }, [selectedProducts, eligibleCountMap]);

  const hasIneligible = ineligibleSelectedProducts.length > 0;

  // Filter products based on search and eligible-only toggle
  const filteredProducts = useMemo(() => {
    if (!summary) return [];
    return summary.products.filter((p) => {
      if (onlyEligibleFilter && (eligibleCountMap.get(p.symbol) || 0) === 0) {
        return false;
      }
      if (!productSearch.trim()) return true;
      const q = productSearch.toLowerCase();
      return (
        p.symbol.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    });
  }, [summary, onlyEligibleFilter, eligibleCountMap, productSearch]);

  const handleToggle = useCallback(
    (sym: string) => {
      toggleProduct(sym);
    },
    [toggleProduct]
  );

  if (!summary) return null;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* ── Filter & Action Control Card ── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-card)] shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[var(--border-card)] pb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-[var(--accent-gold)]/10 text-[var(--accent-gold)] text-xs font-mono font-bold flex items-center justify-center">
              1
            </span>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wider font-mono">
                Step 1: Select Products
              </h3>
              <p className="text-[11px] text-[var(--text-muted)] font-mono">
                Pick one or multiple products to inspect for internal position netting.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-[var(--input-bg)] border border-[var(--border-card)] text-xs font-mono text-[var(--text-muted)]">
              Selected: <strong className="text-[var(--accent-gold)]">{selectedProducts.length}</strong> / {summary.total_products}
            </span>
          </div>
        </div>

        {/* Search & Bulk Selection Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Keyword Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by symbol (LGO, NOL) or description..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-[var(--input-bg)] border border-[var(--border-card)] text-xs font-mono text-[var(--text-main)] outline-none focus:border-[var(--accent-gold)]"
            />
            {productSearch && (
              <button
                type="button"
                onClick={() => setProductSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Net-Zero Quick Toggle Filter */}
          <button
            type="button"
            onClick={() => setOnlyEligibleFilter(!onlyEligibleFilter)}
            className={`px-3 py-2 rounded-xl border text-xs font-mono transition flex items-center justify-center gap-1.5 cursor-pointer ${
              onlyEligibleFilter
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold'
                : 'bg-[var(--input-bg)] border-[var(--border-card)] text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Show Net-Zero Only</span>
          </button>

          {/* Quick Selection Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAllProducts}
              className="px-3 py-2 rounded-xl border border-border bg-[var(--input-bg)] hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-mono transition cursor-pointer"
            >
              All ({summary.total_products})
            </button>

            {selectedProducts.length > 0 && (
              <button
                type="button"
                onClick={clearProducts}
                className="px-2.5 py-2 rounded-xl text-xs font-mono text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* ── Product Cards Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full py-12 text-center text-xs font-mono text-[var(--text-muted)]">
              No products match filter criteria.
            </div>
          ) : (
            filteredProducts.map((p) => (
              <ProductCardItem
                key={p.symbol}
                product={p}
                isSelected={selectedProducts.includes(p.symbol)}
                eligibleCount={eligibleCountMap.get(p.symbol) || 0}
                onToggle={handleToggle}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Validation Notification & Footer Navigation ── */}
      {selectedProducts.length === 0 && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2.5 font-mono">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Product Selection Required: Select at least one product above to inspect contracts.</span>
        </div>
      )}

      {hasIneligible && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              Ineligible: <strong>[{ineligibleSelectedProducts.join(', ')}]</strong> {ineligibleSelectedProducts.length > 1 ? 'have' : 'has'} 0 net-zero contracts (Buy &ne; Sell). Netting requires balanced positions.
            </span>
          </div>
          <button
            type="button"
            onClick={deselectIneligibleProducts}
            className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-xs font-semibold cursor-pointer shrink-0 transition"
          >
            Deselect Ineligible ({ineligibleSelectedProducts.length})
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setStep(0)}
          className="rounded-full gap-2 text-xs font-mono"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back: File Ingestion</span>
        </Button>

        <Button
          type="button"
          variant="gold"
          size="pill"
          onClick={() => setStep(2)}
          disabled={selectedProducts.length === 0 || hasIneligible}
          title={
            hasIneligible
              ? `Cannot proceed: [${ineligibleSelectedProducts.join(', ')}] ${ineligibleSelectedProducts.length > 1 ? 'have' : 'has'} 0 net-zero contracts.`
              : undefined
          }
          className="gap-2 font-bold text-xs"
        >
          <span>Next: Select Contracts ({selectedProducts.length} Selected)</span>
          <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
};
