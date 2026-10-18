'use client';

import React, { useState, useMemo } from 'react';
import { OnboardingRow } from '@/types/onboarding.types';
import { Trash2, Users, Pencil, Search, ChevronLeft, ChevronRight } from 'lucide-react';

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

const PAGE_SIZE = 50;

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
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const q = searchTerm.trim().toLowerCase();
    return rows.filter((r) => {
      const fn = (r.firstname || '').toLowerCase();
      const ln = (r.lastname || '').toLowerCase();
      const cid = (r.clientid || '').toLowerCase();
      const em = (r.email || '').toLowerCase();
      const loc = (r.location || '').toLowerCase();
      const cg = (r.derived?.clientgroup || '').toLowerCase();
      const csg = (r.derived?.clientsubgroup || '').toLowerCase();
      const dist = (r.derived?.distributor || '').toLowerCase();
      return (
        fn.includes(q) ||
        ln.includes(q) ||
        cid.includes(q) ||
        em.includes(q) ||
        loc.includes(q) ||
        cg.includes(q) ||
        csg.includes(q) ||
        dist.includes(q)
      );
    });
  }, [rows, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const displayedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, currentPage]);

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
      {/* ── Table Search Bar ── */}
      <div className="p-3 border-b border-[var(--border-card)] bg-[var(--canvas-bg)] flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder="Search drafted records..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[var(--border-card)] bg-[var(--input-bg)] text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-gold)]/50"
          />
        </div>

        {/* Quick Count Badge */}
        <div className="text-xs text-[var(--text-muted)] font-mono">
          {filteredRows.length !== rows.length ? (
            <span>
              Showing <strong className="text-[var(--text-main)]">{filteredRows.length}</strong> of{' '}
              {rows.length} records
            </span>
          ) : (
            <span>
              <strong className="text-[var(--text-main)]">{rows.length}</strong> drafted {rows.length === 1 ? 'person' : 'people'}
            </span>
          )}
        </div>
      </div>

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
            {displayedRows.map((row, idx) => {
              const globalIdx = (currentPage - 1) * PAGE_SIZE + idx + 1;
              return (
                <tr
                  key={row.id}
                  className="border-b border-[var(--border-card)]/50 hover:bg-[var(--canvas-bg)] transition-colors"
                >
                  <td className="px-3 py-2 text-[var(--text-muted)] tabular-nums">{globalIdx}</td>
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
              );
            })}
            {displayedRows.length === 0 && (
              <tr>
                <td colSpan={VISIBLE_COLS.length + 2} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  No records matching &quot;{searchTerm}&quot;
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer Pagination Controls ── */}
      <div className="px-4 py-2.5 border-t border-[var(--border-card)] flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-muted)] bg-[var(--card-bg)]">
        <div>
          Page {currentPage} of {totalPages} ({filteredRows.length} total)
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1 rounded-md border border-[var(--border-card)] hover:bg-white/5 text-[var(--text-muted)] hover:text-[var(--text-main)] disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
              title="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-[var(--input-bg)] border border-[var(--border-card)]">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1 rounded-md border border-[var(--border-card)] hover:bg-white/5 text-[var(--text-muted)] hover:text-[var(--text-main)] disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
              title="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
