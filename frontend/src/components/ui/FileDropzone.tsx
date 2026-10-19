'use client';

import React, { useRef, useState } from 'react';
import { UploadCloud, FileSpreadsheet, Loader2 } from 'lucide-react';

interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  title?: string;
  subtitle?: string;
  badgeText?: string;
  isLoading?: boolean;
  className?: string;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  onFileSelect,
  accept = '.csv',
  title = 'Drag & Drop CSV or Click to Browse',
  subtitle = 'High-performance zero-copy analytical execution.',
  badgeText = 'Max File Size: 500MB • UTF-8 CSV',
  isLoading = false,
  className = '',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isLoading) return;
    if (e.dataTransfer.files?.[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isLoading) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  return (
    <div
      onClick={() => {
        if (!isLoading) fileInputRef.current?.click();
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`p-8 sm:p-10 rounded-2xl border-2 border-dashed transition-all cursor-pointer group text-center shadow-sm select-none ${
        isDragging
          ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/5 scale-[1.005]'
          : 'border-[var(--border-card)] hover:border-[var(--accent-gold)] bg-[var(--card-bg)]'
      } ${isLoading ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''} ${className}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            onFileSelect(e.target.files[0]);
            e.target.value = '';
          }
        }}
      />
      <div className="w-14 h-14 mx-auto mb-3.5 rounded-2xl bg-[var(--accent-gold)]/10 text-[var(--accent-gold)] flex items-center justify-center group-hover:scale-110 transition duration-300">
        {isLoading ? (
          <Loader2 className="w-7 h-7 animate-spin" />
        ) : (
          <UploadCloud className="w-7 h-7" />
        )}
      </div>
      <h3 className="text-base font-bold text-[var(--text-main)]">{title}</h3>
      <p className="text-xs text-[var(--text-muted)] mt-1 max-w-lg mx-auto">{subtitle}</p>
      {badgeText && (
        <div className="mt-3 flex items-center justify-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--input-bg)] border border-[var(--border-card)] text-[11px] font-mono font-medium text-[var(--accent-gold)]">
            {badgeText}
          </span>
        </div>
      )}
    </div>
  );
};
