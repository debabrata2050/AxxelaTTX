'use client';

import React, { useState } from 'react';
import { useStoneXStore } from '@/store/useStoneXStore';
import { FileDropzone } from '@/components/ui/FileDropzone';
import { MetricCard } from '@/components/ui/MetricCard';
import {
  FileSpreadsheet,
  Layers,
  Scale,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export const StoneXStep0File: React.FC = () => {
  const summary = useStoneXStore((s) => s.summary);
  const setSummary = useStoneXStore((s) => s.setSummary);
  const setStep = useStoneXStore((s) => s.setStep);
  const setError = useStoneXStore((s) => s.setError);
  const setSuccess = useStoneXStore((s) => s.setSuccess);

  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (file: File) => {
    // Validation
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Invalid file format. StoneX Netting requires a CSV positions export.');
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      setError('File exceeds maximum allowable limit of 500MB.');
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/stonex/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to ingest StoneX CSV.');
      }
      setSummary(data.data);
    } catch (err: any) {
      setError(err.message || 'Error uploading file.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Dropzone Card */}
      <div className="p-4 sm:p-6 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-card)] shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border-card)] pb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-[var(--accent-gold)]/10 text-[var(--accent-gold)] text-xs font-mono font-bold flex items-center justify-center">
              0
            </span>
            <h3 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wider font-mono">
              Step 0: Ingest Institutional Position Feed
            </h3>
          </div>
        </div>

        <FileDropzone
          onFileSelect={handleFileUpload}
          title="Upload StoneX Net Positions CSV"
          subtitle="Instant automated scan across sub-account position feeds."
          badgeText="Max 500MB • Institutional CSV"
          isLoading={isUploading}
        />
      </div>

      {/* KPI Cards & Confirmation if file already uploaded */}
      {summary && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <MetricCard
              label="Positions Scanned"
              value={summary.total_positions.toLocaleString()}
              subtext={summary.filename}
              icon={<FileSpreadsheet className="w-5 h-5" />}
            />
            <MetricCard
              label="Distinct Products"
              value={summary.total_products}
              subtext={`${summary.total_contracts} contract partitions`}
              icon={<Layers className="w-5 h-5" />}
            />
            <MetricCard
              label="Net-Zero Eligible"
              value={summary.eligible_contracts_count}
              subtext="Buy == Sell (Flat Delta)"
              icon={<Scale className="w-5 h-5" />}
              variant="emerald"
            />
            <MetricCard
              label="Balanced Net Lots"
              value={summary.total_eligible_lots.toLocaleString()}
              subtext="To Net into LCE30553"
              icon={<CheckCircle2 className="w-5 h-5" />}
              variant="gold"
            />
          </div>

          <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-card)] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs font-mono text-[var(--text-muted)]">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                File verified. Ready to select products for net-zero consolidation.
              </span>
            </div>

            <Button
              type="button"
              variant="gold"
              size="pill"
              onClick={() => setStep(1)}
              className="gap-2 font-bold text-xs"
            >
              <span>Next: Select Products</span>
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
