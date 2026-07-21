'use client';

import { useEffect, useState } from 'react';

const DONE_KEY = 'kirin_intro_done';

// Ring paths from the Kirin mark (native 416×262 coordinate space)
const LEFT_RING  = 'M 153.351 25.849 A 107.5 107.5 0 1 0 153.351 236.151 C 167.368 233.171 201.347 204.728 214.0 198.0 C 228.869 190.094 265.0 168.891 265.0 131.0 C 265.0 89.615 217.929 73.197 202.0 64.0 C 191.292 57.818 165.445 28.42 153.351 25.849 Z';
const RIGHT_RING = 'M 262.649 236.151 A 107.5 107.5 0 1 0 262.649 25.849 C 248.632 28.829 214.653 57.272 202.0 64.0 C 187.131 71.906 151.0 93.109 151.0 131.0 C 151.0 172.385 198.071 188.803 214.0 198.0 C 224.708 204.182 250.555 233.58 262.649 236.151 Z';

// Detail dash parameters that create the notch texture on the rings
const DASH_PROPS = {
  fill: 'none',
  stroke: 'var(--splash-detail)',
  strokeWidth: 5,
  pathLength: 702.988,
  strokeDasharray: '22.457 16.598',
  strokeDashoffset: 11.229,
} as const;

function KirinMark() {
  return (
    <svg viewBox="0 0 416 262" width="220" aria-hidden="true">
      <defs>
        {/*
          mL: masks the left ring — hides the segment where it goes behind the right ring.
          The right ring path (stroked black at 63px) cuts through the white reveal area.
        */}
        <mask id="si-mL" maskUnits="userSpaceOnUse" x="0" y="0" width="416" height="262">
          <rect width="416" height="262" fill="#fff" />
          <path
            d={RIGHT_RING}
            fill="none" stroke="#000" strokeWidth="63"
            pathLength="702.988" strokeDasharray="110.0 592.988" strokeDashoffset="-399.634"
          />
        </mask>
        {/* mR: masks the right ring — hides where it goes behind the left ring */}
        <mask id="si-mR" maskUnits="userSpaceOnUse" x="0" y="0" width="416" height="262">
          <rect width="416" height="262" fill="#fff" />
          <path
            d={LEFT_RING}
            fill="none" stroke="#000" strokeWidth="63"
            pathLength="702.988" strokeDasharray="110.0 592.988" strokeDashoffset="-399.634"
          />
        </mask>
      </defs>

      {/* Left ring: static, fully visible from frame 0 */}
      <g mask="url(#si-mL)">
        <path d={LEFT_RING} fill="none" stroke="var(--splash-ring)" strokeWidth="47" />
        <path d={LEFT_RING} {...DASH_PROPS} />
      </g>

      {/* Right ring: static, interlocking revealed by masks */}
      <g mask="url(#si-mR)">
        <path d={RIGHT_RING} fill="none" stroke="var(--splash-ring)" strokeWidth="47" />
        <path d={RIGHT_RING} {...DASH_PROPS} />
      </g>

      {/* Bolt: single restrained brightness pulse at 200ms */}
      <polygon
        points="216,101 188,137 202,137 197,161 228,125 211,125"
        fill="#46B055"
        className="splash-bolt-pulse"
      />
    </svg>
  );
}

type Phase = 'playing' | 'fading' | 'gone';

export function SplashIntro() {
  // Start as 'playing' so SSR and first paint show the intro immediately —
  // prevents a blank gap between the OS native splash and our custom one.
  // useEffect hides it instantly for return visits (sub-frame, imperceptible).
  const [phase, setPhase] = useState<Phase>('playing');

  useEffect(() => {
    if (sessionStorage.getItem(DONE_KEY)) {
      setPhase('gone');
      return;
    }

    const t1 = setTimeout(() => setPhase('fading'), 1000);
    const t2 = setTimeout(() => {
      setPhase('gone');
      sessionStorage.setItem(DONE_KEY, '1');
    }, 1350);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (phase === 'gone') return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--splash-bg)',
        opacity: phase === 'fading' ? 0 : 1,
        transition: phase === 'fading' ? 'opacity 350ms ease-out' : undefined,
        pointerEvents: 'none',
      }}
    >
      <KirinMark />
      <p
        className="splash-text-in"
        style={{
          marginTop: '18px',
          fontSize: '22px',
          fontWeight: 700,
          letterSpacing: '0.22em',
          color: 'var(--splash-text)',
          animationDelay: '500ms',
        }}
      >
        KIRIN
      </p>
    </div>
  );
}
