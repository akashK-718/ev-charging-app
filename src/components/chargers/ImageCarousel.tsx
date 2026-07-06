'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ImageCarouselProps {
  photos: string[];
  alt?: string;
  aspectRatio?: '16/9' | 'hero';
  autoRotate?: boolean;
  autoRotateInterval?: number;
  useIntersectionObserver?: boolean;
  className?: string;
}

export function ImageCarousel({
  photos,
  alt = 'Charger photo',
  autoRotate = true,
  autoRotateInterval = 3000,
  useIntersectionObserver: useIO = true,
  className,
}: ImageCarouselProps) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(!useIO);
  const [paused, setPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  // Stop auto-rotation for 5 s after any manual interaction
  const triggerPause = useCallback(() => {
    setPaused(true);
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = setTimeout(() => setPaused(false), 5000);
  }, []);

  const goTo = useCallback((newIndex: number, manual = false) => {
    setIndex(i => ((newIndex < 0 ? i - 1 : newIndex) % photos.length + photos.length) % photos.length);
    if (manual) triggerPause();
  }, [photos.length, triggerPause]);

  useEffect(() => () => { if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current); }, []);

  // IntersectionObserver — only run timers when tile is on-screen
  useEffect(() => {
    if (!useIO || !containerRef.current) return;
    const el = containerRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [useIO]);

  // Auto-rotate interval
  useEffect(() => {
    if (!autoRotate || photos.length <= 1 || !visible || paused) return;
    const id = setInterval(() => setIndex(i => (i + 1) % photos.length), autoRotateInterval);
    return () => clearInterval(id);
  }, [autoRotate, photos.length, visible, paused, autoRotateInterval]);

  // Touch swipe
  function handleTouchStart(e: React.TouchEvent) {
    touchStartXRef.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartXRef.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (Math.abs(dx) < 30) return;
    goTo(dx < 0 ? index + 1 : index - 1, true);
  }

  if (photos.length === 0) {
    return (
      <div
        ref={containerRef}
        className={cn(
          'relative w-full aspect-[16/9] overflow-hidden bg-volt-soft flex items-center justify-center',
          className,
        )}
      >
        <Zap className="w-16 h-16 text-volt opacity-30" />
      </div>
    );
  }

  if (photos.length === 1) {
    return (
      <div ref={containerRef} className={cn('relative w-full aspect-[16/9] overflow-hidden', className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photos[0]} alt={alt} className="absolute inset-0 w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full aspect-[16/9] overflow-hidden', className)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Slides */}
      <div
        className="flex h-full transition-transform duration-300 ease-out will-change-transform"
        style={{ transform: `translateX(-${(index * 100) / photos.length}%)`, width: `${photos.length * 100}%` }}
      >
        {photos.map((url, i) => (
          <div key={i} className="relative h-full shrink-0" style={{ width: `${100 / photos.length}%` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`${alt} ${i + 1}`} className="absolute inset-0 w-full h-full object-cover" />
          </div>
        ))}
      </div>

      {/* Desktop chevrons — hidden on mobile */}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); goTo(index - 1, true); }}
        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-full hidden sm:flex items-center justify-center transition-colors"
        aria-label="Previous photo"
      >
        <ChevronLeft className="w-4 h-4 text-white" />
      </button>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); goTo(index + 1, true); }}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-full hidden sm:flex items-center justify-center transition-colors"
        aria-label="Next photo"
      >
        <ChevronRight className="w-4 h-4 text-white" />
      </button>

      {/* Dot indicators */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-none">
        {photos.map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-1.5 rounded-full bg-white transition-all duration-200',
              i === index ? 'w-3 opacity-100' : 'w-1.5 opacity-60',
            )}
          />
        ))}
      </div>
    </div>
  );
}
