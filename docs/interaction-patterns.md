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

## Platform notes

- **iOS**: No haptics (Vibration API absent in Safari). Visual feedback is the only signal. Verified correct — not a bug.
- **Android Chrome / WebView**: Both visual and haptic feedback.
- **Desktop**: Visual feedback (hover + active states). No haptics.
- **PWA**: Behaves as the underlying platform (Android gets haptics, iOS does not).
