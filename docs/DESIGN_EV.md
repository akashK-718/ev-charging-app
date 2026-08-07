# EV App — Interaction & Motion Baseline

> **`/design` is the canonical source of truth** for all visual tokens (colors, radius, shadows), component variants, tap-feedback tiers, haptic tiers, animation tokens, and the splash intro sequence. Do not duplicate those values here. This document covers only the behavioural rules and implementation constraints that cannot be expressed as a live visual demo.

This document covers **interaction patterns and motion rules** specific to this app.

---

## Auth flow motion (Parts H / I / F / G)

These patterns were established during the GreenPath auth reskin and should be
reused whenever similar UX surfaces appear elsewhere in the app.

---

### H — Step cross-fade

**When**: any user-initiated state transition that replaces the full view content
(wizard steps, multi-screen flows within a single route).

**How**: apply `.animate-step-in` to the incoming container and force React to
remount it by changing its `key` prop.

```css
/* globals.css */
@keyframes stepIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.animate-step-in {
  animation: stepIn 150ms var(--ease-out) both;
}
```

**Rules**:
- Opacity only — no Y translation (that's reserved for `.animate-page-in` on
  full-route page loads).
- 150 ms — short enough to feel instant, long enough to avoid a jarring flash.
- Do NOT apply on programmatic redirects (e.g. "user is already logged in →
  skip to profile step"). Only fire on transitions the user initiated.
- Track whether a transition has occurred with a `hasTransitioned` boolean so
  the initial render uses the `PageTransition` wrapper animation instead.

---

### I — Auth-to-home handoff

**When**: completing auth (name saved for new users, or welcome-back timeout for
returning users) and navigating to `/home`.

**How**: `router.refresh()` followed by `router.push('/home')`.

`router.refresh()` must be called first to flush the client-side router cache.
The Navbar Logo (`<Link href="/home">`) is present on `/auth` and Next.js 14
eagerly prefetches it. While the user is unauthenticated the middleware redirects
`/home` → `/auth`; Next.js caches that redirect. Without the refresh, `router.push`
would serve the stale cached redirect — the optimistic `pushState` would advance
the URL to `/home` while the transition committed the `/auth` redirect, leaving the
screen stuck on the auth view. `router.refresh()` invalidates the cache; the 1800 ms
welcome-back hold gives React plenty of time to process it before navigation fires.

**Why this is safe**: `SplashIntro` checks `sessionStorage.getItem('kirin_intro_done')`
on mount. By the time a user completes auth in the same session, this key is
already set, so the splash component unmounts immediately on the next render —
it does not replay.

**Exception**: admin redirect after OTP verify uses `window.location.href = '/admin'`
(full-page reload) so the browser re-reads admin session cookies from scratch.

---

### F — Loading states on CTAs

**Pattern**: pass `loading={true}` to `<Button>` — it renders a `<Loader2>` spinner
and disables the button. Pass `{!loading && 'Label'}` as children so the label
disappears and only the spinner shows while loading.

**Always add `w-full` to auth CTAs** so button width is layout-constrained and
does not shift between loading and idle states.

```tsx
<Button loading={isSaving} className="w-full rounded-pill">
  {!isSaving && 'Save'}
</Button>
```

---

### G — Input error states

**Colors**: use design-token classes, never raw Tailwind red/gray:

| Element         | Class                          |
|-----------------|-------------------------------|
| Input border    | `border-danger`               |
| Input fill      | `bg-danger-soft`              |
| Message text    | `text-xs text-danger font-medium` |
| Focus ring      | `focus:ring-green` (not red)  |

**Motion**: apply `.shake-error` to the input *container* (not the input itself)
so the +91 prefix shakes with the field. Clear it after 450 ms via a paired
boolean state so the animation can re-trigger on repeated errors:

```tsx
function useShake() {
  const [shaking, setShaking] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shake = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShaking(true);
    timerRef.current = setTimeout(() => setShaking(false), 450);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  return { shaking, shake };
}
```

Call `shake()` immediately when setting an error, not inside a `useEffect`.

---

## J — Fixed bottom CTAs above the nav bar

**Rule**: any screen with a fixed or sticky bottom CTA must account for the bottom nav bar's height. `bottom: 0` puts the bar *on top of* or *behind* the nav bar depending on z-index — neither is correct.

**CSS variable**: `--bottom-nav-h: 4.5rem` is defined in `globals.css` and represents the nav bar height including its internal safe-area inset.

### Fixed / sticky CTA (overlay bar, e.g. `<ActionBar>`)

Use `<ActionBar>` from `src/components/ui/ActionBar.tsx`. It handles the offset automatically:

```
bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] lg:bottom-0
```

`lg:bottom-0` resets to baseline on desktop where `BottomNav` is `lg:hidden`.

### Inline CTA (button at the end of scrollable content)

Add this to the `<main>` container — the established pattern used by the Add Charger, KYC, and Edit Charger wizards:

```
pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] lg:pb-10
```

`lg:pb-10` resets the padding on desktop.

**Never use `bottom: 0` for an action bar on a screen that renders `BottomNav`.** This bug has recurred three times (Add Charger, Hosting Intro, Booking screen); the shared pattern above is the fix.

---

## Navigation and dismissal controls

Choose the control based on background predictability and interaction type, not the screen name.

### Bucket 1 — Predictable solid/light background

Use `<BackButton>` from `src/components/ui/BackButton.tsx`.

- 44dp transparent tap target, plain `ChevronLeft`, `opacity-shift` on press
- No background, no border, no shadow, no scale animation, no haptic
- Applies to: Notifications, Reviews, Host Reviews, About Kirin, Help, Terms, Hosting Learn, and any other screen with a consistent header background

### Bucket 2 — Variable/unpredictable background

Use `<ContainedBackButton>` from `src/components/ui/BackButton.tsx`.

- 40dp visible circle, `bg-white/90 backdrop-blur-sm shadow-sm`, opacity-shift on press
- Guarantees legibility regardless of what photo, map tile, or gradient sits behind it
- Applies to: charger detail (over photo carousel), map editor (over map tiles), explore charger detail (mobile hero)

### Bucket 3 — Full-screen modal or bottom sheet

Use `X` (close icon) or "Done" text, not a back arrow. Dismissing an overlay is not the same interaction as navigating back in history.

- `X` for cancel-style dismiss (filter sheet, delete confirmation, leave confirmation)
- "Done" for confirm-style dismiss where applicable
- The shared `<Sheet>` component in `src/components/ui/Sheet.tsx` handles this automatically when `title` is provided
- Never render a `<BackButton>` or `<ContainedBackButton>` inside a sheet or modal

**Rule for new screens:** apply the correct bucket automatically based on what's behind the nav control. There is no list to consult — the rule is structural, not a registry.

---

## Related files

- `src/app/globals.css` — keyframe definitions (`pageIn`, `stepIn`, `shake-error`, `check-pop`)
- `src/components/ui/Button.tsx` — `loading` prop, `rounded-token` base radius
- `src/components/ui/RoutineSuccess.tsx` — routine success checkmark (no particles)
- `src/components/ui/SplashIntro.tsx` — splash gating via `kirin_intro_done` in sessionStorage
- `docs/INFORMATION_ARCHITECTURE.md` — screen ownership, nav rules, auth flow spec
