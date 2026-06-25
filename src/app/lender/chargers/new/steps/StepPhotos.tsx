'use client';

import { useState, useEffect, useRef } from 'react';
import { ImagePlus, X, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NewChargerDraft } from '@/types/charger-draft';

const MAX_PHOTOS = 5;
const MIN_PHOTOS = 1;

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

// ── Types ──────────────────────────────────────────────────────────────────────

interface PhotoItem {
  id: string;
  previewUrl: string; // local blob URL (during upload) or Cloudinary URL (after)
  cloudinaryUrl?: string; // set after successful upload
  progress: number; // 0-100
  error?: string;
}

interface StepPhotosProps {
  draft: Partial<NewChargerDraft>;
  onChange: (updates: Partial<NewChargerDraft>) => void;
  onValidChange: (valid: boolean) => void;
}

// ── Cloudinary upload ──────────────────────────────────────────────────────────

function uploadToCloudinary(
  file: File,
  onProgress: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      reject(new Error('Cloudinary is not configured. Add NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET to .env.local'));
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('folder', 'ev-chargers');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`);

    xhr.upload.onprogress = e => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 90));
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText) as { secure_url: string };
          onProgress(100);
          resolve(data.secure_url);
        } catch {
          reject(new Error('Unexpected response from Cloudinary'));
        }
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(formData);
  });
}

// ── Component ──────────────────────────────────────────────────────────────────

export function StepPhotos({ draft, onChange, onValidChange }: StepPhotosProps) {
  // Initialise from saved Cloudinary URLs if the user navigates back to this step.
  const [photos, setPhotos] = useState<PhotoItem[]>(() =>
    (draft.photos ?? []).map(url => ({
      id: url,
      previewUrl: url,
      cloudinaryUrl: url,
      progress: 100,
    })),
  );
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag-to-reorder state
  const dragIndex = useRef<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  const uploadedUrls = photos
    .map(p => p.cloudinaryUrl)
    .filter(Boolean) as string[];

  const allUploaded = photos.length > 0 && photos.every(p => p.cloudinaryUrl);
  const isValid = allUploaded && uploadedUrls.length >= MIN_PHOTOS;

  useEffect(() => {
    onValidChange(isValid);
  }, [isValid, onValidChange]);

  // Sync completed uploads to draft.
  useEffect(() => {
    if (allUploaded) onChange({ photos: uploadedUrls });
    // Intentionally omitting onChange from deps — it's a stable ref from the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allUploaded, uploadedUrls.join(',')]);

  // ── File handling ────────────────────────────────────────────────────────────

  function addFiles(files: FileList | File[]) {
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    const slotsLeft = MAX_PHOTOS - photos.length;
    const toAdd = fileArray.slice(0, slotsLeft);
    if (toAdd.length === 0) return;

    const newItems: PhotoItem[] = toAdd.map(file => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      previewUrl: URL.createObjectURL(file),
      progress: 0,
    }));

    setPhotos(prev => [...prev, ...newItems]);

    // Start uploading each file immediately.
    newItems.forEach(item => {
      const file = toAdd[newItems.indexOf(item)];
      uploadToCloudinary(file, pct => {
        setPhotos(prev =>
          prev.map(p => (p.id === item.id ? { ...p, progress: pct } : p)),
        );
      })
        .then(url => {
          setPhotos(prev =>
            prev.map(p =>
              p.id === item.id
                ? { ...p, cloudinaryUrl: url, previewUrl: url, progress: 100 }
                : p,
            ),
          );
        })
        .catch((err: Error) => {
          setPhotos(prev =>
            prev.map(p =>
              p.id === item.id
                ? { ...p, error: err.message ?? 'Upload failed. Tap × and try again.' }
                : p,
            ),
          );
        });
    });
  }

  function removePhoto(id: string) {
    setPhotos(prev => {
      const removed = prev.find(p => p.id === id);
      if (removed?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(removed.previewUrl);
      const next = prev.filter(p => p.id !== id);
      onChange({ photos: next.map(p => p.cloudinaryUrl).filter(Boolean) as string[] });
      return next;
    });
  }

  // ── Drop-zone events (for files from OS) ─────────────────────────────────────

  function handleDropZoneDragOver(e: React.DragEvent) {
    // Only treat this as a file drop if it contains files (not a thumbnail drag).
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setIsDragOver(true);
    }
  }

  function handleDropZoneDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }

  // ── Thumbnail drag-to-reorder ─────────────────────────────────────────────

  function handleThumbDragStart(e: React.DragEvent, index: number) {
    dragIndex.current = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }

  function handleThumbDragOver(e: React.DragEvent, index: number) {
    if (dragIndex.current === null || dragIndex.current === index) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetIndex(index);
  }

  function handleThumbDrop(e: React.DragEvent, targetIndex: number) {
    e.preventDefault();
    const sourceIndex = dragIndex.current;
    if (sourceIndex === null || sourceIndex === targetIndex) {
      dragIndex.current = null;
      setDropTargetIndex(null);
      return;
    }
    setPhotos(prev => {
      const next = [...prev];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      onChange({ photos: next.map(p => p.cloudinaryUrl).filter(Boolean) as string[] });
      return next;
    });
    dragIndex.current = null;
    setDropTargetIndex(null);
  }

  function handleThumbDragEnd() {
    dragIndex.current = null;
    setDropTargetIndex(null);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div>
      <h1 className="font-display font-extrabold text-3xl text-ink">Photos</h1>
      <p className="mt-2 text-base text-muted">
        Add at least 1 photo. The first photo is the cover.
      </p>

      {/* Drop zone — only shown when slots are available */}
      {photos.length < MAX_PHOTOS && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload photos"
          onDragOver={handleDropZoneDragOver}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDropZoneDrop}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
          className={cn(
            'mt-8 w-full rounded-2xl border-2 border-dashed cursor-pointer',
            'flex flex-col items-center justify-center gap-2 py-10 transition-colors',
            isDragOver
              ? 'border-volt bg-volt-soft'
              : 'border-gray-300 bg-gray-50 hover:border-gray-400',
          )}
        >
          <ImagePlus className={cn('w-8 h-8', isDragOver ? 'text-volt-deep' : 'text-muted')} />
          <p className="text-sm font-semibold text-ink">
            {isDragOver ? 'Drop to upload' : 'Tap to add photos'}
          </p>
          <p className="text-xs text-muted">or drag and drop · max {MAX_PHOTOS} photos</p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => {
          if (e.target.files) {
            addFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {/* Thumbnails */}
      {photos.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-semibold text-ink mb-3">
            {photos.length} / {MAX_PHOTOS} photos
            {photos.length > 0 && ' · drag to reorder'}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {photos.map((photo, index) => (
              <div
                key={photo.id}
                draggable
                onDragStart={e => handleThumbDragStart(e, index)}
                onDragOver={e => handleThumbDragOver(e, index)}
                onDrop={e => handleThumbDrop(e, index)}
                onDragEnd={handleThumbDragEnd}
                className={cn(
                  'relative rounded-2xl overflow-hidden aspect-[4/3] bg-gray-100',
                  'border-2 transition-all',
                  dropTargetIndex === index ? 'border-volt scale-[0.97]' : 'border-transparent',
                  index === 0 && 'col-span-2 aspect-video',
                )}
              >
                {/* Preview image */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.previewUrl}
                  alt={`Photo ${index + 1}`}
                  className="w-full h-full object-cover"
                />

                {/* Cover badge */}
                {index === 0 && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 bg-ink/70 text-white text-xs font-semibold rounded-lg">
                    Cover
                  </span>
                )}

                {/* Drag handle */}
                <span className="absolute top-2 right-8 p-1 bg-white/70 rounded-lg cursor-grab active:cursor-grabbing">
                  <GripVertical className="w-4 h-4 text-ink" />
                </span>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => removePhoto(photo.id)}
                  className="absolute top-2 right-2 w-6 h-6 bg-white/70 rounded-lg flex items-center justify-center hover:bg-white transition-colors"
                  aria-label="Remove photo"
                >
                  <X className="w-3.5 h-3.5 text-ink" />
                </button>

                {/* Upload progress overlay */}
                {photo.progress < 100 && !photo.error && (
                  <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2">
                    <div className="w-3/4 h-1.5 bg-white/30 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-volt rounded-full transition-[width] duration-150"
                        style={{ width: `${photo.progress}%` }}
                      />
                    </div>
                    <p className="text-white text-xs font-semibold">{photo.progress}%</p>
                  </div>
                )}

                {/* Error overlay */}
                {photo.error && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-3">
                    <p className="text-white text-xs font-semibold text-center leading-snug">
                      {photo.error}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Validation hint */}
      {photos.length === 0 && (
        <p className="mt-4 text-xs text-muted">Add at least one photo to continue.</p>
      )}

      {photos.some(p => !p.cloudinaryUrl && !p.error) && (
        <p className="mt-3 text-xs text-muted font-semibold">
          Uploading… wait for all photos to finish before continuing.
        </p>
      )}
    </div>
  );
}
