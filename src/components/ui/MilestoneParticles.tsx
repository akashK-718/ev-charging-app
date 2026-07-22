'use client';

import { useEffect, useRef } from 'react';

interface Particle {
  char: string;
  dx: string;
  dy: string;
  delay: number;
  size: string;
  color: string;
}

// 8 particles at cardinal + diagonal directions; mix of bolt and green-dot shapes.
// Bolt (⚡) = EV/charging motif. Green dot (●) = eco/Kirin brand color.
const PARTICLES: Particle[] = [
  { char: '⚡', dx: '0px',   dy: '-58px',  delay: 0,   size: '13px', color: '#1c6b47' },
  { char: '●',  dx: '41px',  dy: '-41px',  delay: 40,  size: '9px',  color: '#1c6b47' },
  { char: '⚡', dx: '58px',  dy: '0px',    delay: 80,  size: '11px', color: '#124a30' },
  { char: '●',  dx: '41px',  dy: '41px',   delay: 120, size: '8px',  color: '#e7f2ec' },
  { char: '⚡', dx: '0px',   dy: '58px',   delay: 160, size: '13px', color: '#1c6b47' },
  { char: '●',  dx: '-41px', dy: '41px',   delay: 200, size: '9px',  color: '#124a30' },
  { char: '⚡', dx: '-58px', dy: '0px',    delay: 240, size: '11px', color: '#1c6b47' },
  { char: '●',  dx: '-41px', dy: '-41px',  delay: 280, size: '8px',  color: '#e7f2ec' },
];

const TOTAL_DURATION_MS = 600 + 280 + 50; // last particle delay + animation + buffer

interface MilestoneParticlesProps {
  onComplete?: () => void;
}

/**
 * Kirin-themed particle burst for milestone crossings.
 * MUST be placed inside a `position:relative overflow:hidden` container —
 * particles expand outward up to ~58px from center and are clipped by overflow:hidden.
 *
 * Hard rule: only fire for the fixed milestone list in src/lib/milestones.ts.
 * If an action can plausibly happen 10+ times in a day, do NOT use this component.
 */
export function MilestoneParticles({ onComplete }: MilestoneParticlesProps) {
  const calledRef = useRef(false);

  // Skip entirely when user prefers reduced motion
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (calledRef.current) return;
    const timer = setTimeout(() => {
      calledRef.current = true;
      onComplete?.();
    }, TOTAL_DURATION_MS);
    return () => clearTimeout(timer);
  }, [onComplete]);

  if (prefersReduced) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ overflow: 'hidden' }}
    >
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="milestone-particle"
          style={
            {
              '--mp-dx': p.dx,
              '--mp-dy': p.dy,
              animationDelay: `${p.delay}ms`,
              fontSize: p.size,
              color: p.color,
            } as React.CSSProperties
          }
        >
          {p.char}
        </span>
      ))}
    </div>
  );
}
