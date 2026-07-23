'use client';

import { useState, useEffect } from 'react';

/**
 * Shown only when a host views their own public listing via "View public listing."
 * Scrolls away naturally as the user reads the page — no X button, no modal.
 * Scroll-dismiss threshold is 60px: enough to clear the banner height (~44px)
 * with a small buffer, so accidental micro-scrolls don't hide it immediately.
 */
export function OwnerPreviewBanner() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!visible) return;
    function onScroll() {
      if (window.scrollY > 60) setVisible(false);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-10 flex items-center gap-2.5 bg-green-soft border-b border-green/20 px-4 py-2.5"
    >
      <span aria-hidden className="text-base leading-none">👁</span>
      <p className="text-[13px] font-medium text-green-deep leading-snug">
        Previewing your public listing — This is how drivers see your charger.
      </p>
    </div>
  );
}
