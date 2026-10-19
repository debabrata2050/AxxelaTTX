'use client';

import React, { useMemo } from 'react';
import { useStoneXStore, ContractInfo } from '@/store/useStoneXStore';
import {
  Scale,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Info,
} from 'lucide-react';

export const StoneXStep3Audit: React.FC = () => {
  const summary = useStoneXStore((s) => s.summary);
  const selectedContracts = useStoneXStore((s) => s.selectedContracts);
  const excludeUnbalancedContracts = useStoneXStore((s) => s.excludeUnbalancedContracts);
  const setStep = useStoneXStore((s) => s.setStep);

  // Get selected contract objects
  const contracts = useMemo(() => {
    if (!summary) return [];
    const set = new Set(selectedContracts);
    return summary.contracts.filter((c) => set.has(c.contract_id));
  }, [summary, selectedContracts]);

  // Aggregate metrics
  const { totalBuyLots, totalSellLots, unbalancedContracts, isAllEligible } = useMemo(() => {
    let buy = 0;
    let sell = 0;
    const unbalanced: ContractInfo[] = [];

    for (const c of contracts) {
      buy += c.buy_lots;
      sell += c.sell_lots;
      if (!c.is_eligible || Math.abs(c.net_delta) > 1e-5) {
        unbalanced.push(c);
      }
    }

    return {
      totalBuyLots: buy,
      totalSellLots: sell,
      unbalancedContracts: unbalanced,
      isAllEligible: unbalanced.length === 0 && contracts.length > 0,
    };
  }, [contracts]);

  if (!summary) return null;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* ── Summary KPI & Rule Banner ── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-card)] shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[var(--border-card)] pb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-[var(--accent-gold)]/10 text-[var(--accent-gold)] text-xs font-mono font-bold flex items-center justify-center">
              3
            </span>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wider font-mono">
                Step 3: The Netting Rule Audit Engine
              </h3>
              <p className="text-[11px] text-[var(--text-muted)] font-mono">
                Formula: Buy Lots + Sell Lots = 0 (Flat Delta)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-[var(--input-bg)] border border-[var(--border-card)] text-xs font-mono text-[var(--text-muted)]">
              Auditing: <strong className="text-[var(--text-main)]">{contracts.length}</strong> contract partition(s)
            </span>
          </div>
        </div>

        {/* Global Delta Audit Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3 rounded-xl bg-[var(--input-bg)] border border-[var(--border-card)]">
            <span className="text-[10px] text-[var(--text-muted)] uppercase block">Total Buy Lots</span>
            <span className="text-base font-bold text-emerald-400">+{totalBuyLots.toLocaleString()}</span>
          </div>
          <div className="p-3 rounded-xl bg-[var(--input-bg)] border border-[var(--border-card)]">
            <span className="text-[10px] text-[var(--text-muted)] uppercase block">Total Sell Lots</span>
            <span className="text-base font-bold text-rose-400">-{totalSellLots.toLocaleString()}</span>
          </div>
          <div className="p-3 rounded-xl bg-[var(--input-bg)] border border-[var(--border-card)]">
            <span className="text-[10px] text-[var(--text-muted)] uppercase block">Net Market Delta</span>
            <span
              className={`text-base font-bold ${
                totalBuyLots === totalSellLots ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {totalBuyLots === totalSellLots ? '0 (Flat Delta)' : `${totalBuyLots - totalSellLots > 0 ? '+' : ''}${totalBuyLots - totalSellLots} lots`}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-[var(--input-bg)] border border-[var(--border-card)]">
            <span className="text-[10px] text-[var(--text-muted)] uppercase block">Destination Clearing</span>
            <span className="text-base font-bold text-[var(--accent-gold)]">LCE30553</span>
          </div>
        </div>

        {/* ── Hard Gate Enforcement Banner ── */}
        {isAllEligible ? (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <strong className="text-sm block text-emerald-200">Compliance Verified (100% Zero-Delta)</strong>
                <span className="text-[11px] opacity-90">
                  All {contracts.length} selected contract partitions satisfy The Netting Rule (Buy == Sell). Cleared for consolidation into account LCE30553.
                </span>
              </div>
            </div>

            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] uppercase tracking-wider shrink-0">
              PASSED AUDIT
            </span>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-sm block text-rose-200">Hard Gate Violation: Netting Rule Failed</strong>
                  <span className="text-[11px] opacity-90">
                    {unbalancedContracts.length} of {contracts.length} selected contracts have open delta risk (Buy Lots != Sell Lots). Moving forward to export is strictly disabled until imbalances are excluded.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={excludeUnbalancedContracts}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5 shrink-0 shadow-md cursor-pointer"
                title="Automatically remove unbalanced contracts from selection"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Exclude Unbalanced Contracts</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Granular Audit Rows Table ── */}
        <div className="space-y-2 pt-2">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono px-1">
            Partition Audit Breakdown
          </div>

          <div className="border border-[var(--border-card)] rounded-xl overflow-hidden divide-y divide-[var(--border-card)]/60 bg-[var(--input-bg)] max-h-72 overflow-y-auto">
            {contracts.map((c) => (
              <div
                key={c.contract_id}
                className="p-3 text-xs font-mono flex items-center justify-between gap-3 hover:bg-white/5 transition"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {c.is_eligible ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="font-bold text-[var(--text-main)] flex items-center gap-1.5 truncate">
                      <span className="text-[var(--accent-gold)]">[{c.symbol}]</span>
                      <span>{c.period}</span>
                      <span className="text-[10px] text-[var(--text-muted)] truncate">({c.description})</span>
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                      Destination: <strong className="text-[var(--accent-gold)]">LCE30553</strong> • {c.row_count} positions
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right text-[11px]">
                    <span className="text-emerald-400 font-bold">+{c.buy_lots}B</span>
                    <span className="text-[var(--text-muted)] mx-1">/</span>
                    <span className="text-rose-400 font-bold">-{c.sell_lots}S</span>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                      c.is_eligible
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                    }`}
                  >
                    {c.is_eligible ? 'NET ZERO' : `DELTA ${c.net_delta > 0 ? `+${c.net_delta}` : c.net_delta}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Footer Navigation ── */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={() => setStep(2)}
          className="px-4 py-2.5 rounded-xl border border-[var(--border-card)] bg-[var(--card-bg)] text-xs font-mono text-[var(--text-muted)] hover:text-white transition flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back: Contracts</span>
        </button>

        <button
          type="button"
          onClick={() => setStep(4)}
          disabled={!isAllEligible}
          title={
            !isAllEligible
              ? 'Hard Gate: All selected contracts must be net-zero (Buy == Sell). Click "Exclude Unbalanced Contracts" above to proceed.'
              : 'Proceed to Review & Export'
          }
          className="px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 bg-[var(--accent-gold)] text-black hover:opacity-95 shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <span>Next: Review & Export ({contracts.length} Contracts)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
