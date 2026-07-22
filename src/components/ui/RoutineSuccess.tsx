'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RoutineSuccessProps {
  message?: string;
  className?: string;
}

/**
 * Restrained inline success state for routine completions — booking confirmed,
 * session started/ended, profile saved, etc.
 *
 * Deliberately not celebratory: these actions can happen many times a day.
 * For one-time milestone crossings, layer <MilestoneParticles> on top instead.
 */
export function RoutineSuccess({ message = 'Done', className }: RoutineSuccessProps) {
  return (
    <div className={cn('flex flex-col items-center gap-2.5 py-5', className)}>
      <div className="w-12 h-12 rounded-full bg-green flex items-center justify-center animate-check-pop shadow-sm">
        <Check className="w-6 h-6 text-white stroke-[3]" aria-hidden />
      </div>
      <p className="text-sm font-semibold text-green">{message}</p>
    </div>
  );
}
