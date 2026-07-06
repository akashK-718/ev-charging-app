/**
 * Cloudinary URL helpers for client-side image rendering.
 */

/**
 * Adds f_jpg,q_auto transformations to a Cloudinary URL so that HEIC and
 * other non-browser-renderable formats are served as JPEG on delivery.
 * Safe to call on any URL — non-Cloudinary URLs are returned unchanged.
 * Idempotent — never double-inserts the transformation.
 */
export function toJpegUrl(url: string): string {
  if (!url?.includes('res.cloudinary.com')) return url;
  if (url.includes('/upload/f_jpg')) return url;
  return url.replace('/upload/', '/upload/f_jpg,q_auto/');
}
