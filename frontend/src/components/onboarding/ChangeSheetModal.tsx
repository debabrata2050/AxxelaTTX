'use client';

import React, { useState } from 'react';
import { X, Copy, Check, ExternalLink, Loader2, AlertCircle, FileSpreadsheet, CheckCircle2, Trash2 } from 'lucide-react';
import { saveSheetConfig, disconnectSheetConfig } from '@/lib/onboardingClient';
import { SheetStatus } from '@/types/onboarding.types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentStatus: SheetStatus | null;
  onSuccess: (updatedStatus: SheetStatus) => void;
  onDisconnect?: (updatedStatus: SheetStatus) => void;
}

export function ChangeSheetModal({ isOpen, onClose, currentStatus, onSuccess, onDisconnect }: Props) {
  const [url, setUrl] = useState(currentStatus?.sheet_url || '');
  const [gid, setGid] = useState(currentStatus?.worksheet_gid || '');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const serviceEmail = currentStatus?.service_email || 'axxela@cohesive-apogee-117512.iam.gserviceaccount.com';

  const handleCopy = () => {
    navigator.clipboard.writeText(serviceEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect this Google Sheet? Saved connection and cached accounts will be removed.')) {
      return;
    }

    setDisconnecting(true);
    setError(null);

    try {
      const res = await disconnectSheetConfig();
      if (onDisconnect) {
        onDisconnect(res.status);
      } else {
        onSuccess(res.status);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect Google Sheet.');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setError('Please enter a Google Sheet URL or ID.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await saveSheetConfig(url.trim(), gid.trim());
      onSuccess({
        configured: true,
        connected: true,
        sheet_title: res.sheet_title,
        sheet_url: url.trim(),
        worksheet_gid: gid.trim(),
        row_count: res.row_count,
        service_email: serviceEmail,
        last_synced: res.last_synced,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to connect to Google Sheet.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--card-bg)] border border-[var(--border-card)] rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-card)] bg-[var(--canvas-bg)]/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[var(--accent-gold)]/10 text-[var(--accent-gold)] border border-[var(--accent-gold)]/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-main)]">
                {currentStatus?.configured ? 'Change Google Sheet' : 'Connect Google Sheet'}
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Set up Google Sheets synchronization for People Onboarding.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Instructions Box */}
          <div className="rounded-xl border border-[var(--border-card)] bg-[var(--canvas-bg)] p-4 space-y-3">
            <h4 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-gold)]" />
              Required Sharing Instructions
            </h4>
            <ol className="text-xs text-[var(--text-muted)] space-y-2 list-decimal list-inside leading-relaxed">
              <li>
                Open your target sheet in <strong>Google Sheets</strong> and click the <strong>Share</strong> button.
              </li>
              <li className="space-y-1.5">
                <span>Add this service account email with <strong>Viewer</strong> access:</span>
                <div className="flex items-center gap-2 bg-[var(--input-bg)] border border-[var(--border-card)] rounded-lg px-3 py-1.5 font-mono text-xs text-[var(--accent-gold)] select-all break-all">
                  <span className="flex-1 truncate">{serviceEmail}</span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-[11px] font-sans font-semibold px-2 py-0.5 rounded bg-[var(--accent-gold)]/10 hover:bg-[var(--accent-gold)]/20 text-[var(--accent-gold)] border border-[var(--accent-gold)]/30 transition-colors flex-shrink-0 cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copy
                      </>
                    )}
                  </button>
                </div>
              </li>
              <li>
                Paste your Sheet Link or ID below and click <strong>Connect & Save</strong>.
              </li>
            </ol>
          </div>

          {/* Form Inputs */}
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Google Sheet URL or ID <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                className="
                  w-full rounded-xl border border-[var(--border-card)] bg-[var(--input-bg)]
                  text-[var(--text-main)] text-sm px-3.5 py-2.5
                  focus:outline-none focus:ring-2 focus:ring-[var(--accent-gold)]/50
                  placeholder:text-[var(--text-muted)] placeholder:opacity-40
                "
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Worksheet GID <span className="text-[11px] font-normal lowercase opacity-70">(optional, defaults to first tab)</span>
              </label>
              <input
                type="text"
                value={gid}
                onChange={(e) => setGid(e.target.value)}
                placeholder="e.g. 0 or 1342242311"
                className="
                  w-full rounded-xl border border-[var(--border-card)] bg-[var(--input-bg)]
                  text-[var(--text-main)] text-sm px-3.5 py-2.5
                  focus:outline-none focus:ring-2 focus:ring-[var(--accent-gold)]/50
                  placeholder:text-[var(--text-muted)] placeholder:opacity-40
                "
              />
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs leading-relaxed">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">{error}</p>
                {error.includes('403') && (
                  <p className="opacity-90">
                    Did you share the sheet with{' '}
                    <code className="text-white bg-black/30 px-1 py-0.5 rounded font-mono">{serviceEmail}</code>?
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-[var(--border-card)]">
            <div>
              {currentStatus?.configured && (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={saving || disconnecting}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-40"
                  title="Remove saved Google Sheet configuration and clear cache"
                >
                  {disconnecting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  Disconnect Sheet
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving || disconnecting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || disconnecting || !url.trim()}
                className="
                  flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold
                  bg-[var(--accent-gold)] text-black hover:brightness-110
                  disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer
                "
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Testing & Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Connect & Save to SQLite
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
