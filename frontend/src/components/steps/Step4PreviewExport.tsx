'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useTradeStore } from '@/store/useTradeStore';
import { apiClient } from '@/lib/apiClient';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import {
  Download,
  RotateCcw,
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2,
  X,
} from 'lucide-react';

export const Step4PreviewExport: React.FC = () => {
  const {
    routes,
    trades,
    allocations,
    priceMode,
    globalManualPrice,
    clientGroup,
    defaultDate,
    previewHeaders,
    previewRows,
    previewSummary,
    setPreviewData,
    updatePreviewCell,
    exportFilename,
    setExportFilename,
    outputMode,
    setOutputMode,
    setStep,
    resetSession,
    showLoading,
    hideLoading,
    showAlert,
  } = useTradeStore();

  const [editingCell, setEditingCell] = useState<{ r: number; c: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showExportSuccessModal, setShowExportSuccessModal] = useState(false);

  // Generate clean descriptive filename if not set
  const autoFilename = useMemo(() => {
    const dateStr = defaultDate
      ? defaultDate.replace(/-/g, '')
      : new Date().toISOString().split('T')[0].replace(/-/g, '');

    if (routes.length === 1) {
      return `${clientGroup}.Transfer.${dateStr}_${routes[0].from}_TO_${routes[0].to}.xlsx`;
    }
    const froms = Array.from(new Set(routes.map((r) => r.from))).slice(0, 2).join('+');
    const more =
      new Set(routes.map((r) => r.from)).size > 2
        ? `(+${new Set(routes.map((r) => r.from)).size - 2}Accts)`
        : '';
    const tos = Array.from(new Set(routes.map((r) => r.to))).slice(0, 2).join('+');
    return `${clientGroup}.Transfer.${dateStr}_FROM_${froms}${more}_TO_${tos}.xlsx`;
  }, [routes, clientGroup, defaultDate]);

  useEffect(() => {
    if (!exportFilename) {
      setExportFilename(autoFilename);
    }
  }, [autoFilename, exportFilename, setExportFilename]);

  const loadPreview = async (modeOverride?: 'paired' | 'batched') => {
    const activeMode = modeOverride || outputMode;
    const allocationPayload: any[] = [];
    trades.forEach((t) => {
      const a = allocations[t.row_id];
      if (a && a.selected && a.transfer_qty > 0) {
        const accStr =
          typeof t.account === 'object' && t.account !== null
            ? String((t.account as any).account || '')
            : String(t.account || '');
        const matching = routes.filter((r) => r.from.toUpperCase() === accStr.toUpperCase());
        const toAcc = a.to_account || matching[0]?.to;
        if (toAcc) {
          allocationPayload.push({
            row_id: t.row_id,
            from_account: accStr,
            to_account: toAcc,
            transfer_qty: a.transfer_qty,
            custom_price: a.custom_price,
            price_mode: a.price_mode ?? null,
          });
        }
      }
    });

    if (allocationPayload.length === 0) {
      showAlert('No Allocations', 'No active trades with positive lots selected.');
      setStep(3);
      return;
    }

    showLoading(
      'Building 18-column Excel preview...',
      activeMode === 'batched'
        ? 'Batched Format (All Transfers First, Reversals Second)'
        : 'Paired Format (Leg 1 & 2 grouped per route)'
    );
    try {
      const res = await apiClient.buildPreview({
        allocations: allocationPayload,
        price_mode: priceMode,
        manual_price: globalManualPrice,
        output_mode: activeMode,
      });
      hideLoading();

      if (res.error) {
        showAlert('Preview Error', res.error);
        return;
      }

      const rows = (res.rows || []).map((r) => r.cells);
      setPreviewData(res.headers || [], rows, res.summary);
    } catch (err: any) {
      hideLoading();
      showAlert('Preview Failed', err.message);
    }
  };

  const handleModeChange = (mode: 'paired' | 'batched') => {
    if (mode === outputMode) return;
    setOutputMode(mode);
    loadPreview(mode);
  };

  useEffect(() => {
    if (previewRows.length === 0) {
      loadPreview();
    }
  }, []);

  const handleDownloadExcel = async () => {
    if (previewRows.length === 0) {
      showAlert('Preview Empty', 'Please build the preview before exporting.');
      return;
    }

    const filename = exportFilename.trim() || autoFilename;
    showLoading('Generating Institutional Excel (.xlsx)...', filename);

    try {
      const blob = await apiClient.exportExcel(previewRows, filename);
      hideLoading();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setShowExportSuccessModal(true);
    } catch (err: any) {
      hideLoading();
      showAlert('Download Failed', err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">
            Step 4: Institutional Excel Preview & Export
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Double-click any table cell to modify values before generating the final formatted Excel file.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button onClick={() => setStep(3)} className="pill-btn-secondary text-xs">
            Back
          </button>
          <button
            onClick={() => setShowResetConfirm(true)}
            className="btn-gradient-danger text-xs"
            title="Reset everything and start with a new CSV file"
          >
            <RotateCcw className="w-4 h-4 text-red-400" />
            <span>Start With New File</span>
          </button>
          <button onClick={handleDownloadExcel} className="pill-btn-primary text-xs">
            <Download className="w-4 h-4" />
            <span>Download Formatted Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Multi-Route & Balance Verification Audit Card */}
      {previewSummary && (
        <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-card)] shadow-sm grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Transfer Routes
            </span>
            <div className="text-lg font-mono font-bold text-[var(--accent-gold)]">
              {previewSummary.routes_count || routes.length} Routes
            </div>
            <span className="text-[10px] text-emerald-400 font-mono">✓ Verified Distinct</span>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Leg 1 Dest Lots
            </span>
            <div className="text-lg font-mono font-bold text-emerald-400">
              {(previewSummary.total_dest_lots || 0).toLocaleString()}
            </div>
            <span className="text-[10px] text-[var(--text-muted)] font-mono">Original Side (B/S)</span>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Leg 2 Source Lots
            </span>
            <div className="text-lg font-mono font-bold text-red-400">
              {(previewSummary.total_src_lots || 0).toLocaleString()}
            </div>
            <span className="text-[10px] text-[var(--text-muted)] font-mono">Opposite Side (S/B)</span>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Balance Audit
            </span>
            <div className="text-lg font-mono font-bold text-[var(--text-main)]">
              {previewSummary.total_dest_lots === previewSummary.total_src_lots ? (
                <span className="text-emerald-400 flex items-center gap-1 font-mono">
                  <CheckCircle2 className="w-4 h-4" /> 100% Balanced
                </span>
              ) : (
                <span className="text-red-400 font-mono">Qty Mismatch</span>
              )}
            </div>
            <span className="text-[10px] text-[var(--text-muted)] font-mono">Zero Quantity Leakage</span>
          </div>
        </div>
      )}

      {/* Preview Container Card */}
      <div className="p-6 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-card)] shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[var(--border-subtle)]/50 pb-3.5">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[var(--accent-gold)]" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-main)]">
              Trade Transfer Output (18 Columns)
            </h3>
          </div>

          {/* Dual Output Option Selector */}
          <div className="flex flex-wrap items-center gap-1.5 bg-[var(--input-bg)] p-1 rounded-xl border border-[var(--border-card)]">
            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider px-2">
              Layout:
            </span>
            <button
              type="button"
              onClick={() => handleModeChange('paired')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${outputMode === 'paired'
                  ? 'bg-[var(--accent-gold)] text-black font-bold shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
            >
              Paired by Route
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('batched')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${outputMode === 'batched'
                  ? 'bg-[var(--accent-gold)] text-black font-bold shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
            >
              Batched
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadPreview()}
              className="text-xs font-bold text-[var(--accent-gold)] hover:underline flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Rebuild Preview
            </button>
            <span className="text-[var(--text-muted)] text-xs font-mono">
              Total Rows: <strong className="text-[var(--accent-gold)]">{previewRows.length}</strong>
            </span>
          </div>
        </div>

        {/* 18-Column Preview Table */}
        <div className="overflow-x-auto rounded-xl border border-[var(--border-card)] max-h-[520px]">
          <table className="w-full text-xs border-collapse font-mono" id="table-excel-preview">
            <thead className="sticky top-0 z-10 bg-[var(--header-bg)] border-b border-[var(--border-subtle)]">
              <tr>
                {previewHeaders.map((h, idx) => (
                  <th key={idx} className="p-2.5 text-left font-bold text-[var(--text-muted)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {previewRows.map((row, rIdx) => {
                const isSeparator = row.every((c) => c === null || c === '' || c === undefined);

                if (isSeparator) {
                  return (
                    <tr key={rIdx} className="separator-row">
                      <td colSpan={previewHeaders.length} className="h-4 bg-black/40" />
                    </tr>
                  );
                }

                return (
                  <tr key={rIdx} className="hover:bg-[var(--accent-gold)]/5 transition">
                    {row.map((cell, cIdx) => {
                      const isEditing = editingCell?.r === rIdx && editingCell?.c === cIdx;

                      return (
                        <td
                          key={cIdx}
                          onDoubleClick={() => {
                            setEditingCell({ r: rIdx, c: cIdx });
                            setEditValue(cell !== null ? String(cell) : '');
                          }}
                          className="border border-[var(--border-subtle)] px-2.5 py-1.5 cursor-pointer"
                        >
                          {isEditing ? (
                            <input
                              type="text"
                              value={editValue}
                              autoFocus
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => {
                                updatePreviewCell(rIdx, cIdx, editValue.trim());
                                setEditingCell(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  updatePreviewCell(rIdx, cIdx, editValue.trim());
                                  setEditingCell(null);
                                } else if (e.key === 'Escape') {
                                  setEditingCell(null);
                                }
                              }}
                              className="w-full px-1 py-0.5 rounded bg-[var(--input-bg)] border border-[var(--accent-gold)] text-xs text-[var(--accent-gold)] outline-none"
                            />
                          ) : (
                            <span>{cell !== null && cell !== undefined ? String(cell) : ''}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Filename & Bottom Action Bar */}
        <div className="p-4 rounded-xl bg-[var(--input-bg)] border border-[var(--border-card)] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-grow max-w-xl">
            <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
              Generated Output Filename:
            </label>
            <div className="relative">
              <input
                type="text"
                value={exportFilename}
                onChange={(e) => setExportFilename(e.target.value)}
                className="w-full px-3.5 pr-8 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border-card)] text-xs font-mono font-bold text-[var(--accent-gold)] outline-none focus:border-[var(--accent-gold)]"
              />
              {exportFilename && (
                <button
                  type="button"
                  onClick={() => setExportFilename('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">
              Standard format: [ClientGroup].Transfer.[Date]_[Sender]_TO_[Recipient].xlsx
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowResetConfirm(true)}
              className="btn-gradient-danger text-xs"
              title="Reset everything and start with a new CSV file"
            >
              <RotateCcw className="w-4 h-4 text-red-400" />
              <span>Start With New File</span>
            </button>
            <button onClick={handleDownloadExcel} className="pill-btn-primary text-xs">
              <Download className="w-4 h-4" />
              <span>Download Formatted Excel (.xlsx)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      <ConfirmModal
        isOpen={showResetConfirm}
        title="Start With a New File?"
        message="This will clear all current routes, contracts, allocations, and generated preview data. Do you wish to proceed?"
        confirmLabel="Reset Everything"
        cancelLabel="Cancel"
        isDestructive={true}
        onConfirm={() => {
          setShowResetConfirm(false);
          resetSession();
        }}
        onCancel={() => setShowResetConfirm(false)}
      />

      {/* Transfer Complete Modal */}
      <ConfirmModal
        isOpen={showExportSuccessModal}
        title="Transfer Complete"
        message="Your formatted Excel transfer sheet has been successfully exported. Would you like to start a fresh session with a new file or stay here to review/re-export?"
        confirmLabel="Start New Session"
        cancelLabel="Stay Here"
        isDestructive={false}
        onConfirm={() => {
          setShowExportSuccessModal(false);
          resetSession();
        }}
        onCancel={() => setShowExportSuccessModal(false)}
      />
    </div>
  );
};
