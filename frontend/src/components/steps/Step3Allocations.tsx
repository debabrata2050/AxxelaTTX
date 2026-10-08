'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useTradeStore } from '@/store/useTradeStore';
import { apiClient } from '@/lib/apiClient';
import { PriceMode } from '@/types/trade.types';
import { ArrowRight, DollarSign, Calculator, Sliders, TrendingUp, Scale } from 'lucide-react';

export const Step3Allocations: React.FC = () => {
  const {
    routes,
    selectedContracts,
    selectedProduct,
    trades,
    setTrades,
    allocations,
    updateAllocation,
    fillAllBalances,
    resetAllocations,
    toggleTradeCheckAll,
    priceMode,
    setPriceMode,
    globalManualPrice,
    setGlobalManualPrice,
    setStep,
    showAlert,
  } = useTradeStore();

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadTrades = async () => {
      setIsLoading(true);
      try {
        const accounts = routes.map((r) => r.from);
        const data = await apiClient.getTrades(
          accounts,
          selectedContracts,
          selectedContracts.length > 0 ? 'ALL' : selectedProduct
        );
        if (isMounted) {
          setTrades(data.trades || []);
        }
      } catch (err: any) {
        console.error(err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadTrades();
    return () => {
      isMounted = false;
    };
  }, [routes, selectedContracts, selectedProduct, setTrades]);

  const { totalLots, totalActiveTrades } = useMemo(() => {
    let lots = 0;
    let trds = 0;
    trades.forEach((t) => {
      const a = allocations[t.row_id];
      if (a && a.selected) {
        lots += Number(a.transfer_qty) || 0;
        trds++;
      }
    });
    return { totalLots: lots, totalActiveTrades: trds };
  }, [trades, allocations]);

  const [senderTab, setSenderTab] = useState<string>('ALL');

  const accountMetrics = useMemo(() => {
    const res: Record<string, { lots: number; trades: number; totalAvailable: number; toAccount: string }> = {};
    trades.forEach((t) => {
      const acc = String(t.account || '').toUpperCase();
      if (!res[acc]) {
        const matchingRoute = routes.find((r) => r.from.toUpperCase() === acc);
        res[acc] = {
          lots: 0,
          trades: 0,
          totalAvailable: 0,
          toAccount: matchingRoute?.to || '',
        };
      }
      res[acc].totalAvailable += t.qtybalance || 0;
      const a = allocations[t.row_id];
      if (a && a.selected) {
        res[acc].lots += Number(a.transfer_qty) || 0;
        res[acc].trades += 1;
      }
    });
    return res;
  }, [trades, allocations, routes]);

  const visibleTrades = useMemo(() => {
    if (senderTab === 'ALL') return trades;
    return trades.filter((t) => String(t.account || '').toUpperCase() === senderTab.toUpperCase());
  }, [trades, senderTab]);

  const allChecked = useMemo(() => {
    if (visibleTrades.length === 0) return false;
    return visibleTrades.every((t) => allocations[t.row_id]?.selected);
  }, [visibleTrades, allocations]);

  const handleProceedToPreview = () => {
    if (totalLots <= 0) {
      showAlert('No Allocations', 'Please allocate at least one lot before proceeding.');
      return;
    }

    // 1. Validate every active trade row
    for (const t of trades) {
      const a = allocations[t.row_id];
      if (a && a.selected) {
        const fromAcc = String(t.account || '').toUpperCase().trim();
        const toAcc = String(a.to_account || '').toUpperCase().trim();

        if (!toAcc) {
          showAlert(
            'Missing Destination Account',
            `Trade row for ${t.contractcode} (${fromAcc}) has no destination account specified.`
          );
          return;
        }

        if (fromAcc === toAcc) {
          showAlert(
            'Invalid Transfer Route',
            `Trade row for ${t.contractcode} has identical Sender and Recipient (${fromAcc} → ${toAcc}). Self-transfer is prohibited.`
          );
          return;
        }

        const qty = Number(a.transfer_qty);
        if (isNaN(qty) || qty <= 0) {
          showAlert(
            'Invalid Quantity',
            `Trade row for ${t.contractcode} (${fromAcc}) has invalid transfer quantity: ${a.transfer_qty}. Must be greater than 0.`
          );
          return;
        }

        if (qty > t.qtybalance) {
          showAlert(
            'Quantity Exceeds Balance',
            `Trade row for ${t.contractcode} (${fromAcc}) transfer quantity (${qty}) exceeds available balance (${t.qtybalance}).`
          );
          return;
        }

        const p = a.custom_price !== null ? Number(a.custom_price) : Number(t.price);
        if (isNaN(p) || p <= 0) {
          showAlert(
            'Invalid Price',
            `Trade row for ${t.contractcode} (${fromAcc}) has invalid price: ${a.custom_price}. Trade price must be positive.`
          );
          return;
        }
      }
    }

    // 2. Validate multi-account allocation completeness
    const activeAccounts = Object.keys(accountMetrics);
    if (activeAccounts.length > 1) {
      const zeroAccounts = activeAccounts.filter((acc) => accountMetrics[acc].lots === 0);
      if (zeroAccounts.length > 0) {
        showAlert(
          'Zero Allocation Warning',
          `Selected account(s) [${zeroAccounts.join(', ')}] have 0 lots allocated for transfer. Only trades with positive allocations will be included in the preview.`
        );
      }
    }

    setStep(4);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">
            Step 3: Pricing Strategy & Lot Allocation
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Choose pricing logic and fine-tune lots transferred per individual trade row.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => setStep(2)} className="pill-btn-secondary text-xs">
            Back
          </button>
          <button
            onClick={handleProceedToPreview}
            disabled={totalLots <= 0}
            className="pill-btn-primary text-xs disabled:opacity-40"
          >
            <span>Next: Review Preview</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Pricing Strategy Cards */}
      <div className="p-6 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-card)] shadow-sm space-y-4">
        <h3 className="text-base font-bold text-[var(--text-main)]">Trade Price Source Selection</h3>
        <p className="text-xs text-[var(--text-muted)] -mt-2">
          Selecting a mode below applies it to <strong>all rows</strong>. You can still override individual rows using the dropdown in the table.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Trade Price */}
          <label
            onClick={() => setPriceMode('price')}
            className={`group relative p-4 rounded-xl border cursor-pointer transition-all duration-300 ease-out flex items-center justify-between select-none hover:-translate-y-0.5 ${priceMode === 'price'
                ? 'border-[var(--accent-gold)] bg-[var(--card-hover)] shadow-md shadow-[var(--accent-gold)]/5 ring-1 ring-[var(--accent-gold)]/30'
                : 'border-[var(--border-card)] bg-[var(--input-bg)] hover:border-[var(--border-subtle)] hover:bg-[var(--card-hover)]/40 shadow-sm'
              }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name="price-strategy"
                checked={priceMode === 'price'}
                onChange={() => setPriceMode('price')}
                className="w-4 h-4 accent-[var(--accent-gold)] cursor-pointer transition-transform duration-200 group-hover:scale-110"
              />
              <span className="text-sm font-bold text-[var(--text-main)] group-hover:text-[var(--accent-gold)] transition-colors duration-200">
                Trade Price
              </span>
            </div>
            <div
              className={`flex items-center justify-center w-9 h-9 rounded-xl border transition-all duration-300 ${priceMode === 'price'
                  ? 'bg-[var(--accent-gold)]/15 border-[var(--accent-gold)]/30 text-[var(--accent-gold)] shadow-sm scale-105'
                  : 'bg-[var(--card-bg)] border-[var(--border-card)] text-[var(--text-muted)] group-hover:text-[var(--accent-gold)] group-hover:border-[var(--border-subtle)] group-hover:scale-105'
                }`}
            >
              <TrendingUp className="w-4 h-4 transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </div>
          </label>

          {/* Settlement Price */}
          <label
            onClick={() => setPriceMode('settle')}
            className={`group relative p-4 rounded-xl border cursor-pointer transition-all duration-300 ease-out flex items-center justify-between select-none hover:-translate-y-0.5 ${priceMode === 'settle'
                ? 'border-[var(--accent-gold)] bg-[var(--card-hover)] shadow-md shadow-[var(--accent-gold)]/5 ring-1 ring-[var(--accent-gold)]/30'
                : 'border-[var(--border-card)] bg-[var(--input-bg)] hover:border-[var(--border-subtle)] hover:bg-[var(--card-hover)]/40 shadow-sm'
              }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name="price-strategy"
                checked={priceMode === 'settle'}
                onChange={() => setPriceMode('settle')}
                className="w-4 h-4 accent-[var(--accent-gold)] cursor-pointer transition-transform duration-200 group-hover:scale-110"
              />
              <span className="text-sm font-bold text-[var(--text-main)] group-hover:text-[var(--accent-gold)] transition-colors duration-200">
                Settlement Price
              </span>
            </div>
            <div
              className={`flex items-center justify-center w-9 h-9 rounded-xl border transition-all duration-300 ${priceMode === 'settle'
                  ? 'bg-[var(--accent-gold)]/15 border-[var(--accent-gold)]/30 text-[var(--accent-gold)] shadow-sm scale-105'
                  : 'bg-[var(--card-bg)] border-[var(--border-card)] text-[var(--text-muted)] group-hover:text-[var(--accent-gold)] group-hover:border-[var(--border-subtle)] group-hover:scale-105'
                }`}
            >
              <Scale className="w-4 h-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12" />
            </div>
          </label>

          {/* Manual Price */}
          <label
            onClick={() => setPriceMode('manual')}
            className={`group relative p-4 rounded-xl border cursor-pointer transition-all duration-300 ease-out flex items-center justify-between select-none hover:-translate-y-0.5 ${priceMode === 'manual'
                ? 'border-[var(--accent-gold)] bg-[var(--card-hover)] shadow-md shadow-[var(--accent-gold)]/5 ring-1 ring-[var(--accent-gold)]/30'
                : 'border-[var(--border-card)] bg-[var(--input-bg)] hover:border-[var(--border-subtle)] hover:bg-[var(--card-hover)]/40 shadow-sm'
              }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name="price-strategy"
                checked={priceMode === 'manual'}
                onChange={() => setPriceMode('manual')}
                className="w-4 h-4 accent-[var(--accent-gold)] cursor-pointer transition-transform duration-200 group-hover:scale-110"
              />
              <span className="text-sm font-bold text-[var(--text-main)] group-hover:text-[var(--accent-gold)] transition-colors duration-200">
                Manual
              </span>
            </div>
            <div
              className={`flex items-center justify-center w-9 h-9 rounded-xl border transition-all duration-300 ${priceMode === 'manual'
                  ? 'bg-[var(--accent-gold)]/15 border-[var(--accent-gold)]/30 text-[var(--accent-gold)] shadow-sm scale-105'
                  : 'bg-[var(--card-bg)] border-[var(--border-card)] text-[var(--text-muted)] group-hover:text-[var(--accent-gold)] group-hover:border-[var(--border-subtle)] group-hover:scale-105'
                }`}
            >
              <DollarSign className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
            </div>
          </label>
        </div>

        {/* Manual price input — shown only when Manual is selected */}
        {priceMode === 'manual' && (
          <div className="flex items-center gap-3 pt-1">
            <label className="text-xs font-semibold text-[var(--text-muted)] whitespace-nowrap">
              Apply price to all rows:
            </label>
            <input
              type="number"
              step="any"
              min={0}
              placeholder="Enter price..."
              value={globalManualPrice !== null ? globalManualPrice : ''}
              onChange={(e) => {
                const v = e.target.value === '' ? null : parseFloat(e.target.value);
                setGlobalManualPrice(v);
              }}
              autoFocus
              className="w-36 px-3 py-1.5 rounded-lg bg-[var(--input-bg)] border border-[var(--accent-gold)]/50 text-sm font-bold font-mono text-[var(--accent-gold)] outline-none focus:border-[var(--accent-gold)] focus:ring-1 focus:ring-[var(--accent-gold)]/30 placeholder:text-[var(--text-muted)] placeholder:font-normal"
            />
            <span className="text-xs text-[var(--text-muted)]">
              Individual rows can still be overridden in the table below.
            </span>
          </div>
        )}
      </div>

      {/* Allocation Table Card */}
      <div className="p-6 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-card)] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[var(--text-main)]">
              Execution Rows & Lot Allocation
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Edit transferred lots or override price individually per trade execution row.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={fillAllBalances} className="btn-action text-xs px-3.5 py-1.5 rounded-lg font-bold">
              Transfer Full Balance
            </button>
            <button onClick={resetAllocations} className="btn-action text-xs px-3.5 py-1.5 rounded-lg font-bold">
              Reset
            </button>
          </div>
        </div>

        {/* Multi-Account Live Validation Banner */}
        {Object.keys(accountMetrics).length > 1 && (
          <div className="p-3.5 rounded-xl bg-[var(--card-bg)] border border-emerald-500/20 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="font-semibold text-[var(--text-main)]">
                Multi-Account Transfer Status:
              </span>
              <span className="text-[var(--text-muted)]">
                {Object.keys(accountMetrics).length} accounts active
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
              {Object.entries(accountMetrics).map(([acc, met]) => (
                <span
                  key={acc}
                  className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${met.lots > 0
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    }`}
                >
                  <span className="font-bold text-red-400">{acc}</span>
                  {met.toAccount && (
                    <>
                      <ArrowRight className="w-3 h-3 text-[var(--accent-gold)]" />
                      <span className="font-bold text-emerald-400">{met.toAccount}</span>
                    </>
                  )}
                  <span>:</span>
                  <span className="font-bold">{met.lots.toLocaleString()} lots</span>
                  <span className="opacity-70">({met.trades} trds)</span>
                  {met.lots > 0 ? (
                    <span className="text-emerald-400 font-bold ml-0.5">✓</span>
                  ) : (
                    <span className="text-amber-400 font-bold ml-0.5" title="No lots allocated for this sender">⚠ 0</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Account Filter Tabs for Multi-Account Transfers */}
        {Object.keys(accountMetrics).length > 1 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-semibold text-[var(--text-muted)] mr-1">Filter View:</span>
            <button
              type="button"
              onClick={() => setSenderTab('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition cursor-pointer ${senderTab === 'ALL'
                  ? 'bg-[var(--accent-gold)] text-black font-bold shadow-sm'
                  : 'bg-[var(--input-bg)] border border-[var(--border-card)] text-[var(--text-sub)] hover:text-white'
                }`}
            >
              All Trades ({trades.length} trds • {totalLots.toLocaleString()} lots)
            </button>
            {Object.entries(accountMetrics).map(([acc, met]) => {
              const isAct = senderTab === acc;
              return (
                <button
                  key={acc}
                  type="button"
                  onClick={() => setSenderTab(acc)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium flex items-center gap-1.5 transition cursor-pointer ${isAct
                      ? 'bg-[var(--accent-gold)] text-black font-bold shadow-sm'
                      : 'bg-[var(--input-bg)] border border-[var(--border-card)] text-[var(--text-sub)] hover:text-white'
                    }`}
                >
                  <span className={isAct ? 'text-black font-bold' : 'text-red-400 font-bold'}>
                    {acc}
                  </span>
                  {met.toAccount && (
                    <>
                      <ArrowRight className={`w-3 h-3 ${isAct ? 'text-black' : 'text-[var(--accent-gold)]'}`} />
                      <span className={isAct ? 'text-black font-bold' : 'text-emerald-400 font-bold'}>
                        {met.toAccount}
                      </span>
                    </>
                  )}
                  <span className="opacity-80">
                    ({met.trades} trds • {met.lots.toLocaleString()} lots)
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Table Container with Horizontal Scroll */}
        <div className="overflow-x-auto rounded-xl border border-[var(--border-card)] max-h-[460px]">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead className="bg-[var(--header-bg)] sticky top-0 z-10 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border-subtle)]">
              <tr>
                <th className="p-3 w-10">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(e) => toggleTradeCheckAll(e.target.checked)}
                    className="accent-[var(--accent-gold)]"
                  />
                </th>
                <th className="p-3">Account & Destination</th>
                <th className="p-3">Product</th>
                <th className="p-3">Symbol / Name</th>
                <th className="p-3">Side</th>
                <th className="p-3">Avail Lots</th>
                <th className="p-3">Transfer Qty</th>
                <th className="p-3">Price Mode</th>
                <th className="p-3">Trade Price</th>
                <th className="p-3">Expiry</th>
                <th className="p-3">Date</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--border-subtle)] font-mono">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-[var(--text-muted)]">
                    Loading trades...
                  </td>
                </tr>
              ) : visibleTrades.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-[var(--text-muted)]">
                    No matching trades found for selected contracts.
                  </td>
                </tr>
              ) : (
                visibleTrades.map((t) => {
                  const accStr =
                    typeof t.account === 'object' && t.account !== null
                      ? String((t.account as any).account || '')
                      : String(t.account || '');
                  const matchingRoutes = routes.filter(
                    (r) => r.from.toUpperCase() === accStr.toUpperCase()
                  );
                  const defaultTo = matchingRoutes[0]?.to || '';
                  const alloc = allocations[t.row_id] || {
                    selected: true,
                    transfer_qty: t.qtybalance,
                    custom_price: t.price,
                    to_account: defaultTo,
                    price_mode: null,
                  };

                  const isBuy = (t.transactiontype || '').toUpperCase() === 'B';
                  const sideBadge = isBuy ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/20">
                      B
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-red-500/15 text-red-400 font-bold border border-red-500/20">
                      S
                    </span>
                  );

                  return (
                    <tr
                      key={t.row_id}
                      className={`hover:bg-[var(--accent-gold)]/5 transition ${alloc.selected ? 'bg-[var(--accent-gold)]/[0.02]' : 'opacity-60'
                        }`}
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={alloc.selected}
                          onChange={(e) =>
                            updateAllocation(t.row_id, { selected: e.target.checked })
                          }
                          className="accent-[var(--accent-gold)]"
                        />
                      </td>

                      <td className="p-3 font-bold text-[var(--text-main)]">
                        <div>{accStr}</div>
                        {matchingRoutes.length > 1 ? (
                          <div className="mt-1">
                            <select
                              value={alloc.to_account || defaultTo}
                              onChange={(e) =>
                                updateAllocation(t.row_id, { to_account: e.target.value })
                              }
                              className="px-1.5 py-0.5 rounded bg-[var(--input-bg)] border border-[var(--border-card)] text-[10px] text-emerald-400 outline-none"
                            >
                              {matchingRoutes.map((mr) => (
                                <option key={mr.to} value={mr.to}>
                                  &rarr; {mr.to}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
                            &rarr; {alloc.to_account || defaultTo}
                          </div>
                        )}
                      </td>

                      <td className="p-3 text-[10px]">
                        {(() => {
                          const s = (t.sectyp || 'FUT').toUpperCase();
                          const isOption = s === 'OPT' || s.includes('OPT');
                          return isOption ? (
                            <span className="px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-400 border border-purple-500/30 font-bold font-mono text-[10px]">
                              OPT
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 font-bold font-mono text-[10px]">
                              FUT
                            </span>
                          );
                        })()}
                      </td>

                      <td className="p-3 max-w-[240px]">
                        <div className="font-bold text-[var(--accent-gold)] font-mono">{t.contractcode}</div>
                        {t.contractfullname && (
                          <div className="text-[11px] font-sans text-[var(--text-main)] truncate" title={t.contractfullname}>
                            {t.contractfullname}
                          </div>
                        )}
                        {t.contractdescription && t.contractdescription.trim() !== (t.contractfullname || '').trim() && (
                          <div className="text-[10px] font-mono text-[var(--text-muted)] truncate" title={t.contractdescription}>
                            {t.contractdescription}
                          </div>
                        )}
                      </td>

                      <td className="p-3">{sideBadge}</td>
                      <td className="p-3 font-bold text-[var(--text-main)]">{t.qtybalance}</td>

                      <td className="p-3">
                        <input
                          type="number"
                          min={0}
                          max={t.qtybalance}
                          value={alloc.transfer_qty}
                          onChange={(e) => {
                            let v = parseFloat(e.target.value) || 0;
                            if (v < 0) v = 0;
                            if (v > t.qtybalance) v = t.qtybalance;
                            updateAllocation(t.row_id, {
                              transfer_qty: v,
                              selected: v > 0,
                            });
                          }}
                          className="w-16 px-2 py-1 rounded-lg bg-[var(--input-bg)] border border-[var(--border-card)] text-center text-xs font-bold font-mono text-[var(--text-main)] outline-none focus:border-[var(--accent-gold)]"
                        />
                      </td>

                      <td className="p-3">
                        {/* Per-row price mode override */}
                        <select
                          value={alloc.price_mode ?? priceMode}
                          onChange={(e) => {
                            const mode = e.target.value as 'price' | 'settle' | 'manual';
                            updateAllocation(t.row_id, {
                              price_mode: mode,
                              custom_price:
                                mode === 'settle'
                                  ? t.settle ?? t.price
                                  : mode === 'price'
                                  ? t.price
                                  : alloc.custom_price,
                            });
                          }}
                          className="w-28 px-2 py-1 rounded-lg bg-[var(--input-bg)] border border-[var(--border-card)] text-xs font-mono text-[var(--text-main)] outline-none focus:border-[var(--accent-gold)]"
                        >
                          <option value="price">Trade Price</option>
                          <option value="settle">Settlement</option>
                          <option value="manual">Manual</option>
                        </select>
                      </td>

                      <td className="p-3">
                        <input
                          type="number"
                          step="any"
                          value={alloc.custom_price !== null ? alloc.custom_price : ''}
                          disabled={
                            (alloc.price_mode ?? priceMode) === 'price' ||
                            (alloc.price_mode ?? priceMode) === 'settle'
                          }
                          onChange={(e) => {
                            const p = e.target.value === '' ? null : parseFloat(e.target.value);
                            updateAllocation(t.row_id, { custom_price: p, price_mode: 'manual' });
                          }}
                          className="w-20 px-2 py-1 bg-[var(--input-bg)] rounded border border-[var(--border-card)] text-center text-xs font-bold text-[var(--accent-gold)] outline-none focus:border-[var(--accent-gold)] disabled:opacity-40 disabled:cursor-not-allowed"
                          title={
                            (alloc.price_mode ?? priceMode) === 'price'
                              ? 'Using trade price — switch mode to Manual to edit'
                              : (alloc.price_mode ?? priceMode) === 'settle'
                              ? 'Using settle price — switch mode to Manual to edit'
                              : 'Enter custom price'
                          }
                        />
                      </td>

                      <td className="p-3 text-[11px] text-[var(--text-muted)]">
                        {t.contractexpiry || t.expirydate || '-'}
                      </td>
                      <td className="p-3 text-[11px] text-[var(--text-muted)]">
                        {t.datestr || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Totals */}
        <div className="flex justify-between items-center text-xs font-mono text-[var(--text-muted)] px-1">
          <div>
            Active Trades: <strong className="text-[var(--text-main)]">{totalActiveTrades}</strong>
          </div>
          <div>
            Transfer Lots Total:{' '}
            <strong className="text-[var(--accent-gold)] font-bold">{totalLots} Lots</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
