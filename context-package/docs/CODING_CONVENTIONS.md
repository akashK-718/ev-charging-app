# Coding Conventions

The rules that keep a 3-person codebase consistent. Follow these unless there's a specific reason not to.

## TypeScript

### Strict mode is on. Keep it on.

Don't loosen `tsconfig.json` to silence errors. Fix the type.

### Don't use `any`

If you genuinely don't know a type, use `unknown` and narrow it with type guards:

```typescript
// Bad
function handle(data: any) {
  return data.foo.bar;
}

// Good
function handle(data: unknown) {
  if (
    typeof data === 'object' &&
    data !== null &&
    'foo' in data &&
    typeof data.foo === 'object' &&
    data.foo !== null &&
    'bar' in data.foo
  ) {
    return data.foo.bar;
  }
  throw new Error('Unexpected shape');
}
```

If you must use `any`, comment why. Future you will be grateful.

### Prefer `interface` for object shapes, `type` for unions

```typescript
interface Charger {
  id: string;
  pricePerKwh: number;
}

type BookingStatus = 'pending' | 'confirmed' | 'active' | 'completed';
```

### Use literal types for fixed sets

```typescript
// Bad
status: string

// Good
status: 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled' | 'disputed'
```

This catches typos at compile time.

### Discriminated unions for state machines

This is the killer pattern for our booking states:

```typescript
type Booking =
  | { status: 'pending'; chargerId: string; requestedAt: Date }
  | { status: 'confirmed'; chargerId: string; confirmationCode: string }
  | { status: 'active'; chargerId: string; startedAt: Date; kwhSoFar: number }
  | { status: 'completed'; chargerId: string; totalKwh: number; finalCost: number };

// TypeScript knows which fields exist based on status
if (booking.status === 'active') {
  console.log(booking.kwhSoFar);  // ✅ Type-safe
}
```

### Money is always `number` in paise

```typescript
// Type alias for clarity (no runtime cost)
type Paise = number;

function calculatePlatformFee(grossAmount: Paise): Paise {
  return Math.round(grossAmount * 0.15);
}
```

Use `rupeesToPaise`, `paiseToRupees`, `formatINR` from `src/lib/utils.ts` at boundaries. Never inline conversions like `amount * 100`.

---

## React / Next.js

### Server components by default

In the App Router, components are server components unless marked `'use client'`. Use server components whenever possible:

- They don't ship JavaScript to the browser (smaller bundle)
- They can fetch data directly without an API call
- They can use server-only secrets

Only mark a component `'use client'` when you need:
- `useState`, `useEffect`, `useRef`, etc.
- Event handlers (`onClick`, `onChange`)
- Browser APIs (`window`, `localStorage`)
- Third-party libraries that require the browser

### Component structure

```typescript
// 1. Imports
import { Suspense } from 'react';
import { cn } from '@/lib/utils';
import type { Charger } from '@/types';

// 2. Type definitions
interface ChargerCardProps {
  charger: Charger;
  onBookClick?: () => void;
}

// 3. Component as named export, function declaration
export function ChargerCard({ charger, onBookClick }: ChargerCardProps) {
  return (
    <div className={cn('p-4 rounded-2xl', 'bg-white')}>
      <h3>{charger.title}</h3>
      {/* ... */}
    </div>
  );
}
```

- **Named exports** preferred over default exports (better refactoring, clearer imports)
- **Function declarations** preferred over arrow functions for components
- Props type defined inline as `interface`

### Hooks naming

All custom hooks start with `use` and live in `src/hooks/`:

```
src/hooks/
├── useAuth.ts
├── useChargers.ts
├── useBooking.ts
└── useLocation.ts
```

### Don't use `useEffect` for derived state

```typescript
// Bad
const [fullName, setFullName] = useState('');
useEffect(() => {
  setFullName(`${firstName} ${lastName}`);
}, [firstName, lastName]);

// Good
const fullName = `${firstName} ${lastName}`;
```

### Don't fetch in `useEffect` for server-rendered data

```typescript
// Bad — client-side fetch in useEffect, loading flash
'use client';
function ChargersPage() {
  const [chargers, setChargers] = useState([]);
  useEffect(() => {
    fetch('/api/chargers').then(r => r.json()).then(setChargers);
  }, []);
  return <div>{/* render */}</div>;
}

// Good — server component, no client JS, no loading flash
export default async function ChargersPage() {
  const supabase = createClient();
  const { data: chargers } = await supabase.from('chargers').select('*');
  return <div>{/* render */}</div>;
}
```

---

## File and folder structure

### Path alias

`@/` is configured to point to `src/`. Use it for imports:

```typescript
// Good
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/server';
import type { Booking } from '@/types';

// Avoid
import { Button } from '../../components/ui/Button';
```

### File naming

- **Components:** `PascalCase.tsx` (e.g., `ChargerCard.tsx`)
- **Hooks:** `useThing.ts`
- **Utilities:** `kebab-case.ts` or `camelCase.ts` — be consistent within a folder
- **Pages:** `page.tsx` (Next.js convention)
- **API routes:** `route.ts` (Next.js convention)
- **Types:** `kebab-case.ts` or domain name like `charger.ts`, `booking.ts`

### When to create a new component file

A new file when:
- It's used in 2+ places
- It's >50 lines
- It has its own state or effects
- It has a clear single responsibility

Otherwise, keep it inline. Premature componentization is its own kind of mess.

### When to create a new folder

A new folder when:
- 4+ files belong to a domain
- The files share types or utilities only used internally

Don't create a folder for one file.

---

## State management

### Default to local state

`useState` in the component that owns the data. Lift only when needed.

### Context for app-wide values

Auth state, theme, user preferences. Don't use Context for performance-critical things (it causes re-renders).

### No Redux / Zustand / Jotai for MVP

`useState` + `useContext` covers everything we need. Revisit if a specific pain emerges. Almost certainly it won't.

### Server state

Don't sync server state into client state. Re-fetch via server components or pass via props. React Query / SWR are explicitly not in the stack.

---

## API routes

### Always validate input

```typescript
// Good
export async function POST(request: NextRequest) {
  const body = await request.json();
  
  if (typeof body.phone !== 'string' || !/^\d{10}$/.test(body.phone)) {
    return NextResponse.json(
      { error: 'Invalid phone number' },
      { status: 400 }
    );
  }
  
  // ... rest
}
```

For complex shapes, use `zod` (already a recommended dependency).

### Return consistent error shapes

```typescript
type ApiError = {
  error: string;          // user-facing message
  code?: string;          // machine-readable category
  details?: unknown;      // optional debug info (dev only)
};

type ApiSuccess<T> = {
  data: T;
};
```

Don't return `null` or raw library errors.

### Status codes

- `200` OK — success
- `201` Created — resource created
- `400` Bad Request — input validation failed
- `401` Unauthorized — not logged in
- `403` Forbidden — logged in but not allowed
- `404` Not Found — resource doesn't exist
- `409` Conflict — state conflict (double-booking, etc.)
- `429` Too Many Requests — rate limited
- `500` Internal Server Error — unexpected failure

Pick the right one. Don't return 200 for errors.

### Auth in API routes

```typescript
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  
  // ... use user.id
}
```

---

## Database access

### Always use the typed Supabase client

`Database` type from `src/lib/supabase/types.ts` provides full autocomplete.

### Never use raw SQL strings for user input

```typescript
// Bad — SQL injection vulnerability
const { data } = await supabase.rpc('raw_query', { 
  query: `SELECT * FROM chargers WHERE id = '${userInput}'`
});

// Good — parameterized
const { data } = await supabase
  .from('chargers')
  .select('*')
  .eq('id', userInput);
```

### Use Postgres RPC for complex transactional logic

Multi-step operations like booking creation belong in Postgres functions, called via `supabase.rpc(...)`. This keeps transactions atomic.

### Always handle errors

```typescript
// Bad
const { data } = await supabase.from('chargers').select('*');
return data;  // could be null!

// Good
const { data, error } = await supabase.from('chargers').select('*');
if (error) {
  logger.error({ error }, 'Failed to fetch chargers');
  throw new Error('Failed to fetch chargers');
}
return data;
```

---

## Error handling

### User-facing errors are strings

Never expose raw library errors to users. Map them to friendly strings.

```typescript
try {
  // ...
} catch (error) {
  logger.error({ error }, 'Booking creation failed');
  
  if (error instanceof RazorpayError && error.code === 'BAD_REQUEST_ERROR') {
    return NextResponse.json(
      { error: 'Payment could not be initiated. Please try again.' },
      { status: 400 }
    );
  }
  
  return NextResponse.json(
    { error: 'Something went wrong. Please try again.' },
    { status: 500 }
  );
}
```

### Log everything that goes wrong

Use the `pino` logger in `src/lib/logger.ts`:

```typescript
logger.error({ 
  userId,
  bookingId,
  error: error.message,
  stack: error.stack 
}, 'Booking confirmation failed');
```

Structured logs are queryable later. String logs are not.

---

## Tailwind CSS

### Use the design tokens

Defined in `tailwind.config.ts`:
- Colors: `ink`, `ink-soft`, `muted`, `volt`, `volt-deep`, `volt-soft`
- Fonts: `font-sans` (Manrope), `font-display` (Bricolage Grotesque)

```tsx
// Bad
<div className="text-[#0c1611]">

// Good
<div className="text-ink">
```

### Compose classes with `cn`

For conditional classes:

```tsx
import { cn } from '@/lib/utils';

<button className={cn(
  'px-4 py-2 rounded-lg',
  isPrimary && 'bg-volt text-ink',
  isDisabled && 'opacity-50 cursor-not-allowed'
)}>
```

### Mobile-first

Default styles are for mobile. Use `md:`, `lg:` for larger screens.

```tsx
// 1 column on mobile, 2 on tablet+
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
```

### Component classes go in components, not in className strings

If a class combination appears 3+ times, make it a component variant:

```tsx
// Don't sprinkle this everywhere
<button className="px-6 py-3 bg-volt text-ink font-bold rounded-2xl hover:bg-volt-deep">

// Make a Button component with a variant
<Button variant="secondary">Click me</Button>
```

---

## Commit messages

### Format

- Short summary line (≤72 chars), present tense imperative: "Add lender registration form"
- Blank line
- Optional body explaining *why* (not what — code shows what)
- Reference issues: `Closes #12` or `Refs #34`

### Examples

```
Add phone OTP login flow

- Wire up MSG91 send-otp and verify-otp endpoints
- Create /login and /verify-otp pages
- Add Supabase session handling

Closes #4
```

```
Fix double-booking race condition

Use SELECT FOR UPDATE on the charger row before inserting
booking. Prevents concurrent requests from both succeeding
when they overlap on the same slot.

Refs #18
```

### Bad commit messages (don't do)

- `update` — what was updated?
- `wip` — not a meaningful commit
- `fixed bug` — which bug?
- `Final version` — there is no final
- A 200-character title with everything you did

---

## Git workflow

### Never push directly to `main`

Every change goes through a PR:

```bash
git checkout -b feature/auth-flow
# ... make changes ...
git add .
git commit -m "Add phone OTP login"
git push -u origin feature/auth-flow
# Open PR on GitHub, get review, merge
```

### Branch naming

- `feature/short-description` for new features
- `fix/short-description` for bug fixes
- `refactor/short-description` for cleanup
- `docs/short-description` for documentation

### Keep PRs small

One logical change per PR. 200-line PRs are reviewable; 2000-line PRs are not. If a feature is big, split into multiple PRs.

### Pull before you start

Every coding session begins with:

```bash
git checkout main
git pull
git checkout -b feature/new-thing
```

### Don't commit broken code

`npm run dev` should work after every commit. If it doesn't, the commit isn't done.

---

## Testing (Module 5 onwards)

We don't have formal tests yet. Once Module 5 lands, we'll add:

- **Playwright** for E2E flows (Akash's specialty)
- Critical paths covered: signup, list charger, book, pay, complete session
- No unit tests for trivial components
- Yes unit tests for: money calculations, state transitions, webhook signature verification

---

## Anti-patterns to avoid

These come up often. Don't do them.

### Building for imagined scale

Don't add caching layers, queue systems, or microservices "in case we get big." Build for current scale. Optimize when measured, not predicted.

### "Just one more dependency"

Every package added is a future maintenance cost, a security surface, a bundle size hit. Default to "no" on new dependencies.

### Polling

If you find yourself writing `setInterval` to check for updates, use Supabase Realtime instead.

### Inline business logic in components

```tsx
// Bad
<Button onClick={async () => {
  const { data } = await supabase.from('bookings').insert(...);
  if (data) {
    await fetch('/api/notify', { ... });
    // ... 30 more lines
  }
}}>

// Good — extract to a hook or service
<Button onClick={createBooking}>
```

### Overly clever code

If a teammate has to ask "what does this do?", rewrite it simpler. Code is read 10x more than it's written.

### "We'll add tests later"

It's true we don't have tests yet for MVP. But for **payment logic and state transitions**, write tests as you build (Module 5). Those are the bugs that cost real money.
