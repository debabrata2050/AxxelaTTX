'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTradeStore } from '@/store/useTradeStore';
import { apiClient } from '@/lib/apiClient';
import { AccountItem } from '@/types/trade.types';
import { ArrowRight, Plus, Trash2, X, ChevronDown, Check } from 'lucide-react';

export const Step1RouteMap: React.FC = () => {
  const { routes, addRoute, removeRoute, setStep, showAlert } = useTradeStore();

  const [senderInput, setSenderInput] = useState('');
  const [recipientInput, setRecipientInput] = useState('');
  const [availableAccounts, setAvailableAccounts] = useState<AccountItem[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [isSenderDropdownOpen, setIsSenderDropdownOpen] = useState(false);

  const senderDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch all available accounts on mount
  useEffect(() => {
    let isMounted = true;
    const fetchAccounts = async () => {
      setIsLoadingAccounts(true);
      try {
        const res = await apiClient.getAccounts('');
        if (isMounted && res.accounts) {
          const normalized: AccountItem[] = (res.accounts || []).map((item: any) => {
            if (typeof item === 'string') {
              return { account: item, trade_count: 0 };
            }
            return {
              account: String(item.account || ''),
              trade_count: Number(item.trade_count) || 0,
            };
          });
          setAvailableAccounts(normalized);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setIsLoadingAccounts(false);
      }
    };

    fetchAccounts();
    return () => {
      isMounted = false;
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        senderDropdownRef.current &&
        !senderDropdownRef.current.contains(e.target as Node)
      ) {
        setIsSenderDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Filter accounts based on user input
  const filteredAccounts = useMemo(() => {
    const q = senderInput.trim().toUpperCase();
    if (!q) return availableAccounts;
    return availableAccounts.filter((a) => a.account.toUpperCase().includes(q));
  }, [availableAccounts, senderInput]);

  const handleAddRoute = () => {
    const s = senderInput.trim().toUpperCase();
    const r = recipientInput.trim().toUpperCase();

    if (!s) {
      showAlert('Input Missing', 'Please enter or select a Sender account.');
      return;
    }
    if (!r) {
      showAlert('Input Missing', 'Please enter a Recipient account.');
      return;
    }
    if (s === r) {
      showAlert('Invalid Route', 'Sender and Recipient accounts cannot be identical.');
      return;
    }

    if (availableAccounts.length > 0) {
      const exists = availableAccounts.some(
        (a) => a.account.toUpperCase() === s
      );
      if (!exists) {
        showAlert(
          'Account Not Found',
          `Sender account "${s}" is not found in the loaded trade file. Please select a valid account.`
        );
        return;
      }
    }

    const success = addRoute(s, r);
    if (!success) {
      showAlert('Duplicate Route', `Route ${s} -> ${r} has already been added.`);
      return;
    }

    setSenderInput('');
    setRecipientInput('');
    setIsSenderDropdownOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Step Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">
            Step 1: Configure Transfer Routes
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Map source trading accounts to target destination accounts (Many-to-Many supported).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => setStep(0)} className="pill-btn-secondary text-xs cursor-pointer">
            Back
          </button>
          <button
            onClick={() => {
              if (routes.length === 0) {
                showAlert('Route Required', 'Please configure at least one transfer route.');
                return;
              }
              setStep(2);
            }}
            disabled={routes.length === 0}
            className="pill-btn-primary text-xs disabled:opacity-40 cursor-pointer"
          >
            <span>Next: Select Contracts</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Route Builder Card */}
      <div className="p-6 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-card)] shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-bold text-[var(--text-main)]">Add Transfer Route</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Specify the origin source account and target destination account.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          {/* Scalable Searchable Sender Account Dropdown */}
          <div className="relative" ref={senderDropdownRef}>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-[var(--text-sub)]">
                Sender Account (From):
              </label>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">
                {availableAccounts.length} in file
              </span>
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Search or select account..."
                value={senderInput}
                onChange={(e) => {
                  setSenderInput(e.target.value.toUpperCase());
                  setIsSenderDropdownOpen(true);
                }}
                onFocus={() => setIsSenderDropdownOpen(true)}
                className="w-full px-3.5 pr-14 py-2.5 rounded-lg bg-[var(--input-bg)] border border-[var(--border-card)] focus:border-[var(--accent-gold)] outline-none text-xs font-mono uppercase text-[var(--text-main)] transition"
              />

              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {senderInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setSenderInput('');
                      setIsSenderDropdownOpen(true);
                    }}
                    className="p-1 text-[var(--text-muted)] hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsSenderDropdownOpen((prev) => !prev)}
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--accent-gold)] transition"
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${
                      isSenderDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Suggestions & Searchable Dropdown */}
            {isSenderDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-[var(--card-bg)] border border-[var(--border-card)] shadow-2xl rounded-xl max-h-56 overflow-y-auto z-50 p-1.5 font-mono text-xs">
                {isLoadingAccounts ? (
                  <div className="p-3 text-center text-xs text-[var(--text-muted)]">
                    Loading accounts...
                  </div>
                ) : filteredAccounts.length === 0 ? (
                  <div className="p-3 text-center text-xs text-[var(--text-muted)]">
                    No matching accounts found
                  </div>
                ) : (
                  filteredAccounts.map((item) => {
                    const isSelected = senderInput.trim().toUpperCase() === item.account.toUpperCase();
                    return (
                      <div
                        key={item.account}
                        onClick={() => {
                          setSenderInput(item.account);
                          setIsSenderDropdownOpen(false);
                        }}
                        className={`px-3 py-2 rounded-lg cursor-pointer transition flex items-center justify-between ${
                          isSelected
                            ? 'bg-[var(--accent-gold)] text-black font-bold'
                            : 'hover:bg-[var(--accent-gold)]/10 hover:text-[var(--accent-gold)] text-[var(--text-main)]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{item.account}</span>
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                        {item.trade_count > 0 && (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full ${
                              isSelected
                                ? 'bg-black/20 text-black'
                                : 'bg-white/5 text-[var(--text-muted)]'
                            }`}
                          >
                            {item.trade_count} trades
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Recipient Account */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-sub)] mb-1">
              Recipient Account (To):
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. SY001 or EEABC"
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value.toUpperCase())}
                className="w-full px-3.5 pr-8 py-2.5 rounded-lg bg-[var(--input-bg)] border border-[var(--border-card)] focus:border-[var(--accent-gold)] outline-none text-xs font-mono uppercase text-[var(--text-main)] transition"
              />
              {recipientInput && (
                <button
                  type="button"
                  onClick={() => setRecipientInput('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Add Button with Micro-Animation & Gradient */}
          <div>
            <button
              onClick={handleAddRoute}
              className="btn-action w-full py-2.5 px-4 rounded-xl text-xs font-bold text-[var(--accent-gold)] border-[var(--accent-gold)]/40 hover:bg-[var(--accent-gold)] hover:text-black transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Add Transfer Route
            </button>
          </div>
        </div>

        {/* Quick-Pick Sender Accounts Chips */}
        {availableAccounts.length > 0 && (
          <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-[var(--text-muted)] mr-1">
              Quick Pick:
            </span>
            {availableAccounts.slice(0, 8).map((item) => {
              const isSelected = senderInput === item.account;
              return (
                <button
                  key={item.account}
                  type="button"
                  onClick={() => setSenderInput(item.account)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-medium transition cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--accent-gold)] text-black font-bold shadow-sm'
                      : 'bg-[var(--input-bg)] border border-[var(--border-card)] text-[var(--text-sub)] hover:border-[var(--accent-gold)] hover:text-[var(--accent-gold)]'
                  }`}
                >
                  {item.account}
                  <span className="ml-1 text-[9px] opacity-70">({item.trade_count})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Transfer Pairs */}
      <div className="p-6 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-card)] shadow-sm space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Active Transfer Pairs ({routes.length}):
        </h4>

        {routes.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--text-muted)]">
            No transfer routes defined yet. Add at least one (Sender &rarr; Recipient) above.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {routes.map((r, idx) => (
              <div
                key={`${r.from}-${r.to}-${idx}`}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[var(--input-bg)] border border-[var(--border-card)] text-xs font-mono"
              >
                <span className="font-bold text-red-400">{r.from}</span>
                <ArrowRight className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                <span className="font-bold text-emerald-400">{r.to}</span>
                <button
                  onClick={() => removeRoute(idx)}
                  className="ml-1 p-0.5 rounded text-[var(--text-muted)] hover:text-red-400 hover:bg-white/5 transition cursor-pointer"
                  title="Remove route"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
