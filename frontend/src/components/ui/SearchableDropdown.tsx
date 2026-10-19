'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
  subtext?: string;
  badge?: string;
  badgeVariant?: 'gold' | 'emerald' | 'amber' | 'rose' | 'slate';
}

interface SearchableDropdownProps {
  label?: string;
  placeholder?: string;
  options: DropdownOption[];
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  className?: string;
}

const getBadgeClass = (variant?: 'gold' | 'emerald' | 'amber' | 'rose' | 'slate') => {
  switch (variant) {
    case 'emerald':
      return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
    case 'amber':
      return 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
    case 'rose':
      return 'bg-rose-500/15 text-rose-400 border border-rose-500/30';
    case 'slate':
      return 'bg-white/10 text-[var(--text-muted)] border border-white/15';
    case 'gold':
    default:
      return 'bg-[var(--accent-gold)]/10 text-[var(--accent-gold)] border border-[var(--accent-gold)]/20';
  }
};

export const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  label,
  placeholder = 'Select option...',
  options,
  value,
  onChange,
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close when clicked outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  const selectedOption = options.find((o) => o.value === value);

  const filteredOptions = options.filter(
    (o) =>
      o.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.subtext && o.subtext.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (o.badge && o.badge.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-mono">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-3.5 py-2.5 rounded-xl bg-[var(--input-bg)] border transition-all flex items-center justify-between gap-2 text-left cursor-pointer ${
          disabled
            ? 'opacity-40 cursor-not-allowed border-[var(--border-card)]'
            : isOpen
            ? 'border-[var(--accent-gold)] ring-1 ring-[var(--accent-gold)]/30'
            : 'border-[var(--border-card)] hover:border-[var(--accent-gold)]/60'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selectedOption ? (
            <div className="flex items-center gap-2 truncate">
              <span className="text-xs font-mono font-bold text-[var(--text-main)] truncate">
                {selectedOption.label}
              </span>
              {selectedOption.subtext && (
                <span className="text-[11px] text-[var(--text-muted)] truncate">
                  {selectedOption.subtext}
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-[var(--text-muted)] font-mono">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {selectedOption && selectedOption.badge && (
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${getBadgeClass(
                selectedOption.badgeVariant
              )}`}
            >
              {selectedOption.badge}
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-[var(--text-muted)] transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-[var(--accent-gold)]' : ''
            }`}
          />
        </div>
      </button>

      {/* Dropdown Floating Panel */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl bg-[var(--card-bg)] border border-[var(--border-card)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Search Box */}
          <div className="p-2 border-b border-[var(--border-card)] bg-[var(--input-bg)] flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 ml-1.5" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by code, name, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full py-1 text-xs font-mono bg-transparent text-[var(--text-main)] outline-none placeholder:text-[var(--text-muted)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 text-[var(--text-muted)] hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto divide-y divide-[var(--border-card)]/50 p-1">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-[var(--text-muted)] font-mono">
                No matching results found.
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full px-3 py-2 rounded-lg text-left text-xs font-mono transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--accent-gold)]/10 text-[var(--accent-gold)] font-bold'
                        : 'text-[var(--text-main)] hover:bg-white/5'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold truncate">{opt.label}</span>
                        {opt.badge && (
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold ${getBadgeClass(
                              opt.badgeVariant
                            )}`}
                          >
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.subtext && (
                        <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                          {opt.subtext}
                        </p>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[var(--accent-gold)] shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
