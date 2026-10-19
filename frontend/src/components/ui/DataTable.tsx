'use client';

import React from 'react';

export interface ColumnDef<T> {
  key: string;
  header: string;
  render?: (item: T, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  emptyMessage?: string;
  maxHeight?: string;
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  emptyMessage = 'No records found.',
  maxHeight = '500px',
  className = '',
}: DataTableProps<T>) {
  return (
    <div
      className={`rounded-2xl border border-[var(--border-card)] bg-[var(--card-bg)] shadow-sm overflow-hidden ${className}`}
    >
      <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight }}>
        <table className="w-full text-xs font-mono border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-card)] bg-[var(--input-bg)] text-[var(--text-muted)] sticky top-0 z-10 select-none">
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className={`py-3 px-3.5 font-bold uppercase tracking-wider text-[11px] ${
                    col.align === 'center'
                      ? 'text-center'
                      : col.align === 'right'
                      ? 'text-right'
                      : 'text-left'
                  }`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-card)]">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-12 text-center text-xs text-[var(--text-muted)]"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-[var(--accent-gold)]/5 transition-colors group"
                >
                  {columns.map((col) => {
                    const content = col.render ? col.render(row, idx) : row[col.key] ?? '—';
                    return (
                      <td
                        key={col.key}
                        className={`py-2.5 px-3.5 whitespace-nowrap text-[var(--text-main)] ${
                          col.align === 'center'
                            ? 'text-center'
                            : col.align === 'right'
                            ? 'text-right'
                            : 'text-left'
                        }`}
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
