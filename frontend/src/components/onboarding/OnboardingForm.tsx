'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { OnboardingUserInput, OnboardingDerived, EMPTY_USER_INPUT } from '@/types/onboarding.types';
import { previewDerived } from '@/store/useOnboardingStore';
import { Loader2, UserPlus, ChevronDown } from 'lucide-react';

interface Props {
  onAdd: (input: OnboardingUserInput, derived: OnboardingDerived) => void;
}

const LOCATIONS = ['Kolkata', 'Gurgaon', 'Bengaluru', 'Mumbai'] as const;

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

export function OnboardingForm({ onAdd }: Props) {
  const [form, setForm] = useState<OnboardingUserInput>(EMPTY_USER_INPUT);
  const [derived, setDerived] = useState<OnboardingDerived | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
        <UserPlus className="w-4 h-4 text-[var(--accent-gold)]" />
        Add Person
      </h3>

      {/* ── User inputs ── */}
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
            onChange={(v) => set('clientid', v)}
            placeholder="e.g. KT0012345"
            maxLength={13}
          />
        </Field>

        <Field label="Email">
          <Input
            type="email"
            value={form.email}
            onChange={(v) => set('email', v)}
            placeholder="user@example.com"
          />
        </Field>

        <Field label="Comms Group Code">
          <Select
            value={form.commsgroupcode}
            onChange={(v) => set('commsgroupcode', v as 'CWSYM' | 'ALGO')}
            options={['CWSYM', 'ALGO']}
          />
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
            hover:brightness-110 transition-all
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
    </div>
  );
}
