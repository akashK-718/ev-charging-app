'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, ChevronRight } from 'lucide-react';
import { userKey, purgeLegacyKey } from '@/lib/user-storage';

const STORAGE_BASE = 'kirin:home:conf-notif';

type Booking = {
  id: string;
  scheduled_start: string;
  charger: { id: string; title: string; address: string } | null;
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function readViewed(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function writeViewed(key: string, ids: Set<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {}
}

interface Props {
  bookings: Booking[];
  userId: string;
}

/**
 * Renders "Booking confirmed by host" Attention cards.
 *
 * Each card is shown exactly once — until the user taps it, which marks it
 * viewed in localStorage (`kirin:home:conf-notif:{userId}`) and hides it on
 * every subsequent Home render. Follows the KYC-approved precedent: the
 * notification's job is done once acknowledged; the Snapshot "Your next charge"
 * card persists as the permanent reminder.
 *
 * Per the three-bucket rule (user-storage.ts), this is a user-level key:
 * it must NOT be cleared on logout (the user authored the acknowledgment on
 * this device and would expect it to persist across sessions).
 */
export function ConfirmationNotifCards({ bookings, userId }: Props) {
  // null = not yet read from localStorage (skip render to avoid layout shift)
  const [unviewedIds, setUnviewedIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    purgeLegacyKey(STORAGE_BASE);
    const key = userKey(STORAGE_BASE, userId);
    const viewed = readViewed(key);
    setUnviewedIds(new Set(bookings.filter(b => !viewed.has(b.id)).map(b => b.id)));
  }, [userId, bookings]);

  if (unviewedIds === null) return null;

  function markViewed(bookingId: string) {
    const key = userKey(STORAGE_BASE, userId);
    const viewed = readViewed(key);
    viewed.add(bookingId);
    writeViewed(key, viewed);
    setUnviewedIds(prev => {
      const next = new Set(prev);
      next.delete(bookingId);
      return next;
    });
  }

  const visible = bookings.filter(b => unviewedIds.has(b.id));
  if (visible.length === 0) return null;

  return (
    <>
      {visible.map(b => (
        <Link
          key={`adc-${b.id}`}
          href={`/bookings/${b.id}/session`}
          onClick={() => markViewed(b.id)}
          className="rise-in flex items-center gap-3 bg-white border-2 border-green/20 rounded-3xl px-4 py-3.5 shadow-sm active:scale-[0.98] transition-transform"
        >
          <div className="size-9 rounded-xl bg-green-soft grid place-items-center shrink-0">
            <Calendar className="size-4 text-green" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-ink">Booking confirmed by host</p>
            <p className="text-xs text-muted truncate">
              {b.charger?.title ?? 'Charger'} &middot; {fmtDate(b.scheduled_start)} at {fmtTime(b.scheduled_start)}
            </p>
          </div>
          <ChevronRight className="size-4 text-muted shrink-0" aria-hidden />
        </Link>
      ))}
    </>
  );
}
