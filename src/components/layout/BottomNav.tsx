'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, Wallet, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/', icon: Home, label: 'Explore' },
  { href: '/bookings', icon: Calendar, label: 'Bookings' },
  { href: '/wallet', icon: Wallet, label: 'Wallet' },
  { href: '/profile', icon: User, label: 'Profile' }
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around py-2 z-50">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'flex flex-col items-center gap-1 px-3 py-1 text-xs font-bold',
              active ? 'text-volt-deep' : 'text-muted'
            )}
          >
            <Icon className="w-5 h-5" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
