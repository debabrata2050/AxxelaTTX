'use client';

import React, { useEffect, useState } from 'react';
import { useKGIStore, KGIPreviewRow } from '@/store/useKGIStore';
import { DataTable, ColumnDef } from '@/components/ui/DataTable';
import {
  Download,
  ArrowLeft,
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Building2,
  MessageSquare,
} from 'lucide-react';

export const KGIStep4Export: React.FC = () => {
  const previewRows = useKGIStore((s) => s.previewRows);
  const isPreviewLoading = useKGIStore((s) => s.isPreviewLoading);
  const isExporting = useKGIStore((s) => s.isExporting);
  const exportFilename = useKGIStore((s) => s.exportFilename);
  const fetchPreview = useKGIStore((s) => s.fetchPreview);
  const exportExcel = useKGIStore((s) => s.exportExcel);
  const setStep = useKGIStore((s) => s.setStep);
  const selectedContracts = useKGIStore((s) => s.selectedContracts);
  const summary = useKGIStore((s) => s.summary);
  const updateRowComment = useKGIStore((s) => s.updateRowComment);
  const setBulkComment = useKGIStore((s) => s.setBulkComment);

  const [bulkCommentText, setBulkCommentText] = useState('');

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  const columns: ColumnDef<KGIPreviewRow>[] = [
    { key: 'sl_no', header: 'Sl.No.', align: 'center', width: '70px' },
    { key: 'from_account', header: 'FROM', align: 'center', width: '110px' },
    {
      key: 'to_account',
      header: 'TO',
      align: 'center',
      width: '100px',
      render: (r) => (
        <span className="font-bold text-sky-400">{r.to_account}</span>
      ),
    },
    { key: 'instr', header: 'Instr.', align: 'center', width: '80px' },
    { key: 'instr_desp', header: 'Instr.Desp', align: 'left', width: '110px' },
    {
      key: 'buy_sell',
      header: 'Buy/Sell',
      align: 'center',
      width: '90px',
      render: (r) => (
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
            r.buy_sell === 'B' || r.buy_sell === 'Buy'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
          }`}
        >
          {r.buy_sell === 'B' ? 'Buy' : r.buy_sell === 'S' ? 'Sell' : r.buy_sell}
        </span>
      ),
    },
    {
      key: 'lots',
      header: 'Lots',
      align: 'right',
      width: '80px',
      render: (r) => <span className="font-bold font-mono">{r.lots.toLocaleString()}</span>,
    },
    {
      key: 'cp',
      header: 'C/P',
      align: 'center',
      width: '70px',
      render: (r) =>
        r.cp ? (
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
              r.cp === 'C'
                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                : 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
            }`}
          >
            {r.cp}
          </span>
        ) : (
          <span className="text-[var(--text-muted)] opacity-40 font-mono">—</span>
        ),
    },
    {
      key: 'strike',
      header: 'Strike',
      align: 'right',
      width: '90px',
      render: (r) =>
        r.strike !== undefined && r.strike !== null ? (
          <span className="font-mono text-[var(--text-main)] font-semibold">{r.strike}</span>
        ) : (
          <span className="text-[var(--text-muted)] opacity-40 font-mono">—</span>
        ),
    },
    {
      key: 'price',
      header: 'Price',
      align: 'right',
      width: '110px',
      render: (r) => (
        <span className="font-mono text-[var(--text-main)]">
          {typeof r.price === 'number'
            ? r.price.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4,
              })
            : r.price}
        </span>
      ),
    },
    { key: 'date', header: 'Date', align: 'center', width: '110px' },
    {
      key: 'comments',
      header: 'Comments',
      align: 'left',
      width: '180px',
      render: (r) => (
        <input
          type="text"
          value={r.comments || ''}
          placeholder="Add comment..."
          onChange={(e) => updateRowComment(r.sl_no, e.target.value)}
          className="w-full px-2 py-1 rounded bg-[var(--input-bg)] border border-[var(--border-card)] text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)]/50 focus:outline-none focus:border-sky-400 font-mono"
        />
      ),
    },
  ];

  if (!summary) return null;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* ── Top Bar with Bulk Comment Toolbar and Export ── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-card)] shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[var(--border-card)] pb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-sky-500/10 text-sky-400 text-xs font-mono font-bold flex items-center justify-center">
              4
            </span>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wider font-mono">
                Step 4: Review Trade Transfer Form & Export
              </h3>
              <p className="text-[11px] text-[var(--text-muted)] font-mono">
                Layout: Excel starting directly at cell A1 with zero margins.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchPreview()}
              disabled={isPreviewLoading}
              className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium text-[var(--text-muted)] hover:text-white bg-white/5 border border-[var(--border-card)] transition flex items-center gap-1.5 cursor-pointer"
              title="Refresh mapped rows"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPreviewLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={exportExcel}
              disabled={isExporting || previewRows.length === 0}
              className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-black font-semibold text-xs transition flex items-center gap-2 cursor-pointer shadow-md"
            >
              <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
              <span>{isExporting ? 'Exporting...' : 'Export Excel (.xlsx)'}</span>
            </button>
          </div>
        </div>

        {/* Bulk Comment Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
          <div className="relative flex-1">
            <MessageSquare className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Type comment to apply to all rows (or edit row-by-row in table below)..."
              value={bulkCommentText}
              onChange={(e) => setBulkCommentText(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-[var(--input-bg)] border border-[var(--border-card)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-sky-400 font-mono"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              if (bulkCommentText.trim()) {
                setBulkComment(bulkCommentText.trim());
              }
            }}
            disabled={!bulkCommentText.trim() || previewRows.length === 0}
            className="px-4 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-400 font-mono font-semibold text-xs transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
          >
            Apply to All Rows
          </button>
        </div>
      </div>

      {/* ── Preview Data Table ── */}
      <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-card)] shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-sky-400" />
            <h4 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider font-mono">
              Consolidated Positions ({previewRows.length} rows)
            </h4>
          </div>
          <span className="text-[11px] font-mono text-[var(--text-muted)]">
            Target File: <strong className="text-[var(--text-main)]">{exportFilename}</strong>
          </span>
        </div>

        {isPreviewLoading ? (
          <div className="p-12 text-center text-xs font-mono text-[var(--text-muted)]">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-400" />
            Generating preview...
          </div>
        ) : (
          <DataTable
            data={previewRows}
            columns={columns}
            emptyMessage={
              isPreviewLoading
                ? 'Loading mapped preview...'
                : 'No net-zero position rows match current selection.'
            }
            maxHeight="520px"
          />
        )}
      </div>

      {/* ── Navigation Footer ── */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => setStep(3)}
          className="px-4 py-2.5 rounded-xl bg-[var(--input-bg)] hover:bg-white/5 border border-[var(--border-card)] text-xs font-mono font-medium text-[var(--text-muted)] hover:text-white transition flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Audit</span>
        </button>

        <button
          type="button"
          onClick={exportExcel}
          disabled={isExporting || previewRows.length === 0}
          className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-black font-semibold text-xs transition flex items-center gap-2 cursor-pointer shadow-md"
        >
          <Download className="w-4 h-4" />
          <span>Download Trade Transfer Form</span>
        </button>
      </div>
    </div>
  );
};
