'use client';

import React, { useEffect, useState } from 'react';
import { useStoneXStore, PreviewRow } from '@/store/useStoneXStore';
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

export const StoneXStep4Export: React.FC = () => {
  const previewRows = useStoneXStore((s) => s.previewRows);
  const isPreviewLoading = useStoneXStore((s) => s.isPreviewLoading);
  const isExporting = useStoneXStore((s) => s.isExporting);
  const exportFilename = useStoneXStore((s) => s.exportFilename);
  const fetchPreview = useStoneXStore((s) => s.fetchPreview);
  const exportExcel = useStoneXStore((s) => s.exportExcel);
  const setStep = useStoneXStore((s) => s.setStep);
  const selectedContracts = useStoneXStore((s) => s.selectedContracts);
  const summary = useStoneXStore((s) => s.summary);
  const updateRowComment = useStoneXStore((s) => s.updateRowComment);
  const setBulkComment = useStoneXStore((s) => s.setBulkComment);

  const [bulkCommentText, setBulkCommentText] = useState('');

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);
  const columns: ColumnDef<PreviewRow>[] = [
    { key: 'sl_no', header: 'Sl.No.', align: 'center', width: '70px' },
    { key: 'from_account', header: 'FROM', align: 'center', width: '110px' },
    {
      key: 'to_account',
      header: 'TO',
      align: 'center',
      width: '100px',
      render: (r) => (
        <span className="font-bold text-[var(--accent-gold)]">{r.to_account}</span>
      ),
    },
    { key: 'instr', header: 'Instr.', align: 'center', width: '80px' },
    { key: 'instr_desp', header: 'Instr.Desp', align: 'left' },
    {
      key: 'buy_sell',
      header: 'Buy/Sell',
      align: 'center',
      width: '90px',
      render: (r) => (
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
            r.buy_sell === 'Buy'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
          }`}
        >
          {r.buy_sell}
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
    { key: 'contract_month', header: 'Contract Month', align: 'center', width: '120px' },
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
        r.strike !== undefined && r.strike !== null && r.strike !== '' ? (
          <span className="font-mono font-medium">
            {typeof r.strike === 'number'
              ? r.strike.toLocaleString()
              : !isNaN(Number(r.strike))
              ? Number(r.strike).toLocaleString()
              : r.strike}
          </span>
        ) : (
          <span className="text-[var(--text-muted)] opacity-40 font-mono">—</span>
        ),
    },
    {
      key: 'price',
      header: 'Price',
      align: 'right',
      width: '100px',
      render: (r) => (
        <span className="font-mono">
          {Number(r.price).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      ),
    },
    { key: 'date', header: 'Date', align: 'center', width: '100px' },
    {
      key: 'comments',
      header: 'Comments',
      align: 'left',
      width: '200px',
      render: (r) => (
        <input
          type="text"
          value={r.comments || ''}
          onChange={(e) => updateRowComment(r.sl_no, e.target.value)}
          placeholder="Add comment..."
          className="w-full px-2 py-1 rounded bg-[var(--input-bg)] border border-[var(--border-card)] focus:border-[var(--accent-gold)] text-xs font-mono text-[var(--text-main)] outline-none transition"
        />
      ),
    },
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* ── Overview & Export Control Card ── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-card)] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-card)] pb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-[var(--accent-gold)]/10 text-[var(--accent-gold)] text-xs font-mono font-bold flex items-center justify-center">
              4
            </span>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wider font-mono">
                Step 4: Review & Consolidated Excel Generation
              </h3>
              <p className="text-[11px] text-[var(--text-muted)] font-mono">
                Consolidates all {selectedContracts.length} contract(s) into single worksheet &apos;StoneX Netting&apos;.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={exportExcel}
            disabled={isExporting || previewRows.length === 0}
            className="px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 bg-[var(--accent-gold)] text-black hover:opacity-95 shadow-md transition disabled:opacity-50 cursor-pointer"
          >
            {isExporting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>Export Consolidated Excel (.xlsx)</span>
          </button>
        </div>
        {/* Bulk Comment Toolbar */}
        <div className="p-3 rounded-xl bg-[var(--input-bg)] border border-[var(--border-card)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 flex-1">
            <MessageSquare className="w-3.5 h-3.5 text-[var(--accent-gold)] shrink-0" />
            <span className="text-[var(--text-muted)] shrink-0">Bulk Comment:</span>
            <input
              type="text"
              value={bulkCommentText}
              onChange={(e) => setBulkCommentText(e.target.value)}
              placeholder="Type comment to apply to all rows..."
              className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--card-bg)] border border-[var(--border-card)] focus:border-[var(--accent-gold)] text-xs text-[var(--text-main)] outline-none"
            />
            <button
              type="button"
              onClick={() => {
                if (bulkCommentText.trim()) {
                  setBulkComment(bulkCommentText.trim());
                }
              }}
              disabled={!bulkCommentText.trim()}
              className="px-3 py-1.5 rounded-lg bg-[var(--accent-gold)]/10 text-[var(--accent-gold)] hover:bg-[var(--accent-gold)]/20 border border-[var(--accent-gold)]/30 font-bold transition disabled:opacity-40 cursor-pointer shrink-0"
            >
              Apply to All
            </button>
          </div>
        </div>

        {/* Mapped DataTable */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] px-1 font-mono">
            <span>
              Previewing <strong className="text-[var(--text-main)]">{previewRows.length}</strong> mapped position rows
            </span>
            <button
              type="button"
              onClick={fetchPreview}
              disabled={isPreviewLoading}
              className="text-[11px] text-[var(--accent-gold)] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isPreviewLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Grid</span>
            </button>
          </div>

          <DataTable
            columns={columns}
            data={previewRows}
            emptyMessage={
              isPreviewLoading
                ? 'Loading mapped preview...'
                : 'No net-zero position rows match current selection.'
            }
            maxHeight="520px"
          />
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={() => setStep(3)}
          className="px-4 py-2.5 rounded-xl border border-[var(--border-card)] bg-[var(--card-bg)] text-xs font-mono text-[var(--text-muted)] hover:text-white transition flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back: Netting Audit</span>
        </button>

        <button
          type="button"
          onClick={exportExcel}
          disabled={isExporting || previewRows.length === 0}
          className="px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 bg-[var(--accent-gold)] text-black hover:opacity-95 shadow-md transition disabled:opacity-50 cursor-pointer"
        >
          {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span>Download Spreadsheet</span>
        </button>
      </div>
    </div>
  );
};
