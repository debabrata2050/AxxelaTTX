'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useTradeStore } from '@/store/useTradeStore';
import { apiClient } from '@/lib/apiClient';
import { WorkspaceFile } from '@/types/trade.types';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import {
  UploadCloud,
  FileSpreadsheet,
  Trash2,
  Search,
  RefreshCw,
  HardDrive,
  CheckCircle,
} from 'lucide-react';

export const Step0FileSelect: React.FC = () => {
  const { setActiveFile, showLoading, hideLoading, showAlert } = useTradeStore();

  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [filterQuery, setFilterQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceFile | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchWorkspaceFiles = async () => {
    setIsRefreshing(true);
    try {
      const data = await apiClient.listFiles();
      setFiles(data.files || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWorkspaceFiles();
  }, []);

  const handleSelectFile = async (f: WorkspaceFile) => {
    showLoading('Loading trade file...', f.name);
    try {
      const res = await apiClient.selectFile(f.path);
      hideLoading();
      if (!res.success) {
        showAlert('Load Error', res.error || 'Unable to parse CSV file.');
        return;
      }
      setActiveFile({
        filePath: f.path,
        filename: f.name,
        clientGroup: res.client_group || 'SYM',
        date: res.default_date || '',
        accounts: res.accounts || [],
        recordCount: res.total_records || 0,
      });
    } catch (err: any) {
      hideLoading();
      showAlert('Load Error', err.message);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (file.size > 500 * 1024 * 1024) {
      showAlert(
        'File Exceeds Limit',
        `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of 500MB.`
      );
      return;
    }

    showLoading('Processing uploaded CSV...', file.name);
    try {
      const res = await apiClient.uploadFile(file);
      hideLoading();
      if (!res.success) {
        showAlert('Upload Failed', res.error || 'Failed to parse file.');
        return;
      }
      setActiveFile({
        filePath: res.filepath || file.name,
        filename: file.name,
        clientGroup: res.client_group || 'SYM',
        date: res.default_date || '',
        accounts: res.accounts || [],
        recordCount: res.total_records || res.total_rows || 0,
      });
      fetchWorkspaceFiles();
    } catch (err: any) {
      hideLoading();
      showAlert('Upload Failed', err.message);
    }
  };

  const handleDeleteFile = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);

    try {
      const res = await apiClient.deleteFile(target.path);
      if (res.success) {
        setFiles((prev) => prev.filter((item) => item.path !== target.path));
      } else {
        showAlert('Delete Failed', res.error || 'Could not delete file.');
      }
    } catch (err: any) {
      showAlert('Delete Error', err.message);
    }
  };

  const filteredFiles = files.filter(
    (f) =>
      f.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      f.rel_path.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Step Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">
          Step 0: Select Trade Execution Data
        </h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Pick an existing workspace trade export or import a new file. Direct local zero-copy reading is supported.
        </p>
      </div>

      {/* Upload Dropzone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files?.[0]) {
            handleFileUpload(e.dataTransfer.files[0]);
          }
        }}
        className="p-8 sm:p-12 rounded-2xl border-2 border-dashed border-[var(--border-card)] hover:border-[var(--accent-gold)] bg-[var(--card-bg)] text-center cursor-pointer transition group shadow-sm"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              handleFileUpload(e.target.files[0]);
            }
          }}
        />
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[var(--accent-gold)]/10 text-[var(--accent-gold)] flex items-center justify-center group-hover:scale-110 transition duration-300">
          <UploadCloud className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-[var(--text-main)]">
          Drag & Drop Trade CSV or Click to Browse
        </h3>
        <p className="text-xs text-[var(--text-muted)] mt-1.5">
          Zero-copy parsing: CSVs located in your workspace are read directly from disk without duplication.
        </p>
        <div className="mt-3 flex items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--input-bg)] border border-[var(--border-card)] text-[11px] font-mono font-medium text-[var(--accent-gold)]">
            Max File Size: 500MB • UTF-8 CSV
          </span>
        </div>
      </div>

      {/* Available CSV Files In Workspace */}
      <div className="p-6 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-card)] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-[var(--accent-gold)]" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--accent-gold)]">
              Available CSV Files in Workspace ({filteredFiles.length})
            </h4>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Filter files..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--input-bg)] border border-[var(--border-card)] text-xs font-mono text-[var(--text-main)] outline-none focus:border-[var(--accent-gold)]"
              />
            </div>
            <button
              onClick={fetchWorkspaceFiles}
              className="p-1.5 rounded-lg border border-[var(--border-card)] text-[var(--text-muted)] hover:text-[var(--accent-gold)] transition"
              title="Refresh file list"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Files Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
          {filteredFiles.length === 0 ? (
            <div className="col-span-full py-8 text-center text-xs text-[var(--text-muted)]">
              No matching CSV files found in workspace.
            </div>
          ) : (
            filteredFiles.map((f) => (
              <div
                key={f.path}
                className="p-3.5 rounded-xl border border-[var(--border-card)] hover:border-[var(--accent-gold)] bg-[var(--input-bg)] flex items-center justify-between gap-3 transition group"
              >
                <div
                  onClick={() => handleSelectFile(f)}
                  className="flex items-center gap-3 min-w-0 cursor-pointer flex-grow"
                >
                  <div className="w-9 h-9 rounded-lg bg-[var(--card-bg)] border border-[var(--border-card)] flex items-center justify-center text-[var(--accent-gold)] flex-shrink-0 group-hover:scale-105 transition">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-bold font-mono text-[var(--text-main)] truncate group-hover:text-[var(--accent-gold)] transition">
                      {f.name}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] font-mono flex items-center gap-2 mt-0.5">
                      <span>{f.size_mb} MB</span>
                      <span>•</span>
                      <span>{f.rel_path}</span>
                    </div>
                  </div>
                </div>

                {/* Actions: Direct Select & Delete Option */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleSelectFile(f)}
                    className="pill-btn-primary text-[11px] py-1 px-3 shadow-none"
                  >
                    Select
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(f);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
                    title="Delete file from disk"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Confirmation Modal for File Deletion */}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="Delete File from Disk?"
        message={`Are you sure you want to permanently delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete Permanently"
        cancelLabel="Cancel"
        isDestructive={true}
        onConfirm={handleDeleteFile}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
