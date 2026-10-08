'use client';

import React from 'react';
import { X, Users, User, ArrowRight } from 'lucide-react';
import { SheetPersonItem } from '@/types/onboarding.types';

interface Props {
  isOpen: boolean;
  account: string;
  persons: SheetPersonItem[];
  onSelectPerson: (person: SheetPersonItem) => void;
  onSelectBoth: (persons: SheetPersonItem[]) => void;
  onClose: () => void;
}

export function JointAccountModal({
  isOpen,
  account,
  persons,
  onSelectPerson,
  onSelectBoth,
  onClose,
}: Props) {
  if (!isOpen || !persons || persons.length < 2) return null;

  const p1 = persons[0];
  const p2 = persons[1];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--card-bg)] border border-[var(--border-card)] rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-card)] bg-[var(--canvas-bg)]/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[var(--text-main)]">Joint Account Detected</h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--accent-gold)]/15 text-[var(--accent-gold)] border border-[var(--accent-gold)]/30 font-semibold">
                  {account}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                This account contains 2 persons in the sheet. Which person would you like to keep?
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
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Person 1 Card */}
          <div className="rounded-xl border border-[var(--border-card)] bg-[var(--canvas-bg)] p-4 space-y-3 hover:border-[var(--accent-gold)]/40 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[var(--accent-gold)]/20 text-[var(--accent-gold)] flex items-center justify-center text-xs font-bold">
                  1
                </div>
                <h4 className="text-sm font-bold text-[var(--text-main)]">
                  {p1.input.firstname} {p1.input.lastname}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  onSelectPerson(p1);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--accent-gold)] text-black hover:brightness-110 transition cursor-pointer"
              >
                Keep Person 1 <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] uppercase text-[var(--text-muted)] font-semibold">Email:</span>
                <p className="font-mono text-[var(--text-main)] truncate">{p1.input.email || '—'}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase text-[var(--text-muted)] font-semibold">Location:</span>
                <p className="text-[var(--text-main)]">{p1.input.location || '—'} {p1.input.sub_branch ? `(${p1.input.sub_branch})` : ''}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase text-[var(--text-muted)] font-semibold">Client Group:</span>
                <p className="font-mono text-[var(--accent-gold)]">{p1.derived.clientgroup || '—'}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase text-[var(--text-muted)] font-semibold">Subgroup:</span>
                <p className="font-mono text-[var(--accent-gold)]">{p1.derived.clientsubgroup || '—'}</p>
              </div>
            </div>
          </div>

          {/* Person 2 Card */}
          <div className="rounded-xl border border-[var(--border-card)] bg-[var(--canvas-bg)] p-4 space-y-3 hover:border-[var(--accent-gold)]/40 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[var(--accent-gold)]/20 text-[var(--accent-gold)] flex items-center justify-center text-xs font-bold">
                  2
                </div>
                <h4 className="text-sm font-bold text-[var(--text-main)]">
                  {p2.input.firstname} {p2.input.lastname}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  onSelectPerson(p2);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--accent-gold)] text-black hover:brightness-110 transition cursor-pointer"
              >
                Keep Person 2 <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] uppercase text-[var(--text-muted)] font-semibold">Email:</span>
                <p className="font-mono text-[var(--text-main)] truncate">{p2.input.email || '—'}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase text-[var(--text-muted)] font-semibold">Location:</span>
                <p className="text-[var(--text-main)]">{p2.input.location || '—'} {p2.input.sub_branch ? `(${p2.input.sub_branch})` : ''}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase text-[var(--text-muted)] font-semibold">Client Group:</span>
                <p className="font-mono text-[var(--accent-gold)]">{p2.derived.clientgroup || '—'}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase text-[var(--text-muted)] font-semibold">Subgroup:</span>
                <p className="font-mono text-[var(--accent-gold)]">{p2.derived.clientsubgroup || '—'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border-card)] bg-[var(--canvas-bg)]/30">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onSelectBoth(persons);
              onClose();
            }}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-[var(--text-main)] border border-white/20 transition cursor-pointer"
          >
            <Users className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
            Keep Both Persons (Add 2 Rows)
          </button>
        </div>
      </div>
    </div>
  );
}
