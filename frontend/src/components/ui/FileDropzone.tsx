'use client';

import React, { useRef, useState } from 'react';
import { UploadCloud, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

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
    <Card
      onClick={() => {
        if (!isLoading) fileInputRef.current?.click();
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'p-8 sm:p-10 rounded-2xl border-2 border-dashed transition-all cursor-pointer group text-center shadow-xs select-none',
        isDragging
          ? 'border-primary bg-primary/5 scale-[1.005]'
          : 'border-border hover:border-primary/60 bg-card/60 hover:bg-card',
        isLoading && 'opacity-60 cursor-not-allowed pointer-events-none',
        className
      )}
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
      <div className="size-14 mx-auto mb-3.5 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition duration-300 shadow-inner">
        {isLoading ? (
          <Loader2 className="size-7 animate-spin" />
        ) : (
          <UploadCloud className="size-7" />
        )}
      </div>
      <h3 className="text-base font-bold text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground mt-1 max-w-lg mx-auto leading-relaxed">
        {subtitle}
      </p>
      {badgeText && (
        <div className="mt-3.5 flex items-center justify-center">
          <Badge variant="gold" className="px-3 py-1 text-xs">
            {badgeText}
          </Badge>
        </div>
      )}
    </Card>
  );
};
