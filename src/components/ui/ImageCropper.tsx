'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';

export interface ImageCropperProps {
  file: File | null;
  aspectRatio: '4:3' | '1:1';
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

const MAX_OUTPUT_WIDTH = 1200;
const OUTPUT_QUALITY = 0.8;
const MIN_SCALE = 1;
const MAX_SCALE = 5;

function cropToCanvas(
  image: HTMLImageElement,
  cropX: number, cropY: number,
  cropWidth: number, cropHeight: number,
  outputWidth: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const ratio = outputWidth / cropWidth;
  canvas.width = Math.round(outputWidth);
  canvas.height = Math.round(cropHeight * ratio);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
  return new Promise(resolve =>
    canvas.toBlob(blob => resolve(blob!), 'image/jpeg', OUTPUT_QUALITY),
  );
}

type Point = { clientX: number; clientY: number };

function dist(t1: Point, t2: Point) {
  return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
}

function midpoint(t1: Point, t2: Point) {
  return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
}

interface Metrics {
  cW: number; cH: number;
  boxW: number; boxH: number;
  boxLeft: number; boxTop: number;
  natW: number; natH: number;
  fitScale: number;
}

export function ImageCropper({ file, aspectRatio, onConfirm, onCancel }: ImageCropperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Current crop state — kept in refs so gesture handlers never go stale
  const txRef = useRef(0);
  const tyRef = useRef(0);
  const scaleRef = useRef(MIN_SCALE);
  const metricsRef = useRef<Metrics | null>(null);

  // Gesture refs
  const panRef = useRef<{ mx: number; my: number; tx: number; ty: number } | null>(null);
  const pinchRef = useRef<{ d0: number; s0: number; cx: number; cy: number; tx: number; ty: number } | null>(null);

  const [arW, arH] = aspectRatio === '4:3' ? [4, 3] : [1, 1];

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    setLoaded(false);
    setLoadError(false);
    txRef.current = 0;
    tyRef.current = 0;
    scaleRef.current = MIN_SCALE;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function buildMetrics(): Metrics | null {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img) return null;
    const cW = container.clientWidth;
    const cH = container.clientHeight;
    const boxW = Math.round(Math.min(cW * 0.88, cH * 0.88 * (arW / arH)));
    const boxH = Math.round(boxW * arH / arW);
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    if (!natW || !natH) return null;
    const fitScale = Math.max(boxW / natW, boxH / natH);
    const boxLeft = (cW - boxW) / 2;
    const boxTop = (cH - boxH) / 2;
    return { cW, cH, boxW, boxH, boxLeft, boxTop, natW, natH, fitScale };
  }

  function applyToImg(tx: number, ty: number, scale: number, m: Metrics) {
    const img = imgRef.current;
    if (!img) return;
    const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
    const displayW = m.natW * m.fitScale * clampedScale;
    const displayH = m.natH * m.fitScale * clampedScale;
    const maxTx = Math.max(0, (displayW - m.boxW) / 2);
    const maxTy = Math.max(0, (displayH - m.boxH) / 2);
    const clampedTx = Math.max(-maxTx, Math.min(maxTx, tx));
    const clampedTy = Math.max(-maxTy, Math.min(maxTy, ty));
    txRef.current = clampedTx;
    tyRef.current = clampedTy;
    scaleRef.current = clampedScale;
    const left = m.cW / 2 + clampedTx - displayW / 2;
    const top = m.cH / 2 + clampedTy - displayH / 2;
    img.style.left = `${left}px`;
    img.style.top = `${top}px`;
    img.style.width = `${displayW}px`;
    img.style.height = `${displayH}px`;
  }

  function handleImageLoad() {
    setLoaded(true);
    requestAnimationFrame(() => {
      const m = buildMetrics();
      if (!m) return;
      metricsRef.current = m;
      applyToImg(0, 0, MIN_SCALE, m);
    });
  }

  // Non-passive touchmove — must be attached via useEffect to call preventDefault
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !loaded) return;

    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      const m = metricsRef.current;
      if (!m) return;

      if (e.touches.length === 1 && panRef.current) {
        const dx = e.touches[0].clientX - panRef.current.mx;
        const dy = e.touches[0].clientY - panRef.current.my;
        applyToImg(panRef.current.tx + dx, panRef.current.ty + dy, scaleRef.current, m);
      } else if (e.touches.length === 2 && pinchRef.current) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const newScale = pinchRef.current.s0 * (dist(t1, t2) / pinchRef.current.d0);
        const mid = midpoint(t1, t2);
        const dx = mid.x - pinchRef.current.cx;
        const dy = mid.y - pinchRef.current.cy;
        applyToImg(pinchRef.current.tx + dx, pinchRef.current.ty + dy, newScale, m);
      }
    }

    container.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => container.removeEventListener('touchmove', onTouchMove);
  }, [loaded]);

  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 1) {
      panRef.current = { mx: e.touches[0].clientX, my: e.touches[0].clientY, tx: txRef.current, ty: tyRef.current };
      pinchRef.current = null;
    } else if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const mid = midpoint(t1, t2);
      pinchRef.current = { d0: dist(t1, t2), s0: scaleRef.current, cx: mid.x, cy: mid.y, tx: txRef.current, ty: tyRef.current };
      panRef.current = null;
    }
  }

  function handleTouchEnd() {
    panRef.current = null;
    pinchRef.current = null;
  }

  function handleMouseDown(e: React.MouseEvent) {
    panRef.current = { mx: e.clientX, my: e.clientY, tx: txRef.current, ty: tyRef.current };
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!panRef.current) return;
    const m = metricsRef.current;
    if (!m) return;
    applyToImg(panRef.current.tx + (e.clientX - panRef.current.mx), panRef.current.ty + (e.clientY - panRef.current.my), scaleRef.current, m);
  }

  function handleMouseUp() { panRef.current = null; }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const m = metricsRef.current;
    if (!m) return;
    applyToImg(txRef.current, tyRef.current, scaleRef.current * (e.deltaY > 0 ? 0.9 : 1.1), m);
  }

  async function handleConfirm() {
    const m = metricsRef.current;
    const img = imgRef.current;
    if (!m || !img || confirming) return;
    setConfirming(true);
    try {
      const scale = scaleRef.current;
      const tx = txRef.current;
      const ty = tyRef.current;
      const displayW = m.natW * m.fitScale * scale;
      const displayH = m.natH * m.fitScale * scale;
      const imgLeft = m.cW / 2 + tx - displayW / 2;
      const imgTop = m.cH / 2 + ty - displayH / 2;
      const pixelScale = m.fitScale * scale;
      const srcX = Math.max(0, (m.boxLeft - imgLeft) / pixelScale);
      const srcY = Math.max(0, (m.boxTop - imgTop) / pixelScale);
      const srcW = Math.min(m.natW - srcX, m.boxW / pixelScale);
      const srcH = Math.min(m.natH - srcY, m.boxH / pixelScale);
      const outputW = Math.min(MAX_OUTPUT_WIDTH, Math.round(srcW));
      const blob = await cropToCanvas(img, srcX, srcY, srcW, srcH, outputW);
      onConfirm(blob);
    } finally {
      setConfirming(false);
    }
  }

  if (!file) return null;

  const m = loaded ? buildMetrics() : null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <button type="button" onClick={onCancel} className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white" aria-label="Cancel">
          <X className="w-5 h-5" />
        </button>
        <p className="text-white text-sm font-semibold">Crop photo</p>
        <div className="w-10" />
      </div>

      {/* Preview area */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden select-none cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {imgSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={imgSrc}
            alt="Crop preview"
            draggable={false}
            className="absolute"
            style={{ userSelect: 'none', pointerEvents: 'none' }}
            onLoad={handleImageLoad}
            onError={() => setLoadError(true)}
          />
        )}

        {!loaded && !loadError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-white/50 text-sm">Loading…</p>
          </div>
        )}

        {loadError && (
          <div className="absolute inset-0 flex items-center justify-center px-8 text-center">
            <p className="text-white/70 text-sm">This file format cannot be previewed. Tap &quot;Crop &amp; upload&quot; to upload it directly.</p>
          </div>
        )}

        {/* Crop overlay */}
        {m && (
          <>
            <div className="absolute inset-x-0 top-0 bg-black/55 pointer-events-none" style={{ height: m.boxTop }} />
            <div className="absolute inset-x-0 bottom-0 bg-black/55 pointer-events-none" style={{ height: m.boxTop }} />
            <div className="absolute left-0 bg-black/55 pointer-events-none" style={{ top: m.boxTop, width: m.boxLeft, height: m.boxH }} />
            <div className="absolute right-0 bg-black/55 pointer-events-none" style={{ top: m.boxTop, width: m.boxLeft, height: m.boxH }} />
            {/* Crop border */}
            <div className="absolute border-2 border-white/80 pointer-events-none" style={{ left: m.boxLeft, top: m.boxTop, width: m.boxW, height: m.boxH }}>
              {/* Rule-of-thirds grid */}
              <div className="absolute inset-0 pointer-events-none" style={{ borderRight: '1px solid rgba(255,255,255,0.2)', width: '33.33%' }} />
              <div className="absolute inset-0 pointer-events-none" style={{ borderRight: '1px solid rgba(255,255,255,0.2)', width: '66.67%' }} />
              <div className="absolute inset-0 pointer-events-none" style={{ borderBottom: '1px solid rgba(255,255,255,0.2)', height: '33.33%' }} />
              <div className="absolute inset-0 pointer-events-none" style={{ borderBottom: '1px solid rgba(255,255,255,0.2)', height: '66.67%' }} />
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-5 shrink-0">
        <p className="text-white/40 text-xs text-center mb-4">Drag to reposition · pinch or scroll to zoom</p>
        <button
          type="button"
          onClick={() => { void handleConfirm(); }}
          disabled={confirming}
          className="w-full flex items-center justify-center gap-2 bg-white text-black font-semibold text-sm py-3.5 rounded-xl disabled:opacity-50 transition-opacity"
        >
          <Check className="w-4 h-4" />
          {confirming ? 'Processing…' : 'Crop & upload'}
        </button>
      </div>
    </div>
  );
}
