'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

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
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader className="gap-3 sm:flex-row sm:items-start text-left">
          <div
            className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${
              isDestructive
                ? 'bg-destructive/15 text-destructive'
                : 'bg-primary/15 text-primary'
            }`}
          >
            <AlertTriangle className="size-5" />
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <DialogTitle className="text-base font-bold text-foreground">
              {title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
              {message}
            </DialogDescription>
          </div>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-2.5 pt-4 border-t border-border">
          {cancelLabel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              className="rounded-full px-4"
            >
              {cancelLabel}
            </Button>
          )}
          <Button
            type="button"
            variant={isDestructive ? 'destructive' : 'gold'}
            size="sm"
            onClick={onConfirm}
            className="rounded-full px-5"
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
