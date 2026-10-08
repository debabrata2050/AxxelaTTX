'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  OnboardingUserInput,
  OnboardingDerived,
  EMPTY_USER_INPUT,
  SheetStatus,
  SheetAccountItem,
  SheetPersonItem,
} from '@/types/onboarding.types';
import { useOnboardingStore, previewDerived } from '@/store/useOnboardingStore';
import {
  Loader2,
  UserPlus,
  ChevronDown,
  Sparkles,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Check,
  AlertTriangle,
  Users,
  Settings,
  Unlink,
} from 'lucide-react';
import {
  fetchSheetStatus,
  refreshSheetData,
  fetchSheetAccounts,
  fetchSheetAccount,
  batchFetchSheetAccounts,
  disconnectSheetConfig,
} from '@/lib/onboardingClient';
import { ChangeSheetModal } from './ChangeSheetModal';
import { JointAccountModal } from './JointAccountModal';

interface Props {
  onAdd: (input: OnboardingUserInput, derived: OnboardingDerived) => void;
  onBatchAdd?: (items: Array<{ input: OnboardingUserInput; derived: OnboardingDerived }>) => void;
}

const LOCATIONS = ['Kolkata', 'Gurgaon', 'Bengaluru', 'Mumbai', 'Dubai'] as const;

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-[var(--text-muted)] opacity-60">{hint}</p>}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  maxLength,
  type = 'text',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={maxLength}
      placeholder={placeholder}
      className="
        w-full rounded-lg border border-[var(--border-card)] bg-[var(--input-bg)]
        text-[var(--text-main)] text-sm px-3 py-2
        focus:outline-none focus:ring-2 focus:ring-[var(--accent-gold)]/50
        placeholder:text-[var(--text-muted)] placeholder:opacity-50
      "
    />
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="
          w-full appearance-none rounded-lg border border-[var(--border-card)]
          bg-[var(--input-bg)] text-[var(--text-main)] text-sm px-3 py-2 pr-8
          focus:outline-none focus:ring-2 focus:ring-[var(--accent-gold)]/50
        "
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
    </div>
  );
}

function DerivedBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
        {label}
      </span>
      <span className="font-mono text-xs text-[var(--accent-gold)] bg-[var(--accent-gold)]/10 px-2 py-0.5 rounded border border-[var(--accent-gold)]/20 min-h-[24px] flex items-center">
        {value || <span className="opacity-30">—</span>}
      </span>
    </div>
  );
}

export function OnboardingForm({ onAdd, onBatchAdd }: Props) {
  const { commsCodes } = useOnboardingStore();
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [form, setForm] = useState<OnboardingUserInput>(EMPTY_USER_INPUT);
  const [derived, setDerived] = useState<OnboardingDerived | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Google Sheet state
  const [sheetStatus, setSheetStatus] = useState<SheetStatus | null>(null);
  const [isCheckingSheet, setIsCheckingSheet] = useState(false);
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [isChangeSheetOpen, setIsChangeSheetOpen] = useState(false);

  // Auto Mode search & batch input
  const [searchInput, setSearchInput] = useState('');
  const [sheetAccounts, setSheetAccounts] = useState<SheetAccountItem[]>([]);
  const [isFetchingAccount, setIsFetchingAccount] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Joint account modal state
  const [jointModalData, setJointModalData] = useState<{
    account: string;
    persons: SheetPersonItem[];
  } | null>(null);

  const searchBoxRef = useRef<HTMLDivElement>(null);

  // Fetch sheet status and account list on mount
  const checkStatus = useCallback(async () => {
    setIsCheckingSheet(true);
    try {
      const status = await fetchSheetStatus();
      setSheetStatus(status);
      if (status.connected) {
        const accounts = await fetchSheetAccounts();
        setSheetAccounts(accounts);
      }
    } catch {
      // Ignore initial check errors
    } finally {
      setIsCheckingSheet(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync sheet cache
  const handleSyncSheet = async () => {
    setIsSyncingSheet(true);
    setFetchError(null);
    try {
      const res = await refreshSheetData();
      setSheetStatus(res.status);
      const accounts = await fetchSheetAccounts();
      setSheetAccounts(accounts);
    } catch (err: any) {
      setFetchError(err.message || 'Failed to sync sheet.');
    } finally {
      setIsSyncingSheet(false);
    }
  };

  // Disconnect Google Sheet
  const handleDisconnectSheet = async () => {
    if (!confirm('Are you sure you want to disconnect this Google Sheet? Saved connection and cached accounts will be removed.')) {
      return;
    }
    try {
      const res = await disconnectSheetConfig();
      setSheetStatus(res.status);
      setSheetAccounts([]);
      setFetchError(null);
    } catch (err: any) {
      setFetchError(err.message || 'Failed to disconnect sheet.');
    }
  };

  // Dynamic autocomplete search query for sheets with up to 100,000+ records
  useEffect(() => {
    const clean = searchInput.trim();
    if (!clean || !sheetStatus?.connected) return;
    const isMulti = clean.includes(',') || clean.includes('\n') || clean.split(/\s+/).length > 1;
    if (isMulti) return;

    const timer = setTimeout(async () => {
      try {
        const results = await fetchSheetAccounts(clean, 12);
        if (results && results.length > 0) {
          setSheetAccounts((prev) => {
            const map = new Map(prev.map((a) => [a.account, a]));
            results.forEach((r) => map.set(r.account, r));
            return Array.from(map.values());
          });
        }
      } catch {
        // Silently ignore autocomplete fetch error
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchInput, sheetStatus?.connected]);

  // Debounced preview call on relevant field changes
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!form.clientid && !form.location && form.commsgroupcode === 'CWSYM') return;
      setIsPreviewing(true);
      setPreviewError(null);
      try {
        const d = await previewDerived(form);
        setDerived(d);
      } catch (e: any) {
        setPreviewError(e.message);
      } finally {
        setIsPreviewing(false);
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.clientid,
    form.commsgroupcode,
    form.location,
    form.sub_branch,
    form.is_commodity,
    form.email,
    form.subgroupPrefix,
  ]);

  const set = useCallback(
    <K extends keyof OnboardingUserInput>(key: K, val: OnboardingUserInput[K]) => {
      setForm((f) => ({ ...f, [key]: val }));
    },
    [],
  );

  // Populate form from a selected person payload
  const populatePerson = (person: SheetPersonItem) => {
    setForm(person.input);
    setDerived(person.derived);
    setFetchError(null);
  };

  // Handle single account fetch
  const handleLookupSingle = async (accountCode: string) => {
    const clean = accountCode.trim().toUpperCase();
    if (!clean) return;

    setIsFetchingAccount(true);
    setFetchError(null);
    setShowDropdown(false);

    try {
      const rec = await fetchSheetAccount(clean);
      if (rec.is_joint && rec.persons.length >= 2) {
        setJointModalData({ account: clean, persons: rec.persons });
      } else if (rec.persons.length > 0) {
        populatePerson(rec.persons[0]);
      }
    } catch (err: any) {
      setFetchError(err.message || `Account ${clean} not found in sheet.`);
    } finally {
      setIsFetchingAccount(false);
    }
  };

  // Handle batch fetch
  const handleBatchAdd = async (rawInput: string) => {
    const tokens = rawInput
      .split(/[\s,;\n]+/)
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);

    if (!tokens.length) return;

    setIsFetchingAccount(true);
    setFetchError(null);

    try {
      const result = await batchFetchSheetAccounts(tokens);
      if (result.rows && result.rows.length > 0) {
        if (onBatchAdd) {
          onBatchAdd(result.rows.map((r) => ({ input: r.input, derived: r.derived })));
        } else {
          result.rows.forEach((r) => onAdd(r.input, r.derived));
        }
        setSearchInput('');
      }

      if (result.missing && result.missing.length > 0) {
        setFetchError(`Note: Accounts not found in sheet: ${result.missing.join(', ')}`);
      }
    } catch (err: any) {
      setFetchError(err.message || 'Batch fetch failed.');
    } finally {
      setIsFetchingAccount(false);
    }
  };

  // Detect whether search input is a batch list
  const isMultiInput = searchInput.includes(',') || searchInput.includes('\n') || (searchInput.trim().split(/\s+/).length > 1);

  // Filter accounts for autocomplete dropdown
  const filteredAccounts = searchInput.trim()
    ? sheetAccounts.filter(
        (a) =>
          a.account.toLowerCase().includes(searchInput.trim().toLowerCase()) ||
          a.name.toLowerCase().includes(searchInput.trim().toLowerCase()),
      ).slice(0, 8)
    : [];

  const handleAdd = async () => {
    if (!form.firstname || !form.lastname || !form.clientid || !form.email || !form.location) {
      return;
    }
    setIsSubmitting(true);
    try {
      let d = derived;
      if (!d) d = await previewDerived(form);
      onAdd(form, d);
      setForm(EMPTY_USER_INPUT);
      setDerived(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid =
    form.firstname.trim() &&
    form.lastname.trim() &&
    form.clientid.trim() &&
    form.email.trim() &&
    form.location;

  return (
    <div className="rounded-2xl border border-[var(--border-card)] bg-[var(--card-bg)] p-5 space-y-5">
      {/* ── Form Top Bar: Title & Mode Switcher ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--border-card)]">
        <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-[var(--accent-gold)]" />
          Add Person to Onboarding
        </h3>

        {/* Mode Switcher Tabs */}
        <div className="flex items-center gap-1 bg-[var(--canvas-bg)] p-1 rounded-xl border border-[var(--border-card)]">
          <button
            type="button"
            onClick={() => setMode('auto')}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer
              ${
                mode === 'auto'
                  ? 'bg-[var(--accent-gold)] text-black shadow-sm font-bold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }
            `}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Auto Fetch (Sheet)
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer
              ${
                mode === 'manual'
                  ? 'bg-[var(--accent-gold)] text-black shadow-sm font-bold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }
            `}
          >
            Manual Entry
          </button>
        </div>
      </div>

      {/* ── Auto Fetch Mode Section ── */}
      {mode === 'auto' && (
        <div className="rounded-xl border border-[var(--border-card)] bg-[var(--canvas-bg)]/80 p-4 space-y-4">
          {/* Sheet Connection Status Pill */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            {sheetStatus?.connected ? (
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[var(--text-main)] font-semibold flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  {sheetStatus.sheet_title || 'Google Sheet Connected'}
                </span>
                <span className="text-[var(--text-muted)] font-mono text-[11px]">
                  ({sheetStatus.row_count} accounts available)
                </span>
              </div>
            ) : sheetStatus?.configured ? (
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span className="font-semibold">Sheet Access Error</span>
                <span className="text-[var(--text-muted)] text-[11px] truncate max-w-xs">
                  {sheetStatus.error || 'Connection failed'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[var(--text-muted)]">
                <FileSpreadsheet className="w-4 h-4 opacity-50" />
                <span>No Google Sheet Connected. Connect to enable auto-fetch.</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              {sheetStatus?.connected && (
                <button
                  type="button"
                  onClick={handleSyncSheet}
                  disabled={isSyncingSheet}
                  className="flex items-center gap-1 text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--accent-gold)] transition-colors px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer"
                  title="Reload Google Sheet records"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncingSheet ? 'animate-spin' : ''}`} />
                  Sync
                </button>
              )}
              {sheetStatus?.configured && (
                <button
                  type="button"
                  onClick={handleDisconnectSheet}
                  className="flex items-center gap-1 text-[11px] font-semibold text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/10 cursor-pointer"
                  title="Remove saved Google Sheet configuration and clear cache"
                >
                  <Unlink className="w-3 h-3" />
                  Disconnect
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsChangeSheetOpen(true)}
                className="flex items-center gap-1 text-[11px] font-semibold text-[var(--accent-gold)] hover:brightness-110 underline decoration-dotted transition-colors px-1 py-0.5 cursor-pointer"
              >
                <Settings className="w-3 h-3" />
                {sheetStatus?.configured ? 'Change Sheet' : 'Connect Sheet'}
              </button>
            </div>
          </div>

          {/* If unconfigured, show connect action banner */}
          {!sheetStatus?.connected && (
            <div className="p-3.5 rounded-xl border border-dashed border-[var(--border-card)] bg-[var(--card-bg)] flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-[var(--text-main)]">
                  Connect your Google Sheet to auto-populate onboarding
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Enter your sheet link once. It will save to SQLite for daily use.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsChangeSheetOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[var(--accent-gold)] text-black hover:brightness-110 transition cursor-pointer"
              >
                Connect Google Sheet
              </button>
            </div>
          )}

          {/* Account Search / Batch Input */}
          {sheetStatus?.connected && (
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row gap-2" ref={searchBoxRef}>
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[var(--text-muted)]">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => {
                      setSearchInput(e.target.value);
                      setShowDropdown(true);
                      setFetchError(null);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (isMultiInput) {
                          handleBatchAdd(searchInput);
                        } else {
                          handleLookupSingle(searchInput);
                        }
                      }
                    }}
                    placeholder="Enter Account Number (e.g. AX0036) or comma-separated list..."
                    className="
                      w-full rounded-xl border border-[var(--border-card)] bg-[var(--input-bg)]
                      text-[var(--text-main)] text-sm pl-9 pr-3.5 py-2.5 font-mono uppercase
                      focus:outline-none focus:ring-2 focus:ring-[var(--accent-gold)]/50
                      placeholder:text-[var(--text-muted)] placeholder:opacity-50 placeholder:font-sans placeholder:normal-case
                    "
                  />

                  {/* Autocomplete Dropdown */}
                  {showDropdown && filteredAccounts.length > 0 && !isMultiInput && (
                    <div className="absolute z-20 mt-1 w-full rounded-xl border border-[var(--border-card)] bg-[var(--card-bg)] shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                      {filteredAccounts.map((item) => (
                        <button
                          key={item.account}
                          type="button"
                          onClick={() => {
                            setSearchInput(item.account);
                            handleLookupSingle(item.account);
                          }}
                          className="w-full text-left px-3.5 py-2 hover:bg-white/5 transition flex items-center justify-between text-xs border-b border-[var(--border-card)]/50 last:border-0 cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-[var(--accent-gold)]">
                              {item.account}
                            </span>
                            <span className="text-[var(--text-main)] truncate">{item.name}</span>
                            {item.is_joint && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
                                Joint
                              </span>
                            )}
                          </div>
                          <span className="text-[var(--text-muted)] text-[11px]">{item.branch}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action button */}
                {isMultiInput ? (
                  <button
                    type="button"
                    onClick={() => handleBatchAdd(searchInput)}
                    disabled={isFetchingAccount || !searchInput.trim()}
                    className="
                      flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold
                      bg-[var(--accent-gold)] text-black hover:brightness-110 disabled:opacity-40
                      transition-all cursor-pointer whitespace-nowrap
                    "
                  >
                    {isFetchingAccount ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Users className="w-3.5 h-3.5" />
                    )}
                    Batch Add All
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleLookupSingle(searchInput)}
                    disabled={isFetchingAccount || !searchInput.trim()}
                    className="
                      flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold
                      bg-[var(--accent-gold)] text-black hover:brightness-110 disabled:opacity-40
                      transition-all cursor-pointer whitespace-nowrap
                    "
                  >
                    {isFetchingAccount ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    Fetch & Fill Form
                  </button>
                )}
              </div>

              {/* Error notice */}
              {fetchError && (
                <p className="text-xs text-amber-400 flex items-center gap-1.5 pt-1">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  {fetchError}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Form Inputs ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Field label="First Name">
          <Input value={form.firstname} onChange={(v) => set('firstname', v)} placeholder="e.g. Rahul" />
        </Field>

        <Field label="Last Name">
          <Input value={form.lastname} onChange={(v) => set('lastname', v)} placeholder="e.g. Sharma" />
        </Field>

        <Field label="Client ID" hint="Max 13 characters">
          <Input
            value={form.clientid}
            onChange={(v) => set('clientid', v.toUpperCase())}
            placeholder="e.g. KT0012345"
            maxLength={13}
          />
        </Field>

        <Field label="Email">
          <Input
            type="email"
            value={form.email}
            onChange={(v) => set('email', v.toLowerCase())}
            placeholder="user@example.com"
          />
        </Field>

        <Field label="Comms Group Code">
          <div className="relative">
            <select
              value={form.commsgroupcode}
              onChange={(e) => set('commsgroupcode', e.target.value)}
              className="
                w-full appearance-none rounded-lg border border-[var(--border-card)]
                bg-[var(--input-bg)] text-[var(--text-main)] text-sm px-3 py-2 pr-8
                focus:outline-none focus:ring-2 focus:ring-[var(--accent-gold)]/50
              "
            >
              {!commsCodes.includes(form.commsgroupcode) && (
                <option value={form.commsgroupcode}>{form.commsgroupcode}</option>
              )}
              {commsCodes.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
          </div>
        </Field>

        <Field label="Location">
          <Select
            value={form.location}
            onChange={(v) => set('location', v as typeof form.location)}
            options={LOCATIONS}
            placeholder="Select location…"
          />
        </Field>

        <Field label="Subgroup Prefix" hint="Up to 8 digits (e.g. 20261007) — prepended to derived suffix">
          <Input
            value={form.subgroupPrefix}
            onChange={(v) => set('subgroupPrefix', v.replace(/\D/g, '').slice(0, 8))}
            placeholder="e.g. 20261007"
            maxLength={8}
          />
        </Field>

        {/* Sub-branch: only for Kolkata */}
        {form.location === 'Kolkata' && (
          <Field label="Sub Branch">
            <Select
              value={form.sub_branch}
              onChange={(v) => set('sub_branch', v as 'Senior' | 'Junior')}
              options={['Senior', 'Junior']}
              placeholder="Select…"
            />
          </Field>
        )}

        {/* Commodity: only for Gurgaon */}
        {form.location === 'Gurgaon' && (
          <Field label="Trades Commodities">
            <label className="flex items-center gap-2 text-sm text-[var(--text-main)] cursor-pointer select-none mt-2">
              <input
                type="checkbox"
                checked={form.is_commodity}
                onChange={(e) => set('is_commodity', e.target.checked)}
                className="w-4 h-4 accent-[var(--accent-gold)]"
              />
              Yes — commodity account
            </label>
          </Field>
        )}
      </div>

      {/* ── Derived preview ── */}
      <div className="rounded-xl border border-[var(--border-card)] bg-[var(--canvas-bg)] p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          {isPreviewing && <Loader2 className="w-3 h-3 animate-spin" />}
          Auto-derived fields
        </div>
        {previewError && (
          <p className="text-xs text-red-400">{previewError}</p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <DerivedBadge label="Client Group"     value={derived?.clientgroup ?? ''} />
          <DerivedBadge label="Client Subgroup"  value={derived?.clientsubgroup ?? ''} />
          <DerivedBadge label="Distributor"      value={derived?.distributor ?? ''} />
          <DerivedBadge label="Clearer Acct ID"  value={derived?.cleareraccountid ?? ''} />
          <DerivedBadge label="Account ID"       value={derived?.accountid ?? ''} />
          <DerivedBadge label="Account Map"      value={derived?.accountmap ?? ''} />
          <DerivedBadge label="Country Code"     value={derived?.clientcountrycode ?? 'IN'} />
          <DerivedBadge label="Base Currency"    value={derived?.basecurrency ?? 'USD'} />
        </div>
      </div>

      {/* ── Add button ── */}
      <div className="flex justify-end">
        <button
          onClick={handleAdd}
          disabled={!isValid || isSubmitting}
          className="
            flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold
            bg-[var(--accent-gold)] text-black
            disabled:opacity-40 disabled:cursor-not-allowed
            hover:brightness-110 transition-all cursor-pointer
          "
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <UserPlus className="w-4 h-4" />
          )}
          Add to list
        </button>
      </div>

      {/* ── Modals ── */}
      {isChangeSheetOpen && (
        <ChangeSheetModal
          isOpen={isChangeSheetOpen}
          onClose={() => setIsChangeSheetOpen(false)}
          currentStatus={sheetStatus}
          onSuccess={(newStatus) => {
            setSheetStatus(newStatus);
            fetchSheetAccounts().then(setSheetAccounts);
          }}
          onDisconnect={(newStatus) => {
            setSheetStatus(newStatus);
            setSheetAccounts([]);
          }}
        />
      )}

      {jointModalData && (
        <JointAccountModal
          isOpen={Boolean(jointModalData)}
          account={jointModalData.account}
          persons={jointModalData.persons}
          onSelectPerson={(chosenPerson) => {
            populatePerson(chosenPerson);
            setJointModalData(null);
          }}
          onSelectBoth={(bothPersons) => {
            if (onBatchAdd) {
              onBatchAdd(bothPersons.map((p) => ({ input: p.input, derived: p.derived })));
            } else {
              bothPersons.forEach((p) => onAdd(p.input, p.derived));
            }
            setForm(EMPTY_USER_INPUT);
            setDerived(null);
            setJointModalData(null);
          }}
          onClose={() => setJointModalData(null)}
        />
      )}
    </div>
  );
}
