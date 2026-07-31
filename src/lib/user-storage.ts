/**
 * Client-side storage scoping utilities.
 *
 * Three-bucket rule — every key that persists user-derived data MUST fall into
 * exactly one bucket. Adding new persisted state? Pick a bucket before writing.
 *
 * | Bucket        | Scope      | Current keys                               | On logout           |
 * |---------------|------------|--------------------------------------------|---------------------|
 * | Device-level  | Device     | pwa_install_nudge_v1                       | Untouched           |
 * |               |            | kirin_intro_done (sessionStorage)          |                     |
 * | User-level    | User ID    | kirin:milestones:{userId}                  | NOT cleared —       |
 * |               |            | lender:new-charger:draft:{userId}          | persists for that   |
 * |               |            |                                            | user on next login  |
 * | Session-level | Auth token | Supabase access/refresh tokens, OTP state  | Cleared by          |
 * |               |            | kirin:explore:mode (sessionStorage)        | supabase.signOut()  |
 * |               |            | kirin:explore:near_me (sessionStorage)     | + clearExploreSession() |
 * |               |            | kirin:explore:along_route (sessionStorage) |                     |
 *
 * User-level keys use the pattern `{base}:{userId}` via `userKey()`.
 * On first load, call `purgeLegacyKey(base)` for any key that was previously
 * written without a userId suffix — data that can't be attributed to a specific
 * user must not be carried forward.
 */

/** Returns a user-scoped storage key: `{base}:{userId}` */
export function userKey(base: string, userId: string): string {
  return `${base}:${userId}`;
}

/**
 * Deletes a legacy unscoped localStorage key if present.
 * Never migrates the value — unverifiable data must not be inherited by
 * whoever happens to be logged in next on this device.
 */
export function purgeLegacyKey(key: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (localStorage.getItem(key) !== null) {
      localStorage.removeItem(key);
    }
  } catch {}
}

/**
 * Clears all Explore session-scoped keys from sessionStorage.
 * Call this in every signOut handler so search state from the previous
 * session is never shown to the next user on the same tab.
 */
export function clearExploreSession(): void {
  try {
    sessionStorage.removeItem('kirin:explore:mode');
    sessionStorage.removeItem('kirin:explore:near_me');
    sessionStorage.removeItem('kirin:explore:along_route');
  } catch {}
}
