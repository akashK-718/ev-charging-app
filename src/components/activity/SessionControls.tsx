'use client';

import { FILTER_LABELS, SORT_LABELS, applyFilter } from '@/lib/activity/selectors';
import { cn } from '@/lib/utils';
import type { FilterType, HistoryItem, SortDir } from '@/types/activity';
import { ArrowUpDown, Check, ChevronDown, Filter, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function FilterButton({ filter, onClick }: { filter: FilterType; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 flex items-center gap-1.5 h-8 px-3.5 rounded-full text-xs font-medium border transition-colors active:scale-95',
        filter !== 'all'
          ? 'bg-green text-white border-green'
          : 'bg-surface-card text-ink border-border hover:bg-surface-page',
      )}
    >
      <Filter className="w-3 h-3 shrink-0" />
      <span className="flex-1 text-left">{FILTER_LABELS[filter]}</span>
      <ChevronDown className="w-3 h-3 shrink-0" />
    </button>
  );
}

// ── Filter bottom sheet ───────────────────────────────────────────────────────

export function SessionFilterSheet({
  isOpen, items, filter, onSelect, onClose,
}: {
  isOpen: boolean;
  items: HistoryItem[];
  filter: FilterType;
  onSelect: (f: FilterType) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  const now = new Date().toISOString();
  const counts: Record<FilterType, number> = {
    all: applyFilter(items, 'all', now).length,
    upcoming: applyFilter(items, 'upcoming', now).length,
    completed: applyFilter(items, 'completed', now).length,
    cancelled: applyFilter(items, 'cancelled', now).length,
  };

  const options: { key: FilterType; label: string }[] = [
    { key: 'all',       label: 'All' },
    { key: 'upcoming',  label: 'Upcoming' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 bg-black/40 z-40 transition-opacity duration-200',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 bg-surface-card rounded-t-2xl shadow-2xl',
          'transition-transform duration-300 ease-out',
          isOpen ? 'translate-y-0' : 'translate-y-full',
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Filter sessions"
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <div className="flex items-center px-4 pb-3 pt-1">
          <h2 className="font-semibold text-ink text-base flex-1">Filter sessions</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-surface-page transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-muted" />
          </button>
        </div>
        <div className="pb-8">
          {options.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => { onSelect(key); onClose(); }}
              className="w-full flex items-center px-4 py-3.5 text-sm font-semibold text-ink hover:bg-surface-page transition-colors"
            >
              <span className="flex-1 text-left">{label}</span>
              <span className="text-muted text-xs font-normal mr-3">{counts[key]}</span>
              <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                {filter === key && <Check className="w-4 h-4 text-ink" />}
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Sort button — GreenPath Chip style ────────────────────────────────────────

export function SortButton({ sort, onChange }: { sort: SortDir; onChange: (s: SortDir) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1.5 h-8 px-3.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap active:scale-95',
          open ? 'bg-green text-white border-green' : 'bg-surface-card text-ink border-border hover:bg-surface-page',
        )}
      >
        <ArrowUpDown className="w-3 h-3 shrink-0" />
        {SORT_LABELS[sort]}
        <ChevronDown className={cn('w-3 h-3 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-surface-card border border-border rounded-xl py-1 z-20 min-w-[130px] shadow-md">
          {(['newest', 'oldest'] as SortDir[]).map(key => (
            <button
              key={key}
              type="button"
              onClick={() => { onChange(key); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-ink hover:bg-surface-page transition-colors"
            >
              <span className="flex-1 text-left">{SORT_LABELS[key]}</span>
              {sort === key && <Check className="w-3.5 h-3.5 text-ink shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
