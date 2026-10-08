'use client';

import React from 'react';
import { OnboardingRow } from '@/types/onboarding.types';
import { Trash2, Users, Pencil } from 'lucide-react';

interface Props {
  rows: OnboardingRow[];
  onRemove: (id: string) => void;
  onEdit?: (row: OnboardingRow) => void;
}

const VISIBLE_COLS: { key: keyof OnboardingRow | `derived.${string}`; label: string }[] = [
  { key: 'firstname',              label: 'First Name' },
  { key: 'lastname',               label: 'Last Name' },
  { key: 'clientid',               label: 'Client ID' },
  { key: 'email',                  label: 'Email' },
  { key: 'commsgroupcode',         label: 'Comms' },
  { key: 'location',               label: 'Location' },
  { key: 'derived.clientgroup',    label: 'Client Group' },
  { key: 'derived.clientsubgroup', label: 'Subgroup' },
  { key: 'derived.distributor',    label: 'Distributor' },
  { key: 'derived.cleareraccountid', label: 'Clearer Acct' },
];

function getCellValue(row: OnboardingRow, key: string): string {
  if (key.startsWith('derived.')) {
    const dk = key.replace('derived.', '') as keyof OnboardingRow['derived'];
    return String(row.derived?.[dk] ?? '');
  }
  const val = row[key as keyof OnboardingRow];
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val ?? '');
}

export function OnboardingTable({ rows, onRemove, onEdit }: Props) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border-card)] bg-[var(--card-bg)] py-12 flex flex-col items-center gap-3 text-[var(--text-muted)]">
        <Users className="w-8 h-8 opacity-30" />
        <p className="text-sm opacity-60">No people added yet — use the form above.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--border-card)] bg-[var(--card-bg)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--border-card)] bg-[var(--canvas-bg)]">
              <th className="px-3 py-2 text-left text-[var(--text-muted)] font-semibold uppercase tracking-wider w-8">
                #
              </th>
              {VISIBLE_COLS.map((c) => (
                <th
                  key={c.key}
                  className="px-3 py-2 text-left text-[var(--text-muted)] font-semibold uppercase tracking-wider whitespace-nowrap"
                >
                  {c.label}
                </th>
              ))}
              <th className="px-3 py-2 w-16" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.id}
                className="border-b border-[var(--border-card)]/50 hover:bg-[var(--canvas-bg)] transition-colors"
              >
                <td className="px-3 py-2 text-[var(--text-muted)] tabular-nums">{idx + 1}</td>
                {VISIBLE_COLS.map((c) => {
                  const val = getCellValue(row, c.key);
                  const isDerived = c.key.startsWith('derived.');
                  return (
                    <td key={c.key} className="px-3 py-2 whitespace-nowrap">
                      <span
                        className={
                          isDerived
                            ? 'font-mono text-[var(--accent-gold)] opacity-90'
                            : 'text-[var(--text-main)]'
                        }
                      >
                        {val || <span className="opacity-30">—</span>}
                      </span>
                    </td>
                  );
                })}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1 justify-end">
                    {onEdit && (
                      <button
                        onClick={() => onEdit(row)}
                        className="p-1.5 rounded-lg hover:bg-[var(--accent-gold)]/10 text-[var(--text-muted)] hover:text-[var(--accent-gold)] transition-colors cursor-pointer"
                        title="Edit record"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => onRemove(row.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-colors cursor-pointer"
                      title="Remove record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 border-t border-[var(--border-card)] text-xs text-[var(--text-muted)]">
        {rows.length} {rows.length === 1 ? 'person' : 'people'} added
      </div>
    </div>
  );
}
