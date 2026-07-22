# Interaction Patterns

Design rules for interactive feedback across Kirin. Every new component must follow these patterns before shipping.

---

## Global responsiveness rule

**Every tap must produce visible feedback within ~100ms.**

This is non-negotiable. Use CSS `:active` state transitions — they require no JS and fire within one frame (~16ms) of the touch event landing. Do not rely solely on state updates or re-renders for tap feedback.

✅ Correct — CSS handles it, always instant:
```tsx
<button className="tap-medium">Continue</button>
```

❌ Wrong — feedback only appears after JS executes:
```tsx
<button onClick={() => setPressed(true)} className={pressed ? 'scale-95' : ''}>Continue</button>
```

---

## Tap feedback tiers

All tap tier classes live in `src/app/globals.css`. Use them on interactive elements.

| Class | Scale | Duration | Use on |
|---|---|---|---|
| `tap-light` | 0.98 | 80ms ease-out | Nav tabs, cards, list rows, chips, icon buttons, toggles, checkboxes |
| `tap-medium` | 0.96 | 80ms ease-out + shadow drop | Primary CTAs, FABs, dialog confirm |
| `tap-strong` | 0.96 | Immediate (no transition) | Reserved for future use |
| `tap-opacity` | — | 80ms fade to 0.6 | Back / dismiss / secondary text actions |

The scale values are intentionally small — the goal is *acknowledgement*, not drama.

---

## Haptic feedback

Haptics are a **bonus layer only**. Visual feedback must fully communicate the interaction on its own, because iOS users receive no haptics (the web Vibration API is Android-only by platform design — not a bug to work around).

Use the `haptic(tier)` utility from `src/lib/haptics.ts`:

```ts
import { haptic } from '@/lib/haptics';
// Call in the onClick handler before the action
haptic('light');   // 10ms — nav, cards, chips
haptic('medium');  // 25ms — primary buttons, confirms
haptic('heavy');   // 40ms — reserved
haptic('error');   // [40, 30, 40] pattern — errors, failures
```

---

## Component wiring table

| Component | Visual class | Haptic tier |
|---|---|---|
| Bottom nav tabs | `tap-light` | `light` |
| Cards (charger, booking) | `tap-light` | `light` |
| List rows | `tap-light` | `light` |
| Filter chips / pills | `tap-light` | `light` |
| Switch / toggle thumb | `tap-light` | `light` |
| Checkbox | `tap-light` | `light` |
| Icon button | `tap-light` | `light` |
| Back / dismiss button | `tap-opacity` | none |
| Primary CTA (Find Charger, Continue, Save, Next) | `tap-medium` via `Button` | `medium` |
| FAB | `tap-medium` | `light` |
| Dialog confirm | `tap-medium` | `medium` |

`Button` component (`src/components/ui/Button.tsx`) handles tier selection automatically based on `variant`:
- `primary` / `danger` → medium haptic + `active:scale-[0.96]`
- `secondary` / `ghost` → light haptic + `active:scale-[0.98]`

---

## Reduced motion

All `.tap-*` classes and the legacy `.tap-target` / `.tappable` classes are suppressed when `prefers-reduced-motion: reduce` is set. The `globals.css` `@media (prefers-reduced-motion: reduce)` block handles this — no component-level overrides needed.

---

---

## Strong / destructive actions (Part A)

Strong actions press immediately to 0.96 scale with no ease-in (`tap-strong` CSS class) and use **heavy** haptic.

| Action | Visual | Haptic | Notes |
|---|---|---|---|
| Start session | `active:scale-[0.96]` | `heavy` | Immediate loading state, disabled until response |
| End session | `active:scale-[0.96]` | `heavy` | Same pattern |
| Accept booking (lender) | `active:scale-[0.96]` | `heavy` | Strong confirmation |
| Approve KYC (admin) | `Button` default | `heavy` | Navigates on success |
| Reject / Resubmit KYC | `Button` default | `heavy` | Requires reason first |
| Reject booking (lender) | `Button` default | `heavy` | Requires reason first |
| Cancel booking (driver) | `active:scale-[0.96]` | `heavy` | Confirmation sheet required first |
| Publish charger | `Button primary` | `heavy` | Milestone check runs post-submit |
| Delete / Refund | Red button in Sheet | `heavy` on confirm | Confirmation sheet required; Sheet is the guard |

**Long-running actions must never leave a frozen button state.** Use `disabled={loading}` with a spinner label ("Starting…", "Confirming…") while the API call is in flight.

---

## Success vs. Milestone (Part B — strict split)

### Routine success
`<RoutineSuccess message="..." />` — green checkmark, `animate-check-pop` scale-in, no particles.

Use when: booking confirmed, session started/ended, charger updated, profile saved, KYC approved, payment successful, any action that can happen multiple times per day.

### Milestone celebration
`<MilestoneParticles onComplete={cb} />` layered over `<RoutineSuccess />` inside a `position:relative overflow:hidden` container. 8 bolt/green-dot particles expand from center over 600–930ms, then `onComplete` fires.

**Hard rule (enforced in code via guard in `src/lib/milestones.ts`):**
> If an action can plausibly be performed 10+ times in a day, it MUST NOT trigger `MilestoneParticles` — only `RoutineSuccess`.

### Fixed milestone list

| Milestone | Event key | Trigger point |
|---|---|---|
| Driver: first charging session | `driver:first_session` | Booking transitions to `completed` on driver page |
| Host: first charger published | `host:first_charger_published` | After charger submit API returns 200 |
| Host: first booking received | `host:first_booking_received` | After lender accepts a booking |
| Host: first completed session | `host:first_completed_session` | Booking transitions to `completed` on lender page |
| Host: first payout | `host:first_payout` | Payout detection (see future scope below) |
| Host: ₹10k lifetime | `host:earnings_10k_rupees` | Same payout check |
| Host: ₹1L lifetime | `host:earnings_1L_rupees` | Same payout check |

Milestone state is tracked per-device in `localStorage` key `kirin:milestones`.
TODO: add `milestones_celebrated jsonb` column to `users` table for cross-device sync.

---

## Warning and error patterns (Part C)

### Error
- Color: `text-red-600 bg-red-50`
- Animation: `.shake-error` class on the error element — 400ms horizontal jiggle
- Haptic: `haptic('error')` — `[40, 30, 40]` double-thud pattern
- Trigger: in `catch` blocks and on non-OK API responses

Re-trigger shake on repeated errors by changing the element's `key` prop (React remounts, animation restarts).

### Warning
- Color: `text-amber-700 bg-amber-50`
- Animation: none (amber text/bg is sufficient visual signal)
- Haptic: `haptic('warning')` — `[15, 10, 15]` double-tap
- Trigger: cancel confirmation open, form unsaved changes prompt, geolocation unavailable

---

## Booking lifecycle haptics (Part D)

| Moment | Visual | Haptic | Implementation |
|---|---|---|---|
| Session initiated (lender taps Start) | Button → spinner | `heavy` | `handleAction('start')` success |
| Charging confirmed (in_progress) | Info banner changes | `success` | `useEffect` on status transition in `SessionControls` |
| Lender ends session → driver notified | Orange info banner | `heavy` | `useEffect` on `awaiting_end_confirmation` transition (driver role) |
| Driver confirms end | RoutineSuccess | `heavy` | `handleAction('end')` success (driver role) |
| Booking accepted by lender | Status badge → confirmed | `heavy` | `handleAccept()` in lender booking page |

### Future scope — flagged items not built in this PR

| Feature | Reason deferred |
|---|---|
| **Payout received haptic** | Real-time detection requires webhook → push notification system. Polling the payouts list is unsafe (race on refetch, fires on every page load after first payout). Stub in `checkHostPayoutMilestones()` exists; wire to push notification when FCM payout webhook is built. |
| **Arrived at charger haptic** | No geofence/arrival detection system exists. Adding location tracking scope would require a separate privacy review. |
| **Navigation started haptic** | "View on map" link exists in booking detail; `haptic('light')` can be added inline when a navigation intent UI is designed (e.g., a dedicated "Navigate" button). |
| **Driver 100th session** | Lower priority milestone; query would be `count === 100`. Add to `checkDriverFirstSession` when wanted. |
| **Referral milestone** | Needs referral system — no tracking exists. |
| **Account anniversary / campaign reward** | Needs campaign/cron trigger. |
| **Cross-device milestone state** | Currently localStorage per-device. Needs `milestones_celebrated jsonb` column in `users` DB table. |

---

## Platform notes

- **iOS**: No haptics (Vibration API absent in Safari). Visual feedback is the only signal. Verified correct — not a bug.
- **Android Chrome / WebView**: Both visual and haptic feedback.
- **Desktop**: Visual feedback (hover + active states). No haptics.
- **PWA**: Behaves as the underlying platform (Android gets haptics, iOS does not).
