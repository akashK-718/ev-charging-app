# Current Status

Last updated: Module 1, after PR 0 (Supabase Auth session architecture).

Update this file whenever a significant milestone changes status. Treat it as the source of truth for "where are we right now."

---

## Project state at a glance

**Current module:** Module 1 — Foundation
**Week:** 1 of 15
**Codebase:** Scaffolded, pushed to GitHub, running locally for at least one team member
**Public URL:** Not yet (Vercel deploy not configured)
**External services:** None yet activated (no Supabase, Razorpay, MSG91 accounts yet)
**Real users:** None (correct for this stage)

---

## Completed

### Project setup
- [x] Next.js 14 + TypeScript + Tailwind project scaffolded
- [x] Folder structure established per `CLAUDE.md`
- [x] `package.json` with all initial dependencies
- [x] `tsconfig.json` with `@/*` path alias
- [x] `.gitignore` and `.env.example`
- [x] `README.md`, `BUILD_PLAN.md`, `SETUP.md` in repo
- [x] Database migrations 001 (initial schema) and 002 (PostGIS) drafted
- [x] Placeholder pages for all routes (Modules 1-6 stubs)
- [x] Working homepage with brand placeholder, hero, two CTAs

### Code patterns established
- [x] Supabase client wrappers (browser + server) at `src/lib/supabase/`
- [x] Razorpay SDK wrapper + webhook signature verification at `src/lib/razorpay.ts`
- [x] MSG91 helpers (send + verify OTP) at `src/lib/msg91.ts`
- [x] Cloudinary upload helper at `src/lib/cloudinary.ts`
- [x] Utility functions (`formatINR`, `cn`, `generateConfirmationCode`) at `src/lib/utils.ts`
- [x] Constants (commission %, timeouts, enums) at `src/lib/constants.ts`
- [x] Shared types at `src/types/`
- [x] Sample `Button` UI component
- [x] Sample `ChargerCard` feature component
- [x] `useAuth` hook — uses `supabase.auth.getUser()` + `onAuthStateChange` (Supabase Auth)
- [x] API route: `POST /api/auth/send-otp`
- [x] API route: `POST /api/auth/verify-otp` — MSG91 verify → Supabase Auth session
- [x] API route: `GET /api/auth/me`
- [x] API route: `POST /api/auth/logout`
- [x] API route: `POST /api/auth/role`
- [x] API route: `GET /api/chargers`
- [x] API route: `POST /api/webhooks/razorpay` (skeleton)
- [x] Login page at `/login` (phone input, calls send-otp)
- [x] OTP verify page at `/verify-otp` (6-box input, auto-advance, paste)
- [x] Role selection page at `/role-select` (to be replaced by `/welcome` in PR 3)
- [x] Auth middleware — Supabase SSR cookie refresh pattern

### Repo and tooling
- [x] GitHub repo live at `github.com/akashK-718/ev-charging-app`
- [x] First commit pushed to `main` branch
- [x] Akash has working local dev environment, homepage runs at `localhost:3000`

---

## In progress

### Team onboarding
- [ ] Hitesh — cloning, installing dependencies (in progress, screenshot showed `npm install` running)
- [ ] Rohan — not started yet (waiting on)
- [ ] Once both have homepage running locally, schedule kickoff call

### Decisions pending
- [ ] **Brand name finalization** — shortlist is Pravah, Ojas, or other. Decision blocks domain registration and trademark filing.
- [ ] **Domain purchase** — depends on brand name
- [ ] **Trademark filing** — lawyer vs self-filing decision pending

---

## Blocked / Not started

### External accounts to create (in priority order)
- [ ] **Supabase account + project** — needed for Module 1 auth and DB. **Akash should do this first.**
- [ ] **MSG91 account + DLT registration** — needed for OTP. Start ASAP, takes 1-2 days for DLT.
- [ ] **Vercel account + project link** — needed for auto-deploy. Easy, 10 minutes.
- [ ] **Cloudinary account** — needed for photo upload (Module 1 step 3). Easy, 5 minutes.
- [ ] **Razorpay account + KYC** — needed for Module 5 payments. Start now — Razorpay KYC takes 2-5 business days.
- [ ] **Firebase account** — needed for Module 6 push. Wait, not urgent.
- [ ] **Sentry account** — needed for Module 6 error tracking. Wait, not urgent.

### Module 1 features in progress

- [x] Phone OTP flow — send + verify pages + API routes done
- [x] Auth middleware (Supabase SSR pattern, protected routes)
- [x] Role selection page (`/role-select`) — exists, being replaced by `/welcome` in PR 3
- [ ] **PR 1** — Landing page intent params (`?intent=driver/lender`), login passes intent through, Upstash rate limiting on send-otp
- [ ] **PR 2** — verify-otp redirects new users to `/welcome?intent=…`, existing to dashboard
- [ ] **PR 3** — `/welcome` page + `PATCH /api/users/me`
- [ ] **PR 4** — Middleware hardening: protect `/verify-otp`, role-based dashboard redirects
- [ ] Lender registration form (multi-step)
- [ ] Charger list view at `/chargers`
- [ ] Lender dashboard at `/lender/dashboard`
- [ ] Vercel deployment pipeline
- [ ] Rate limiting on OTP endpoint (Upstash Redis) — PR 1
- [ ] Logging setup (`pino`)

### Documentation gaps
- [ ] Lender T&C document (legal)
- [ ] Driver T&C document (legal)
- [ ] Privacy policy (legal)
- [ ] Marketing landing page copy (post-MVP)

---

## Known risks / unresolved issues

### Technical
- **Supabase Auth + custom MSG91 OTP** — RESOLVED. MSG91 handles OTP send/verify; on success we call `auth.admin.createUser` + `signInWithPassword` with a derived deterministic password to get a real Supabase Auth session. See `TECH_STACK.md` → "Session management" for full rationale.
- **iOS PWA limitations** — push notifications on iOS PWAs are limited pre-iOS 16.4. Beta on iOS may have UX gaps.
- **Leaflet SSR with Next.js App Router** — known issue, requires dynamic import. Need to confirm in Module 2.

### Business / legal
- **Electricity resale grey area** — biggest unresolved risk. Need lawyer review before public launch (Module 7 latest).
- **Brand name not finalized** — blocking trademark and domain work.

### Team / process
- **Hitesh and Rohan still ramping up on React/TypeScript** — may delay Module 1 timeline. Plan: Akash carries more weight in week 1, they ramp up in week 2.

---

## Velocity tracking

Will start tracking this once code commits begin:

- Average commits per person per week: TBD
- PRs merged per week: TBD
- Bugs found in internal testing (Module 4): TBD

---

## Next concrete actions (this week)

In priority order:

1. **Akash:** Create Supabase project, generate API keys, add to `.env.local`. Run migrations 001 and 002.
2. **Akash:** Create Vercel project, link to GitHub repo, set environment variables there too. Confirm auto-deploy works (push small change, verify deploys).
3. **Akash:** Create MSG91 account, start DLT registration paperwork (1-2 day wait).
4. **Akash:** Create Razorpay account, submit business KYC (2-5 day wait).
5. **Hitesh + Rohan:** Confirm local dev environment works (homepage at localhost:3000).
6. **Hitesh + Rohan:** Each pick one learning resource from `TEAM_AND_PROCESS.md` and start.
7. **All three:** Kickoff call by end of week — assign Module 1 sub-tasks.
8. **Akash:** Start drafting OTP flow code (won't be fully testable until MSG91 keys arrive, but can stub it).

---

## How to update this file

When something significant changes:

1. Move items between sections (Completed / In progress / Blocked)
2. Update the "Current module" and "Week" at the top
3. Add to "Known risks" if a new issue surfaces
4. Update "Next concrete actions" weekly (or after major milestones)
5. Commit with message like `docs: update CURRENT_STATUS for end of week 1`

Do NOT remove completed items — they form the project history. Just move them down.
