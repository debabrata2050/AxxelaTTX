'use client';

import React, { useState } from 'react';
import { useOnboardingStore } from '@/store/useOnboardingStore';
import { OnboardingForm } from './OnboardingForm';
import { OnboardingTable } from './OnboardingTable';
import { OnboardingUserInput, OnboardingDerived } from '@/types/onboarding.types';
import { Download, Trash2, Loader2, AlertCircle, Settings2, X } from 'lucide-react';
import {
  fetchClientgroupRules, deleteClientgroupRule, saveClientgroupRule,
  fetchBrokerRules,      deleteBrokerRule,      saveBrokerRule,
  fetchSubgroupSuffixes, deleteSubgroupSuffix,  saveSubgroupSuffix,
} from '@/lib/onboardingClient';
import { ClientgroupRule, BrokerRule, SubgroupSuffix } from '@/types/onboarding.types';

/* ──────────────────────────────────────────────────────────────────────────────
   Tiny Admin Rules Modal – view / add / delete lookup table rows
   ────────────────────────────────────────────────────────────────────────────── */

function AddRowForm({
  fields,
  onSave,
  saving,
}: {
  fields: { key: string; label: string; type?: string; placeholder?: string }[];
  onSave: (vals: Record<string, string>) => Promise<void>;
  saving: boolean;
}) {
  const [vals, setVals] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, ''])),
  );

  const handleSave = async () => {
    await onSave(vals);
    setVals(Object.fromEntries(fields.map((f) => [f.key, ''])));
  };

  return (
    <div className="flex flex-wrap items-end gap-2 pt-3 border-t border-[var(--border-card)] mt-3">
      {fields.map((f) => (
        <div key={f.key} className="flex flex-col gap-0.5 flex-1 min-w-[90px]">
          <label className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            {f.label}
          </label>
          <input
            type={f.type || 'text'}
            value={vals[f.key] ?? ''}
            placeholder={f.placeholder}
            onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))}
            className="
              rounded-lg border border-[var(--border-card)] bg-[var(--input-bg)]
              text-[var(--text-main)] text-xs px-2 py-1.5
              focus:outline-none focus:ring-1 focus:ring-[var(--accent-gold)]/50
              placeholder:text-[var(--text-muted)] placeholder:opacity-50
            "
          />
        </div>
      ))}
      <button
        onClick={handleSave}
        disabled={saving || fields.some((f) => !vals[f.key]?.trim())}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--accent-gold)] text-black disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all self-end"
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : '+'}
        Add
      </button>
    </div>
  );
}

function RulesModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'clientgroups' | 'brokers' | 'subgroups'>('clientgroups');
  const [cgRules, setCgRules] = React.useState<ClientgroupRule[]>([]);
  const [brokerRules, setBrokerRules] = React.useState<BrokerRule[]>([]);
  const [subRules, setSubRules] = React.useState<SubgroupSuffix[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const reload = React.useCallback(async () => {
    setLoading(true);
    const [cg, br, sub] = await Promise.all([
      fetchClientgroupRules(),
      fetchBrokerRules(),
      fetchSubgroupSuffixes(),
    ]);
    setCgRules(cg);
    setBrokerRules(br);
    setSubRules(sub);
    setLoading(false);
  }, []);

  React.useEffect(() => { reload(); }, [reload]);

  const TAB_CLS = (active: boolean) =>
    `px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
      active
        ? 'bg-[var(--accent-gold)] text-black'
        : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
    }`;

  const handleAddCg = async (vals: Record<string, string>) => {
    setSaving(true);
    await saveClientgroupRule({
      clientgroup: vals.clientgroup,
      comms_code: vals.comms_code || null,
      location: vals.location || null,
      sub_branch: vals.sub_branch || null,
      is_commodity: vals.is_commodity !== '' ? Number(vals.is_commodity) : null,
      priority: Number(vals.priority) || 0,
    });
    setSaving(false);
    reload();
  };

  const handleAddBroker = async (vals: Record<string, string>) => {
    setSaving(true);
    await saveBrokerRule({
      prefix: vals.prefix,
      distributor: vals.distributor,
      clearer_template: vals.clearer_template,
    });
    setSaving(false);
    reload();
  };

  const handleAddSubgroup = async (vals: Record<string, string>) => {
    setSaving(true);
    await saveSubgroupSuffix({ clientgroup: vals.clientgroup, suffix: vals.suffix });
    setSaving(false);
    reload();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--card-bg)] border border-[var(--border-card)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-card)]">
          <h2 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-[var(--accent-gold)]" />
            Onboarding Rules (SQLite)
          </h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-5 pt-3">
          <button className={TAB_CLS(tab === 'clientgroups')} onClick={() => setTab('clientgroups')}>Client Groups</button>
          <button className={TAB_CLS(tab === 'brokers')} onClick={() => setTab('brokers')}>Brokers</button>
          <button className={TAB_CLS(tab === 'subgroups')} onClick={() => setTab('subgroups')}>Subgroup Suffixes</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--accent-gold)]" />
            </div>
          ) : (
            <>
              {tab === 'clientgroups' && (
                <>
                  <RulesTable
                    cols={['comms_code', 'location', 'sub_branch', 'is_commodity', 'clientgroup', 'priority']}
                    rows={cgRules}
                    onDelete={async (id) => { await deleteClientgroupRule(id); reload(); }}
                  />
                  <AddRowForm
                    saving={saving}
                    onSave={handleAddCg}
                    fields={[
                      { key: 'clientgroup',  label: 'Client Group',  placeholder: 'e.g. KOLSR' },
                      { key: 'comms_code',   label: 'Comms Code',    placeholder: 'ALGO or blank' },
                      { key: 'location',     label: 'Location',      placeholder: 'Kolkata…' },
                      { key: 'sub_branch',   label: 'Sub Branch',    placeholder: 'Senior / blank' },
                      { key: 'is_commodity', label: 'Commodity',     placeholder: '1/0/blank' },
                      { key: 'priority',     label: 'Priority',      placeholder: '0', type: 'number' },
                    ]}
                  />
                </>
              )}
              {tab === 'brokers' && (
                <>
                  <RulesTable
                    cols={['prefix', 'distributor', 'clearer_template']}
                    rows={brokerRules}
                    onDelete={async (id) => { await deleteBrokerRule(id); reload(); }}
                  />
                  <AddRowForm
                    saving={saving}
                    onSave={handleAddBroker}
                    fields={[
                      { key: 'prefix',           label: 'Prefix',          placeholder: 'e.g. KT' },
                      { key: 'distributor',       label: 'Distributor',     placeholder: 'e.g. KGI' },
                      { key: 'clearer_template',  label: 'Clearer Template', placeholder: 'CLR KGI SYM' },
                    ]}
                  />
                </>
              )}
              {tab === 'subgroups' && (
                <>
                  <RulesTable
                    cols={['clientgroup', 'suffix']}
                    rows={subRules}
                    onDelete={async (id) => { await deleteSubgroupSuffix(id); reload(); }}
                  />
                  <AddRowForm
                    saving={saving}
                    onSave={handleAddSubgroup}
                    fields={[
                      { key: 'clientgroup', label: 'Client Group', placeholder: 'e.g. BAN' },
                      { key: 'suffix',      label: 'Suffix',       placeholder: 'e.g. BLORE' },
                    ]}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function RulesTable({
  cols,
  rows,
  onDelete,
}: {
  cols: string[];
  rows: Record<string, any>[];
  onDelete: (id: number) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border-card)]">
      <table className="w-full text-xs">
        <thead className="bg-[var(--canvas-bg)]">
          <tr>
            {cols.map((c) => (
              <th key={c} className="px-3 py-2 text-left text-[var(--text-muted)] font-semibold uppercase tracking-wider whitespace-nowrap">
                {c}
              </th>
            ))}
            <th className="px-3 py-2 w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-[var(--border-card)]/50">
              {cols.map((c) => (
                <td key={c} className="px-3 py-2 text-[var(--text-main)] font-mono whitespace-nowrap">
                  {row[c] === null || row[c] === undefined ? <span className="opacity-30">null</span> : String(row[c])}
                </td>
              ))}
              <td className="px-3 py-2">
                <button
                  onClick={() => onDelete(row.id)}
                  className="p-1 rounded hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   Main Onboarding Tab
   ────────────────────────────────────────────────────────────────────────────── */

export function OnboardingTab() {
  const { rows, addRow, removeRow, clearAll, exportExcel, isExporting, exportError } =
    useOnboardingStore();
  const [showRules, setShowRules] = useState(false);
  const [filename, setFilename] = useState('Onboarding');

  const handleAdd = (input: OnboardingUserInput, derived: OnboardingDerived) => {
    addRow(input, derived);
  };

  return (
    <div className="space-y-6">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-main)]">People Onboarding</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Add people, review derived fields, then export to Excel.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowRules(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-card)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--accent-gold)]/50 transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Rules
          </button>

          {rows.length > 0 && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-card)] text-[var(--text-muted)] hover:text-red-400 hover:border-red-400/40 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear all
            </button>
          )}

          <div className="flex items-center gap-1 rounded-lg border border-[var(--border-card)] bg-[var(--input-bg)] px-2">
            <input
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="bg-transparent text-xs text-[var(--text-main)] focus:outline-none w-36 py-1.5"
              placeholder="Filename"
            />
            <span className="text-[var(--text-muted)] text-xs opacity-50">.xlsx</span>
          </div>

          <button
            onClick={() => exportExcel(`${filename}.xlsx`)}
            disabled={!rows.length || isExporting}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold bg-[var(--accent-gold)] text-black disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all"
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Export Excel
          </button>
        </div>
      </div>

      {/* Export error */}
      {exportError && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {exportError}
        </div>
      )}

      {/* ── Form ── */}
      <OnboardingForm onAdd={handleAdd} />

      {/* ── Table ── */}
      <OnboardingTable rows={rows} onRemove={removeRow} />

      {/* ── Rules modal ── */}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
}
