'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTradeStore } from '@/store/useTradeStore';
import { apiClient } from '@/lib/apiClient';
import { WorkspaceFile } from '@/types/trade.types';
import {
  X,
  FileText,
  UploadCloud,
  HardDrive,
  Search,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

interface FileSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FileSwitchModal: React.FC<FileSwitchModalProps> = ({ isOpen, onClose }) => {
  const {
    activeFilename,
    activeFilePath,
    routes,
    setActiveFile,
    showLoadingSteps,
    updateLoadingStep,
    hideLoading,
    showAlert,
  } = useTradeStore();

  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [filterQuery, setFilterQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<WorkspaceFile | File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = async () => {
    setIsRefreshing(true);
    try {
      const data = await apiClient.listFiles();
      setFiles(data.files || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFiles();
      setFilterQuery('');
      setPendingTarget(null);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (pendingTarget) {
          setPendingTarget(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, pendingTarget, onClose]);

  if (!isOpen) return null;

  const filteredFiles = files.filter(
    (f) =>
      f.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      f.rel_path.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const FILE_PROCESSING_STEPS = [
    'Inspecting CSV stream & mandatory column headers',
    'Parsing execution rows & normalizing trade prices',
    'Indexing client accounts & classifying contract types',
    'Calibrating lot balances & initializing transfer engine',
  ];

  const executeFileSelect = async (f: WorkspaceFile) => {
    onClose();
    showLoadingSteps('Loading Trade File', f.name, FILE_PROCESSING_STEPS);

    let stage = 0;
    const timer = setInterval(() => {
      if (stage === 0) {
        updateLoadingStep(0, 'completed', 35);
        updateLoadingStep(1, 'in_progress');
        stage = 1;
      } else if (stage === 1) {
        updateLoadingStep(1, 'completed', 65);
        updateLoadingStep(2, 'in_progress');
        stage = 2;
      } else if (stage === 2) {
        updateLoadingStep(2, 'completed', 85);
        updateLoadingStep(3, 'in_progress');
        stage = 3;
      }
    }, 250);

    try {
      const res = await apiClient.selectFile(f.path);
      clearInterval(timer);

      if (!res.success) {
        updateLoadingStep(stage, 'error');
        setTimeout(() => {
          hideLoading();
          showAlert('Load Error', res.error || 'Unable to parse CSV file.');
        }, 500);
        return;
      }

      updateLoadingStep(0, 'completed');
      updateLoadingStep(1, 'completed');
      updateLoadingStep(2, 'completed');
      updateLoadingStep(3, 'completed', 100);

      setTimeout(() => {
        hideLoading();
        setActiveFile({
          filePath: f.path,
          filename: f.name,
          clientGroup: res.client_group || 'SYM',
          date: res.default_date || '',
          accounts: res.accounts || [],
          recordCount: res.total_records || res.total_rows || 0,
        });
      }, 350);
    } catch (err: any) {
      clearInterval(timer);
      updateLoadingStep(stage, 'error');
      setTimeout(() => {
        hideLoading();
        showAlert('Load Error', err.message);
      }, 500);
    }
  };

  const executeFileUpload = async (file: File) => {
    if (file.size > 500 * 1024 * 1024) {
      showAlert(
        'File Exceeds Limit',
        `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of 500MB.`
      );
      return;
    }

    onClose();
    showLoadingSteps('Uploading & Processing CSV', file.name, FILE_PROCESSING_STEPS);

    let stage = 0;
    const timer = setInterval(() => {
      if (stage === 0) {
        updateLoadingStep(0, 'completed', 35);
        updateLoadingStep(1, 'in_progress');
        stage = 1;
      } else if (stage === 1) {
        updateLoadingStep(1, 'completed', 65);
        updateLoadingStep(2, 'in_progress');
        stage = 2;
      } else if (stage === 2) {
        updateLoadingStep(2, 'completed', 85);
        updateLoadingStep(3, 'in_progress');
        stage = 3;
      }
    }, 280);

    try {
      const res = await apiClient.uploadFile(file);
      clearInterval(timer);

      if (!res.success) {
        updateLoadingStep(stage, 'error');
        setTimeout(() => {
          hideLoading();
          showAlert('Upload Failed', res.error || 'Failed to parse file.');
        }, 500);
        return;
      }

      updateLoadingStep(0, 'completed');
      updateLoadingStep(1, 'completed');
      updateLoadingStep(2, 'completed');
      updateLoadingStep(3, 'completed', 100);

      setTimeout(() => {
        hideLoading();
        setActiveFile({
          filePath: res.filepath || file.name,
          filename: file.name,
          clientGroup: res.client_group || 'SYM',
          date: res.default_date || '',
          accounts: res.accounts || [],
          recordCount: res.total_records || res.total_rows || 0,
        });
      }, 350);
    } catch (err: any) {
      clearInterval(timer);
      updateLoadingStep(stage, 'error');
      setTimeout(() => {
        hideLoading();
        showAlert('Upload Failed', err.message);
      }, 500);
    }
  };

  const handleSelectRequest = (f: WorkspaceFile) => {
    if (f.path === activeFilePath) {
      onClose();
      return;
    }
    if (routes.length > 0) {
      setPendingTarget(f);
    } else {
      executeFileSelect(f);
    }
  };

  const handleUploadRequest = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      showAlert('Invalid File', 'Only CSV trade export files are supported.');
      return;
    }
    if (routes.length > 0) {
      setPendingTarget(file);
    } else {
      executeFileUpload(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-[var(--card-bg)] border border-[var(--border-card)] shadow-2xl rounded-2xl flex flex-col overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-gold)]/10 text-[var(--accent-gold)] flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-main)]">
                Switch Active Trade File
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Select an existing CSV in your workspace or import a new file.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-white/5 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Active File Banner */}
          {activeFilename && (
            <div className="px-3.5 py-2.5 rounded-xl bg-[var(--input-bg)] border border-[var(--border-card)] flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2 truncate">
                <span className="text-[var(--text-muted)]">Current:</span>
                <span className="font-bold text-[var(--accent-gold)] truncate">
                  {activeFilename}
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold flex-shrink-0">
                Active
              </span>
            </div>
          )}

          {/* Confirmation Warning if active routes exist */}
          {pendingTarget && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Switching File Will Reset Workspace</div>
                  <p className="text-[11px] text-amber-200/80 mt-0.5">
                    You have configured routes or allocations. Switching to{' '}
                    <strong className="text-white">
                      {pendingTarget.name}
                    </strong>{' '}
                    will reset current transfer routes and lot allocations.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPendingTarget(null)}
                  className="px-3 py-1 rounded-lg text-xs font-medium text-[var(--text-sub)] hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = pendingTarget;
                    setPendingTarget(null);
                    if ('path' in target) {
                      executeFileSelect(target);
                    } else {
                      executeFileUpload(target);
                    }
                  }}
                  className="px-3 py-1 rounded-lg text-xs font-bold bg-amber-500 text-black hover:bg-amber-400 transition cursor-pointer"
                >
                  Yes, Switch File
                </button>
              </div>
            </div>
          )}

          {/* Upload Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.[0]) {
                handleUploadRequest(e.dataTransfer.files[0]);
              }
            }}
            className="p-6 rounded-xl border-2 border-dashed border-[var(--border-card)] hover:border-[var(--accent-gold)] bg-[var(--input-bg)] text-center cursor-pointer transition group"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleUploadRequest(e.target.files[0]);
                }
              }}
            />
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-[var(--accent-gold)]/10 text-[var(--accent-gold)] flex items-center justify-center group-hover:scale-110 transition">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div className="text-xs font-bold text-[var(--text-main)]">
              Drop new CSV file here or click to browse
            </div>
            {/* Mention File Size Limit explicitly */}
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[var(--card-bg)] border border-[var(--border-card)] text-[10px] font-mono font-medium text-[var(--accent-gold)]">
                Max File Size: 500MB • UTF-8 CSV
              </span>
            </div>
          </div>

          {/* Available Workspace CSV Files List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <HardDrive className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                <span>Available In Workspace ({files.length})</span>
              </div>
              <button
                type="button"
                onClick={fetchFiles}
                disabled={isRefreshing}
                className="text-[11px] text-[var(--accent-gold)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Filter Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Filter files..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--input-bg)] border border-[var(--border-card)] text-xs font-mono text-[var(--text-main)] outline-none focus:border-[var(--accent-gold)]"
              />
            </div>

            {/* Files List */}
            <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 font-mono text-xs">
              {filteredFiles.length === 0 ? (
                <div className="p-4 text-center text-xs text-[var(--text-muted)]">
                  No CSV files found matching &quot;{filterQuery}&quot;
                </div>
              ) : (
                filteredFiles.map((f) => {
                  const isActive = f.path === activeFilePath;
                  return (
                    <div
                      key={f.path}
                      onClick={() => handleSelectRequest(f)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition ${
                        isActive
                          ? 'bg-[var(--accent-gold)]/10 border-[var(--accent-gold)] text-[var(--accent-gold)] font-bold'
                          : 'bg-[var(--input-bg)] border-[var(--border-card)] hover:border-[var(--accent-gold)]/50 text-[var(--text-main)]'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-3.5 h-3.5 flex-shrink-0 text-[var(--accent-gold)]" />
                        <span className="truncate">{f.name}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {f.size_mb} MB
                        </span>
                        {isActive ? (
                          <CheckCircle className="w-4 h-4 text-[var(--accent-gold)]" />
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/5 hover:bg-[var(--accent-gold)] hover:text-black transition">
                            Select
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
          <span className="text-[11px] text-[var(--text-muted)]">
            Zero-copy local reader active
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-[var(--border-card)] text-[var(--text-sub)] hover:text-white hover:bg-white/5 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
