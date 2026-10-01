'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity" onClick={onCancel} />

      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-[var(--card-bg)] border border-[var(--border-card)] rounded-2xl shadow-2xl p-6 space-y-4 z-50 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isDestructive ? 'bg-red-500/15 text-red-400' : 'bg-[var(--accent-gold)]/15 text-[var(--accent-gold)]'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-main)]">{title}</h3>
            <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
          {cancelLabel && (
            <button onClick={onCancel} className="pill-btn-secondary text-xs py-2 px-4 cursor-pointer">
              {cancelLabel}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={
              isDestructive
                ? 'btn-gradient-danger text-xs py-2 px-4 cursor-pointer'
                : 'pill-btn-primary text-xs py-2 px-4 cursor-pointer'
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
