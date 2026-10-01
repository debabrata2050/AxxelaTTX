'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useTradeStore } from '@/store/useTradeStore';
import { apiClient } from '@/lib/apiClient';
import { ProductType } from '@/types/trade.types';
import {
  Search,
  ChevronDown,
  Check,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

export const Step2Contracts: React.FC = () => {
  const {
    routes,
    contracts,
    setContracts,
    selectedContracts,
    toggleContract,
    selectAllContracts,
    clearAllContracts,
    selectedProduct,
    setSelectedProduct,
    selectedSenderAccount,
    setSelectedSenderAccount,
    contractSearchQuery,
    setContractSearchQuery,
    setStep,
    showAlert,
  } = useTradeStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isSenderDropdownOpen, setIsSenderDropdownOpen] = useState(false);
  const [senderSearch, setSenderSearch] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);

  const uniqueSenders = useMemo(() => {
    return Array.from(new Set(routes.map((r) => r.from)));
  }, [routes]);

  // Load contracts whenever routes, product, or sender filter changes
  useEffect(() => {
    let isMounted = true;
    const loadContracts = async () => {
      setIsLoading(true);
      try {
        const accounts =
          selectedSenderAccount && selectedSenderAccount !== 'ALL'
            ? selectedSenderAccount
            : routes.map((r) => r.from).join(',');

        const data = await apiClient.getContracts(
          accounts,
          selectedProduct,
          contractSearchQuery
        );
        if (isMounted) {
          setContracts(data.contracts || []);
        }
      } catch (err: any) {
        console.error(err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    const timer = setTimeout(loadContracts, 180);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [routes, selectedProduct, selectedSenderAccount, contractSearchQuery, setContracts]);

  // Close sender dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsSenderDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const totalAvailableLots = useMemo(() => {
    return contracts.reduce((sum, c) => sum + (c.available_lots || 0), 0);
  }, [contracts]);

  const filteredSenders = useMemo(() => {
    const q = senderSearch.trim().toUpperCase();
    return [
      { sender: 'ALL', label: 'All Senders', desc: `${uniqueSenders.length} accounts` },
      ...uniqueSenders.map((s) => {
        const routeCnt = routes.filter((r) => r.from === s).length;
        return { sender: s, label: s, desc: `${routeCnt} route${routeCnt > 1 ? 's' : ''}` };
      }),
    ].filter((item) => !q || item.label.toUpperCase().includes(q));
  }, [uniqueSenders, routes, senderSearch]);

  const selectedSummary = useMemo(() => {
    const summary: Record<string, { contracts: number; lots: number }> = {};
    uniqueSenders.forEach((s) => {
      summary[s] = { contracts: 0, lots: 0 };
    });
    contracts.forEach((c) => {
      const key =
        c.contract_key ||
        (c.account ? `${c.account}::${c.contract_id || c.contractcode}` : c.contract_id || c.contractcode);
      if (selectedContracts.includes(key)) {
        const sender = c.account || 'DEFAULT';
        if (!summary[sender]) {
          summary[sender] = { contracts: 0, lots: 0 };
        }
        summary[sender].contracts += 1;
        summary[sender].lots += c.available_lots || 0;
      }
    });
    return summary;
  }, [contracts, selectedContracts, uniqueSenders]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">
            Step 2: Filter Products & Contracts
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Select specific financial products and contracts to transfer.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => setStep(1)} className="pill-btn-secondary text-xs">
            Back
          </button>
          <button
            onClick={() => {
              if (selectedContracts.length === 0) {
                showAlert('Contracts Required', 'Please select at least one contract to transfer.');
                return;
              }
              setStep(3);
            }}
            disabled={selectedContracts.length === 0}
            className="pill-btn-primary text-xs disabled:opacity-40"
          >
            <span>Next: Lots & Pricing</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-card)] shadow-sm flex flex-wrap items-center justify-between gap-4">
        {/* Product Filter Chips (Renamed Future & Options) */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--text-muted)]">Product:</span>
          <div className="flex items-center gap-1.5">
            {(['ALL', 'FUT', 'OPT'] as ProductType[]).map((prod) => {
              const label = prod === 'ALL' ? 'All' : prod === 'FUT' ? 'Future' : 'Options';
              const isActive = selectedProduct === prod;
              return (
                <button
                  key={prod}
                  onClick={() => setSelectedProduct(prod)}
                  className={`chip-btn ${isActive ? 'active' : ''}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scalable Searchable Sender Dropdown */}
        {uniqueSenders.length > 1 && (
          <div className="relative" ref={dropdownRef}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--text-muted)]">Sender:</span>
              <div className="relative min-w-[190px]">
                <button
                  type="button"
                  onClick={() => setIsSenderDropdownOpen((prev) => !prev)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[var(--input-bg)] border border-[var(--border-card)] hover:border-[var(--accent-gold)] text-xs font-mono text-[var(--text-main)] flex items-center justify-between gap-2 transition"
                >
                  <span className="truncate font-semibold text-[var(--accent-gold)]">
                    {selectedSenderAccount === 'ALL' ? 'All Senders' : selectedSenderAccount}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform ${
                      isSenderDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isSenderDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1.5 w-64 p-2 rounded-xl bg-[var(--card-bg)] border border-[var(--border-card)] shadow-2xl z-50 space-y-2">
                    <input
                      type="text"
                      placeholder="Search sender account..."
                      value={senderSearch}
                      onChange={(e) => setSenderSearch(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--input-bg)] border border-[var(--border-card)] text-xs font-mono text-[var(--text-main)] outline-none focus:border-[var(--accent-gold)]"
                    />
                    <div className="max-h-48 overflow-y-auto space-y-1 font-mono text-xs pr-1">
                      {filteredSenders.map((item) => {
                        const isAct = selectedSenderAccount === item.sender;
                        return (
                          <div
                            key={item.sender}
                            onClick={() => {
                              setSelectedSenderAccount(item.sender);
                              setIsSenderDropdownOpen(false);
                            }}
                            className={`sender-filter-item ${isAct ? 'active' : ''}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-bold">{item.label}</span>
                              {isAct && <Check className="w-3.5 h-3.5 text-[var(--accent-gold)]" />}
                            </div>
                            <span className="text-[10px] text-[var(--text-muted)]">{item.desc}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Contract Search Input */}
        <div className="flex-grow max-w-md relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search contract code or description..."
            value={contractSearchQuery}
            onChange={(e) => setContractSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--input-bg)] border border-[var(--border-card)] focus:border-[var(--accent-gold)] outline-none text-xs text-[var(--text-main)] transition"
          />
        </div>

        {/* Select / Deselect All Action Buttons */}
        <div className="flex items-center gap-2">
          <button onClick={selectAllContracts} className="btn-action text-xs px-3 py-1.5 rounded-lg">
            Select All
          </button>
          <button onClick={clearAllContracts} className="btn-action text-xs px-3 py-1.5 rounded-lg">
            Deselect All
          </button>
        </div>
      </div>

      {/* Contracts Counters & Multi-Account Selection Status */}
      <div className="space-y-2 px-1">
        <div className="flex justify-between items-center text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-3">
            <span>
              Matching: <strong className="text-[var(--text-main)] font-mono">{contracts.length}</strong>
            </span>
            <span>|</span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-gold)] inline-block"></span>
              Selected: <strong className="text-[var(--accent-gold)] font-mono font-bold">{selectedContracts.length}</strong>
            </span>
          </div>
          <span>
            Available Lots: <strong className="text-[var(--accent-gold)] font-mono">{totalAvailableLots.toLocaleString()}</strong>
          </span>
        </div>

        {/* Multi-Account Selection Breakdown Chips */}
        {uniqueSenders.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-[var(--border-subtle)]/60">
            <span className="text-[11px] font-semibold text-[var(--text-muted)]">Selected by Account:</span>
            {uniqueSenders.map((s) => {
              const info = selectedSummary[s] || { contracts: 0, lots: 0 };
              const matchingRoute = routes.find((r) => r.from.toUpperCase() === s.toUpperCase());
              const hasSelection = info.contracts > 0;
              return (
                <div
                  key={s}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono flex items-center gap-1.5 border transition ${
                    hasSelection
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  }`}
                >
                  <span className="font-bold text-red-400">{s}</span>
                  {matchingRoute && (
                    <>
                      <ArrowRight className="w-3 h-3 text-[var(--accent-gold)]" />
                      <span className="font-bold text-emerald-400">{matchingRoute.to}</span>
                    </>
                  )}
                  <span>:</span>
                  <span className="font-bold">{info.contracts} contracts</span>
                  <span className="opacity-80">({info.lots.toLocaleString()} lots)</span>
                  {hasSelection ? (
                    <span className="ml-1 text-[10px] text-emerald-400 font-bold">✓</span>
                  ) : (
                    <span className="ml-1 text-[10px] text-amber-400 font-bold" title="No contracts selected for this sender">⚠ 0</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Contracts Grid (Responsive 1 col Mobile, 2 col Tablet, 3 col Desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-[480px] overflow-y-auto pr-1">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-xs text-[var(--text-muted)]">
            Loading contracts...
          </div>
        ) : contracts.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-[var(--text-muted)]">
            No contracts match current filters.
          </div>
        ) : (
          contracts.map((c) => {
            const contractKey =
              c.contract_key ||
              (c.account ? `${c.account}::${c.contract_id || c.contractcode}` : c.contract_id || c.contractcode);
            const isSelected = selectedContracts.includes(contractKey);
            const expText = c.contractexpiry || c.expirydate || 'N/A';
            const optExtra = c.sectyp === 'OPT' ? ` | ${c.cp || ''} ${c.strike || ''}` : '';
            const fullName = (c.contractfullname || '').trim();
            const desc = (c.contractdescription || '').trim();
            const hasDifferentDesc = desc && desc.toLowerCase() !== fullName.toLowerCase();
            const senderAcc = c.account || (c.accounts && c.accounts[0]) || '';
            const routeForSender = routes.find(
              (r) => r.from.toUpperCase() === senderAcc.toUpperCase()
            );
            const targetAccount = routeForSender?.to;

            return (
              <div
                key={contractKey}
                onClick={() => toggleContract(contractKey)}
                className={`contract-card ${isSelected ? 'selected' : ''}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-base font-extrabold text-[var(--accent-gold)]">
                      {c.contractcode}
                    </span>
                    {senderAcc && (
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-[var(--input-bg)] border border-[var(--border-card)] font-mono text-[11px]">
                        <span className="font-bold text-red-400">{senderAcc}</span>
                        {targetAccount && (
                          <>
                            <ArrowRight className="w-3 h-3 text-[var(--accent-gold)]" />
                            <span className="font-bold text-emerald-400">{targetAccount}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono transition ${
                        isSelected
                          ? 'bg-[var(--accent-gold)] text-black shadow-sm'
                          : 'bg-white/10 text-[var(--text-muted)]'
                      }`}
                    >
                      {isSelected ? '✓ Selected' : 'Select'}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md font-mono ${
                        (c.sectyp || 'FUT').toUpperCase() === 'OPT'
                          ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                          : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                      }`}
                    >
                      {c.sectyp || 'FUT'}
                    </span>
                  </div>
                </div>

                <div className="mt-1.5 space-y-1">
                  <div
                    className="text-xs font-semibold text-[var(--text-main)] truncate"
                    title={fullName || c.contractcode}
                  >
                    {fullName || c.contractcode}
                  </div>
                  {hasDifferentDesc && (
                    <div className="text-[11px] text-[var(--text-sub)] truncate flex items-center gap-1.5 font-mono">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--accent-gold)]/15 text-[var(--accent-gold)] uppercase flex-shrink-0">
                        Desc
                      </span>
                      <span className="truncate">{desc}</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center text-[11px] pt-2.5 mt-2.5 border-t border-[var(--border-subtle)] text-[var(--text-muted)]">
                  <span>
                    Exp: {expText}
                    {optExtra}
                  </span>
                  <span className="font-mono font-bold text-[var(--text-main)]">
                    {c.available_lots} Lots ({c.trade_count} trds)
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
