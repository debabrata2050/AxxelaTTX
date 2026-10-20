'use client';

import React, { useMemo } from 'react';
import { useKGIStore, KGIContractInfo } from '@/store/useKGIStore';
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Building2,
} from 'lucide-react';

export const KGIStep3Audit: React.FC = () => {
  const summary = useKGIStore((s) => s.summary);
  const selectedContracts = useKGIStore((s) => s.selectedContracts);
  const destinationAccount = useKGIStore((s) => s.destinationAccount);
  const setDestinationAccount = useKGIStore((s) => s.setDestinationAccount);
  const setStep = useKGIStore((s) => s.setStep);

  const contracts = useMemo(() => {
    if (!summary) return [];
    const set = new Set(selectedContracts);
    return summary.contracts.filter((c) => set.has(c.contract_id));
  }, [summary, selectedContracts]);

  const { totalBuyLots, totalSellLots, unbalancedContracts, isAllEligible } = useMemo(() => {
    let buy = 0;
    let sell = 0;
    const unbalanced: KGIContractInfo[] = [];

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
            <span className="w-6 h-6 rounded-lg bg-sky-500/10 text-sky-400 text-xs font-mono font-bold flex items-center justify-center">
              3
            </span>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wider font-mono">
                Step 3: The Netting Rule Audit
              </h3>
              <p className="text-[11px] text-[var(--text-muted)] font-mono">
                Rule: Buy Quantity = Sell Quantity (Flat Delta per Contract)
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
              {totalBuyLots === totalSellLots
                ? '0 (Flat Delta)'
                : `${totalBuyLots - totalSellLots > 0 ? '+' : ''}${totalBuyLots - totalSellLots} lots`}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-[var(--input-bg)] border border-[var(--border-card)]">
            <span className="text-[10px] text-[var(--text-muted)] uppercase block">Clearing Account (TO)</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Building2 className="w-3.5 h-3.5 text-sky-400" />
              <input
                type="text"
                value={destinationAccount}
                onChange={(e) => setDestinationAccount(e.target.value)}
                className="w-24 bg-transparent font-bold text-sky-400 focus:outline-none focus:underline"
                title="Clearing destination account code"
              />
            </div>
          </div>
        </div>

        {/* Audit Status Banner */}
        {isAllEligible ? (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="text-xs font-mono">
              <span className="font-bold text-emerald-400 block">
                Rule Check Passed: All {contracts.length} partitions are 100% net-zero balanced.
              </span>
              <span className="text-[var(--text-muted)]">
                {totalBuyLots.toLocaleString()} buy lots and {totalSellLots.toLocaleString()} sell lots will consolidate into clearing account {destinationAccount}.
              </span>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="text-xs font-mono">
              <span className="font-bold text-amber-400 block">
                Audit Warning: {unbalancedContracts.length} partition(s) have open delta.
              </span>
              <span className="text-[var(--text-muted)]">
                Net-zero transfer requires every partition to have zero delta. Return to Step 2 to deselect unbalanced contracts.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Partition Audit Breakdown Table ── */}
      <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-card)] shadow-xs">
        <h4 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider font-mono mb-3">
          Partition Netting Breakdown
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-[var(--border-card)] text-[var(--text-muted)] text-[11px]">
                <th className="py-2 text-left font-medium">Product</th>
                <th className="py-2 text-left font-medium">Expiry</th>
                <th className="py-2 text-right font-medium">Buy Lots</th>
                <th className="py-2 text-right font-medium">Sell Lots</th>
                <th className="py-2 text-right font-medium">Delta</th>
                <th className="py-2 text-center font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-card)]">
              {contracts.map((c) => (
                <tr key={c.contract_id} className="hover:bg-white/5 transition">
                  <td className="py-2.5 font-bold text-sky-400">[{c.contract}]</td>
                  <td className="py-2.5 text-[var(--text-main)]">
                    {c.formatted_expiry || c.expirydate}
                  </td>
                  <td className="py-2.5 text-right text-emerald-400 font-bold">
                    +{c.buy_lots.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right text-rose-400 font-bold">
                    -{c.sell_lots.toLocaleString()}
                  </td>
                  <td
                    className={`py-2.5 text-right font-bold ${
                      c.net_delta === 0 ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {c.net_delta === 0 ? '0' : c.net_delta > 0 ? `+${c.net_delta}` : c.net_delta}
                  </td>
                  <td className="py-2.5 text-center">
                    {c.is_eligible ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        BALANCED
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        UNBALANCED
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Navigation Footer ── */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => setStep(2)}
          className="px-4 py-2.5 rounded-xl bg-[var(--input-bg)] hover:bg-muted border border-border text-xs font-mono font-medium text-muted-foreground hover:text-foreground transition flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Expiries</span>
        </button>

        <button
          type="button"
          onClick={() => setStep(4)}
          disabled={!isAllEligible}
          className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-md"
        >
          <span>Review & Export (Step 4)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
