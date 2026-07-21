'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sunrise, Sun, Sunset, Moon } from 'lucide-react';

function getGreeting(h: number): string {
  if (h >= 6 && h < 12) return 'Good morning';
  if (h >= 12 && h < 18) return 'Good afternoon';
  return 'Good evening';
}

function getIcon(h: number) {
  if (h >= 6 && h < 12) return <Sunrise className="size-5 text-white" aria-hidden />;
  if (h >= 12 && h < 18) return <Sun className="size-5 text-white" aria-hidden />;
  if (h >= 18 && h < 22) return <Sunset className="size-5 text-white" aria-hidden />;
  return <Moon className="size-5 text-white" aria-hidden />;
}

interface Props {
  firstName: string;
  avatarInitials: string;
}

export function GreetingHeader({ firstName, avatarInitials }: Props) {
  // Initialize to 0 so SSR and first client render agree — useEffect
  // updates to the real device hour immediately after hydration.
  const [hour, setHour] = useState(0);

  useEffect(() => {
    setHour(new Date().getHours());
  }, []);

  return (
    <div className="flex items-center gap-3 pb-1">
      <div className="size-10 rounded-2xl bg-green grid place-items-center shadow-md shadow-green-900/20 shrink-0">
        {getIcon(hour)}
      </div>
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-bold leading-tight text-ink">
          {getGreeting(hour)}, {firstName}
        </h1>
      </div>
      <Link href="/profile" aria-label="Go to profile" className="shrink-0 active:scale-95 transition">
        <div className="size-10 rounded-full bg-green-700 grid place-items-center text-white text-sm font-semibold">
          {avatarInitials}
        </div>
      </Link>
    </div>
  );
}
