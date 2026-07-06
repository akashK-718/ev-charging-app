'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [animating, setAnimating] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setAnimating(true);
    timerRef.current = setTimeout(() => setAnimating(false), 260);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pathname]);

  return (
    <div key={pathname} className={animating ? 'animate-page-in' : ''}>
      {children}
    </div>
  );
}
