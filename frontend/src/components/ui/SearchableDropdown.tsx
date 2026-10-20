'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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

const mapBadgeVariant = (variant?: 'gold' | 'emerald' | 'amber' | 'rose' | 'slate'): 'gold' | 'emerald' | 'amber' | 'destructive' | 'secondary' => {
  switch (variant) {
    case 'emerald':
      return 'emerald';
    case 'amber':
      return 'amber';
    case 'rose':
      return 'destructive';
    case 'slate':
      return 'secondary';
    case 'gold':
    default:
      return 'gold';
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
      const timer = setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
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
    <div className={cn('relative', className)} ref={containerRef}>
      {label && (
        <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 font-mono">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          'w-full px-3.5 py-2.5 rounded-xl bg-input border transition-all flex items-center justify-between gap-2 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring select-none',
          disabled
            ? 'opacity-40 cursor-not-allowed border-border'
            : isOpen
            ? 'border-primary ring-1 ring-primary/30'
            : 'border-border hover:border-primary/60'
        )}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selectedOption ? (
            <div className="flex items-center gap-2 truncate">
              <span className="text-xs font-mono font-bold text-foreground truncate">
                {selectedOption.label}
              </span>
              {selectedOption.subtext && (
                <span className="text-[11px] text-muted-foreground truncate">
                  {selectedOption.subtext}
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground font-mono">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {selectedOption && selectedOption.badge && (
            <Badge variant={mapBadgeVariant(selectedOption.badgeVariant)} className="text-[10px] px-2">
              {selectedOption.badge}
            </Badge>
          )}
          <ChevronDown
            className={cn(
              'size-4 text-muted-foreground transition-transform duration-200',
              isOpen && 'rotate-180 text-primary'
            )}
          />
        </div>
      </button>

      {/* Dropdown Floating Panel */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl bg-card border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Search Box */}
          <div className="p-2 border-b border-border bg-input/70 flex items-center gap-2">
            <Search className="size-3.5 text-muted-foreground shrink-0 ml-1.5" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by code, name, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full py-1 text-xs font-mono bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto divide-y divide-border/40 p-1">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground font-mono">
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
                    className={cn(
                      'w-full px-3 py-2 rounded-lg text-left text-xs font-mono transition-colors flex items-center justify-between gap-2 cursor-pointer',
                      isSelected
                        ? 'bg-primary/10 text-primary font-bold'
                        : 'text-foreground hover:bg-accent/50'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold truncate">{opt.label}</span>
                        {opt.badge && (
                          <Badge
                            variant={mapBadgeVariant(opt.badgeVariant)}
                            className="text-[9px] px-1.5 py-0"
                          >
                            {opt.badge}
                          </Badge>
                        )}
                      </div>
                      {opt.subtext && (
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {opt.subtext}
                        </p>
                      )}
                    </div>
                    {isSelected && <Check className="size-4 text-primary shrink-0" />}
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
