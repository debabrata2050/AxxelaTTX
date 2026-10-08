'use client';

import React, { useState } from 'react';
import { useOnboardingStore } from '@/store/useOnboardingStore';
import { OnboardingForm } from './OnboardingForm';
import { OnboardingTable } from './OnboardingTable';
import { EditRecordModal } from './EditRecordModal';
import { OnboardingUserInput, OnboardingDerived, OnboardingRow } from '@/types/onboarding.types';
import { Download, Trash2, Loader2, AlertCircle, Settings2, X, Plus, Pencil, Check } from 'lucide-react';
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

export function ConfigModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'clientgroups' | 'brokers' | 'subgroups' | 'comms'>('clientgroups');
  const [cgRules, setCgRules] = React.useState<ClientgroupRule[]>([]);
  const [brokerRules, setBrokerRules] = React.useState<BrokerRule[]>([]);
  const [subRules, setSubRules] = React.useState<SubgroupSuffix[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Store comms codes
  const { commsCodes, addCommsCode, updateCommsCode, removeCommsCode } = useOnboardingStore();
  const [newCommsCode, setNewCommsCode] = useState('');
  const [editingCommsCode, setEditingCommsCode] = useState<string | null>(null);
  const [editingCommsVal, setEditingCommsVal] = useState<string>('');

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
    `px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
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

  const handleEditCg = async (id: number, vals: Record<string, string>) => {
    setSaving(true);
    await saveClientgroupRule({
      id,
      clientgroup: vals.clientgroup,
      comms_code: vals.comms_code || null,
      location: vals.location || null,
      sub_branch: vals.sub_branch || null,
      is_commodity: vals.is_commodity !== '' && vals.is_commodity !== null && vals.is_commodity !== undefined ? Number(vals.is_commodity) : null,
      priority: Number(vals.priority) || 0,
    });
    setSaving(false);
    reload();
  };

  const handleEditBroker = async (id: number, vals: Record<string, string>) => {
    setSaving(true);
    await saveBrokerRule({
      id,
      prefix: vals.prefix,
      distributor: vals.distributor,
      clearer_template: vals.clearer_template,
    });
    setSaving(false);
    reload();
  };

  const handleEditSubgroup = async (id: number, vals: Record<string, string>) => {
    setSaving(true);
    await saveSubgroupSuffix({
      id,
      clientgroup: vals.clientgroup,
      suffix: vals.suffix,
    });
    setSaving(false);
    reload();
  };

  const handleAddComms = () => {
    const normalized = newCommsCode.trim().toUpperCase();
    if (normalized) {
      addCommsCode(normalized);
      setNewCommsCode('');
    }
  };

  const handleSaveEditComms = () => {
    if (editingCommsCode && editingCommsVal.trim()) {
      updateCommsCode(editingCommsCode, editingCommsVal.trim());
      setEditingCommsCode(null);
      setEditingCommsVal('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--card-bg)] border border-[var(--border-card)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-card)]">
          <h2 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-[var(--accent-gold)]" />
            Onboarding Config
          </h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-5 pt-3 flex-wrap">
          <button className={TAB_CLS(tab === 'clientgroups')} onClick={() => setTab('clientgroups')}>Client Groups</button>
          <button className={TAB_CLS(tab === 'brokers')} onClick={() => setTab('brokers')}>Brokers</button>
          <button className={TAB_CLS(tab === 'subgroups')} onClick={() => setTab('subgroups')}>Subgroup Suffixes</button>
          <button className={TAB_CLS(tab === 'comms')} onClick={() => setTab('comms')}>Comms Codes</button>
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
                    onSaveEdit={handleEditCg}
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
                    onSaveEdit={handleEditBroker}
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
                    onSaveEdit={handleEditSubgroup}
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
              {tab === 'comms' && (
                <div className="space-y-4">
                  <div className="overflow-x-auto rounded-xl border border-[var(--border-card)]">
                    <table className="w-full text-xs">
                      <thead className="bg-[var(--canvas-bg)]">
                        <tr>
                          <th className="px-3 py-2 text-left text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                            Comms Group Code
                          </th>
                          <th className="px-3 py-2 text-left text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                            Classification
                          </th>
                          <th className="px-3 py-2 w-16" />
                        </tr>
                      </thead>
                      <tbody>
                        {commsCodes.map((code) => {
                          const isDefault = code === 'CWSYM' || code === 'ALGO';
                          const isEditing = editingCommsCode === code;
                          return (
                            <tr key={code} className="border-t border-[var(--border-card)]/50">
                              <td className="px-3 py-2 text-[var(--text-main)] font-mono font-semibold">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editingCommsVal}
                                    onChange={(e) => setEditingCommsVal(e.target.value.toUpperCase())}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveEditComms();
                                      if (e.key === 'Escape') setEditingCommsCode(null);
                                    }}
                                    className="rounded border border-[var(--border-card)] bg-[var(--input-bg)] px-2 py-1 text-xs text-[var(--text-main)] uppercase font-mono w-full min-w-[100px] focus:outline-none focus:ring-1 focus:ring-[var(--accent-gold)]"
                                    autoFocus
                                  />
                                ) : (
                                  code
                                )}
                              </td>
                              <td className="px-3 py-2 text-[var(--text-muted)] font-mono text-[11px]">
                                {isDefault ? 'Standard Default' : 'Custom Configured'}
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1 justify-end">
                                  {isEditing ? (
                                    <>
                                      <button
                                        onClick={handleSaveEditComms}
                                        className="p-1 rounded bg-[var(--accent-gold)] text-black hover:brightness-110 transition cursor-pointer"
                                        title="Save changes"
                                      >
                                        <Check className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => setEditingCommsCode(null)}
                                        className="p-1 rounded hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-main)] transition cursor-pointer"
                                        title="Cancel"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => {
                                          setEditingCommsCode(code);
                                          setEditingCommsVal(code);
                                        }}
                                        className="p-1 rounded hover:bg-[var(--accent-gold)]/10 text-[var(--text-muted)] hover:text-[var(--accent-gold)] transition-colors cursor-pointer"
                                        title={`Edit ${code}`}
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </button>
                                      {!isDefault ? (
                                        <button
                                          onClick={() => removeCommsCode(code)}
                                          className="p-1 rounded hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-colors cursor-pointer"
                                          title={`Delete ${code}`}
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      ) : null}
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Add Comms Code form */}
                  <div className="flex items-end gap-2 pt-3 border-t border-[var(--border-card)] mt-3">
                    <div className="flex flex-col gap-0.5 flex-1 min-w-[140px]">
                      <label className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                        New Comms Group Code
                      </label>
                      <input
                        type="text"
                        value={newCommsCode}
                        placeholder="e.g. DMA, MANUAL, FIX..."
                        onChange={(e) => setNewCommsCode(e.target.value.toUpperCase())}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddComms();
                          }
                        }}
                        className="
                          rounded-lg border border-[var(--border-card)] bg-[var(--input-bg)]
                          text-[var(--text-main)] text-xs px-2.5 py-1.5 uppercase font-mono
                          focus:outline-none focus:ring-1 focus:ring-[var(--accent-gold)]/50
                          placeholder:text-[var(--text-muted)] placeholder:opacity-50
                        "
                      />
                    </div>
                    <button
                      onClick={handleAddComms}
                      disabled={!newCommsCode.trim()}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--accent-gold)] text-black disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all self-end cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </button>
                  </div>
                </div>
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
  onSaveEdit,
}: {
  cols: string[];
  rows: Record<string, any>[];
  onDelete: (id: number) => void;
  onSaveEdit?: (id: number, vals: Record<string, string>) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editVals, setEditVals] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);

  const startEdit = (row: Record<string, any>) => {
    setEditingId(row.id);
    const initial: Record<string, string> = {};
    cols.forEach((c) => {
      initial[c] = row[c] === null || row[c] === undefined ? '' : String(row[c]);
    });
    setEditVals(initial);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditVals({});
  };

  const handleSave = async (id: number) => {
    if (!onSaveEdit) return;
    setSavingEdit(true);
    try {
      await onSaveEdit(id, editVals);
      setEditingId(null);
      setEditVals({});
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border-card)]">
      <table className="w-full text-xs">
        <thead className="bg-[var(--canvas-bg)]">
          <tr>
            {cols.map((c) => (
              <th key={c} className="px-3 py-2 text-left text-[var(--text-muted)] font-semibold uppercase tracking-wider whitespace-nowrap">
                {c.replace('_', ' ')}
              </th>
            ))}
            <th className="px-3 py-2 w-16" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isEditing = row.id === editingId;
            return (
              <tr key={row.id} className="border-t border-[var(--border-card)]/50 hover:bg-white/[0.02]">
                {cols.map((c) => (
                  <td key={c} className="px-3 py-2 text-[var(--text-main)] font-mono whitespace-nowrap">
                    {isEditing ? (
                      <input
                        type={c === 'priority' ? 'number' : 'text'}
                        value={editVals[c] ?? ''}
                        onChange={(e) => setEditVals((prev) => ({ ...prev, [c]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSave(row.id);
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        className="rounded border border-[var(--border-card)] bg-[var(--input-bg)] px-2 py-1 text-xs text-[var(--text-main)] w-full min-w-[70px] focus:outline-none focus:ring-1 focus:ring-[var(--accent-gold)]"
                      />
                    ) : (
                      row[c] === null || row[c] === undefined ? <span className="opacity-30">null</span> : String(row[c])
                    )}
                  </td>
                ))}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1 justify-end">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => handleSave(row.id)}
                          disabled={savingEdit}
                          className="p-1 rounded bg-[var(--accent-gold)] text-black hover:brightness-110 transition cursor-pointer"
                          title="Save changes"
                        >
                          {savingEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={savingEdit}
                          className="p-1 rounded hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-main)] transition cursor-pointer"
                          title="Cancel"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <>
                        {onSaveEdit && (
                          <button
                            onClick={() => startEdit(row)}
                            className="p-1 rounded hover:bg-[var(--accent-gold)]/10 text-[var(--text-muted)] hover:text-[var(--accent-gold)] transition-colors cursor-pointer"
                            title="Edit row"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={() => onDelete(row.id)}
                          className="p-1 rounded hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-colors cursor-pointer"
                          title="Delete row"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   Main Onboarding Tab
   ────────────────────────────────────────────────────────────────────────────── */

export function OnboardingTab() {
  const { rows, addRow, updateRow, removeRow, clearAll, exportExcel, isExporting, exportError } =
    useOnboardingStore();
  const [showConfig, setShowConfig] = useState(false);
  const [editingRow, setEditingRow] = useState<OnboardingRow | null>(null);
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
            onClick={() => setShowConfig(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-card)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--accent-gold)]/50 transition-colors cursor-pointer"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Config
          </button>

          {rows.length > 0 && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-card)] text-[var(--text-muted)] hover:text-red-400 hover:border-red-400/40 transition-colors cursor-pointer"
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
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold bg-[var(--accent-gold)] text-black disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all cursor-pointer"
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

      {/* ── Table with Edit and Delete ── */}
      <OnboardingTable
        rows={rows}
        onRemove={removeRow}
        onEdit={(row) => setEditingRow(row)}
      />

      {/* ── Edit Record Modal ── */}
      <EditRecordModal
        row={editingRow}
        isOpen={Boolean(editingRow)}
        onClose={() => setEditingRow(null)}
        onSave={(id, input, derived) => updateRow(id, input, derived)}
      />

      {/* ── Config modal ── */}
      {showConfig && <ConfigModal onClose={() => setShowConfig(false)} />}
    </div>
  );
}

// Backward-compatible alias for any external consumers
export const RulesModal = ConfigModal;
