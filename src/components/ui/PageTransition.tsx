'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [animating, setAnimating] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // useLayoutEffect (not useEffect) so the animation class is applied before the
  // browser's first paint of the incoming route — prevents a one-frame flash of
  // un-animated content. Safe here because PageTransition is 'use client' only.
  //
  // key={pathname} was removed from the wrapper div. The old approach caused
  // AuthFlow to remount prematurely when Next.js 14's optimistic navigation
  // updated usePathname() before the RSC payload arrived, triggering a second
  // router.replace('/home') from AuthFlow's mount effect and leaving the URL at
  // /home while the page content stayed stuck on /auth. Without the key, the div
  // persists across navigations; children update atomically when the transition
  // commits, so page components unmount/mount correctly without the race.
  useLayoutEffect(() => {
    setAnimating(true);
    timerRef.current = setTimeout(() => setAnimating(false), 120);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pathname]);

  return (
    <div className={animating ? 'animate-page-in' : ''}>
      {children}
    </div>
  );
}
