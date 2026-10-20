'use client';

import React from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

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

export function DataTable<T>({
  columns,
  data,
  emptyMessage = 'No records found.',
  maxHeight = '500px',
  className = '',
}: DataTableProps<T>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card shadow-xs overflow-hidden',
        className
      )}
    >
      <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight }}>
        <Table>
          <TableHeader className="sticky top-0 z-10 select-none bg-muted/90 backdrop-blur-xs">
            <TableRow className="border-b border-border hover:bg-transparent">
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  style={{ width: col.width }}
                  className={cn(
                    'py-3 px-3.5 font-bold uppercase tracking-wider text-[11px] text-muted-foreground',
                    col.align === 'center'
                      ? 'text-center'
                      : col.align === 'right'
                      ? 'text-right'
                      : 'text-left'
                  )}
                >
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border/60">
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-12 text-center text-xs text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, idx) => (
                <TableRow
                  key={idx}
                  className="hover:bg-primary/5 transition-colors group cursor-default"
                >
                  {columns.map((col) => {
                    const content = col.render
                      ? col.render(row, idx)
                      : (row as Record<string, any>)[col.key] ?? '—';
                    return (
                      <TableCell
                        key={col.key}
                        className={cn(
                          'py-2.5 px-3.5 whitespace-nowrap text-foreground',
                          col.align === 'center'
                            ? 'text-center'
                            : col.align === 'right'
                            ? 'text-right'
                            : 'text-left'
                        )}
                      >
                        {content}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
