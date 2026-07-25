# EV App — Interaction & Motion Baseline

Design tokens and component inventory live in `DESIGN_GreenPath.md` (shared file).
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

**How**: `router.push('/home')` — client-side navigation, no full-page reload.

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

## Related files

- `src/app/globals.css` — keyframe definitions (`pageIn`, `stepIn`, `shake-error`, `check-pop`)
- `src/components/ui/Button.tsx` — `loading` prop, `rounded-token` base radius
- `src/components/ui/RoutineSuccess.tsx` — routine success checkmark (no particles)
- `src/components/ui/SplashIntro.tsx` — splash gating via `kirin_intro_done` in sessionStorage
- `docs/INFORMATION_ARCHITECTURE.md` — screen ownership, nav rules, auth flow spec
