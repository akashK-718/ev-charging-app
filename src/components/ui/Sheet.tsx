'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Sheet({ open, onClose, title, children, className }: SheetProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      <div
        role="presentation"
        className={cn(
          'fixed inset-0 z-40 bg-ink/30 transition-opacity',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        style={{ transitionDuration: 'var(--dur-fast)' }}
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          // Mobile: full-width bottom sheet
          'fixed bottom-0 left-0 right-0 z-50 max-h-[90vh]',
          'rounded-t-[20px]',
          // Desktop: centered modal with max-width, floating above bottom edge
          'md:bottom-8 md:max-w-lg md:mx-auto md:rounded-[20px]',
          'bg-surface-0 shadow-float',
          'flex flex-col overflow-hidden',
          'transition-transform',
          open ? 'translate-y-0' : 'translate-y-full',
          className,
        )}
        style={{ transitionDuration: 'var(--dur-fast)' }}
      >
        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 shrink-0 md:hidden">
          <div className="w-10 h-1 bg-surface-2 rounded-full" />
        </div>

        {title && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <span className="text-base font-medium text-ink">{title}</span>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-1 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-ink" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </>
  );
}
