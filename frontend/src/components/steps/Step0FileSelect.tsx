'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useTradeStore } from '@/store/useTradeStore';
import { apiClient } from '@/lib/apiClient';
import { WorkspaceFile } from '@/types/trade.types';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  UploadCloud,
  FileSpreadsheet,
  Trash2,
  Search,
  RefreshCw,
  HardDrive,
} from 'lucide-react';

export const Step0FileSelect: React.FC = () => {
  const {
    activeFilePath,
    setActiveFile,
    showLoadingSteps,
    updateLoadingStep,
    hideLoading,
    showAlert,
  } = useTradeStore();

  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [filterQuery, setFilterQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceFile | null>(null);
  const [pendingSelectFile, setPendingSelectFile] = useState<WorkspaceFile | null>(null);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const FILE_PROCESSING_STEPS = [
    'Inspecting CSV stream & mandatory column headers',
    'Parsing execution rows & normalizing trade prices',
    'Indexing client accounts & classifying contract types',
    'Calibrating lot balances & initializing transfer engine',
  ];

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

  const handleSelectFile = (f: WorkspaceFile) => {
    if (activeFilePath && activeFilePath !== f.path) {
      setPendingSelectFile(f);
    } else {
      executeSelectFile(f);
    }
  };

  const executeSelectFile = async (f: WorkspaceFile) => {
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
          filePath: res.filepath,
          filename: res.filename,
          clientGroup: res.client_group,
          date: res.default_date ?? undefined,
          accounts: res.accounts,
          recordCount: res.total_records,
          sessionId: res.session_id,
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

  const handleFileUpload = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      showAlert('Invalid File Format', 'Please upload a valid .csv file containing trade execution data.');
      return;
    }
    if (activeFilePath) {
      setPendingUploadFile(file);
    } else {
      executeFileUpload(file);
    }
  };

  const executeFileUpload = async (file: File) => {
    showLoadingSteps('Uploading CSV File', file.name, FILE_PROCESSING_STEPS);

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
      const res = await apiClient.uploadFile(file);
      clearInterval(timer);

      if (!res.success) {
        updateLoadingStep(stage, 'error');
        setTimeout(() => {
          hideLoading();
          showAlert('Upload Failed', res.error || 'Invalid trade file format.');
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
          sessionId: res.session_id,
        });
        fetchWorkspaceFiles();
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
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Step 0: Select Trade Execution Data
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pick an existing workspace trade export or import a new file. Direct local zero-copy reading is supported.
        </p>
      </div>

      {/* Upload Dropzone */}
      <Card
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files?.[0]) {
            handleFileUpload(e.dataTransfer.files[0]);
          }
        }}
        className="p-8 sm:p-12 rounded-2xl border-2 border-dashed border-border hover:border-primary/60 bg-card/60 hover:bg-card text-center cursor-pointer transition-all group shadow-xs"
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
        <div className="size-14 mx-auto mb-4 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition duration-300">
          <UploadCloud className="size-7" />
        </div>
        <h3 className="text-base font-bold text-foreground">
          Drag & Drop Trade CSV or Click to Browse
        </h3>
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
          Zero-copy parsing: CSVs located in your workspace are read directly from disk without duplication.
        </p>
        <div className="mt-3.5 flex items-center justify-center gap-2">
          <Badge variant="gold" className="text-xs px-3 py-1">
            Max File Size: 500MB • UTF-8 CSV
          </Badge>
        </div>
      </Card>

      {/* Available CSV Files In Workspace */}
      <Card className="p-6 rounded-2xl bg-card border-border shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <HardDrive className="size-4 text-primary" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
              Available CSV Files in Workspace ({filteredFiles.length})
            </h4>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Filter files..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={fetchWorkspaceFiles}
              disabled={isRefreshing}
              title="Refresh file list"
            >
              <RefreshCw className={cn('size-3.5', isRefreshing && 'animate-spin')} />
            </Button>
          </div>
        </div>

        {/* Files Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
          {filteredFiles.length === 0 ? (
            <div className="col-span-full py-8 text-center text-xs text-muted-foreground">
              No matching CSV files found in workspace.
            </div>
          ) : (
            filteredFiles.map((f) => (
              <div
                key={f.path}
                className="p-3.5 rounded-xl border border-border hover:border-primary/50 bg-input/40 flex items-center justify-between gap-3 transition-all group"
              >
                <div
                  onClick={() => handleSelectFile(f)}
                  className="flex items-center gap-3 min-w-0 cursor-pointer flex-grow"
                >
                  <div className="size-9 rounded-lg bg-card border border-border flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition">
                    <FileSpreadsheet className="size-5" />
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-bold font-mono text-foreground truncate group-hover:text-primary transition">
                      {f.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-2 mt-0.5">
                      <span>{f.size_mb} MB</span>
                      <span>•</span>
                      <span>{f.rel_path}</span>
                    </div>
                  </div>
                </div>

                {/* Actions: Direct Select & Delete Option */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="gold"
                    size="sm"
                    onClick={() => handleSelectFile(f)}
                    className="h-7.5 px-4 text-xs font-bold"
                  >
                    Select
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(f);
                    }}
                    className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="Delete file from disk"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Confirmation Modal for Loading New File during Active Session */}
      <ConfirmModal
        isOpen={pendingSelectFile !== null || pendingUploadFile !== null}
        title="Load New File?"
        message="Loading a new file will reset your current trade session, routes, and allocations. Continue?"
        confirmLabel="Continue & Reset"
        cancelLabel="Cancel"
        isDestructive={true}
        onConfirm={() => {
          if (pendingSelectFile) {
            const f = pendingSelectFile;
            setPendingSelectFile(null);
            executeSelectFile(f);
          } else if (pendingUploadFile) {
            const up = pendingUploadFile;
            setPendingUploadFile(null);
            executeFileUpload(up);
          }
        }}
        onCancel={() => {
          setPendingSelectFile(null);
          setPendingUploadFile(null);
        }}
      />

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
