export const PWA_NUDGE_KEY = 'pwa_install_nudge_v1';
const LATER_MS = 10 * 24 * 60 * 60 * 1000; // 10 days

export type PwaDismissal =
  | { mode: 'never' }
  | { mode: 'later'; until: number };

export function readPwaDismissal(): PwaDismissal | null {
  try {
    const raw = localStorage.getItem(PWA_NUDGE_KEY);
    return raw ? (JSON.parse(raw) as PwaDismissal) : null;
  } catch {
    return null;
  }
}

export function writePwaDismissal(mode: 'later' | 'never') {
  try {
    const value: PwaDismissal =
      mode === 'later' ? { mode, until: Date.now() + LATER_MS } : { mode: 'never' };
    localStorage.setItem(PWA_NUDGE_KEY, JSON.stringify(value));
  } catch {}
}

export function clearPwaDismissal() {
  try {
    localStorage.removeItem(PWA_NUDGE_KEY);
  } catch {}
}
