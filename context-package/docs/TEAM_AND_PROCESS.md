# Team and Process

How the three of us actually work together.

## Team

| Person | Role | Background | GitHub |
|--------|------|------------|--------|
| **Akash Kumar** | Tech lead, backend/auth/payments | QA Automation Associate at Telus Health, 4+ yrs Playwright + TypeScript, transitioning to SDET. Strong TypeScript, learning React/Next.js. | [akashK-718](https://github.com/akashK-718) |
| **Hitesh** | Frontend, map, discovery | Learning React + TypeScript. | TBD |
| **Rohan** | Payments, admin dashboard | Learning React + TypeScript. | TBD |

All three are part-time, working evenings and weekends alongside day jobs. Realistic capacity: 10-15 hours per week per person.

## Ownership map

Who owns what across the project:

### By module

| Module | Akash | Hitesh | Rohan |
|--------|-------|--------|-------|
| 1 — Foundation | **Lead** (auth, setup) | Charger list view | Lender registration form |
| 2 — Discovery | Support | **Lead** (map, detail) | Support |
| 3 — Booking | **Lead** (state machine) | Booking UI | Support |
| 4 — Internal testing | All | All | All |
| 5 — Payments + ratings | Support (state machine integration) | Ratings UI | **Lead** (Razorpay, payouts) |
| 6 — Friends & family beta | Bug fixes | Notification UX | **Lead** (admin dashboard, disputes) |
| 7 — Capacitor + Play Store | **Lead** (build, submission) | Store assets | T&C, privacy policy |

### By area

- **Auth, session management, OTP:** Akash
- **Booking state machine:** Akash
- **Map and geo:** Hitesh
- **Charger UI (list, detail, photos):** Hitesh
- **Payment integration:** Rohan
- **Admin dashboard:** Rohan
- **DB schema and migrations:** Akash (others can propose, Akash reviews)
- **Tests (Module 5+):** Akash (Playwright expertise)
- **Design and styling:** Hitesh (more visual eye)
- **Documentation:** All — own what you write

## Workflow

### Daily

- Pull `main` before starting: `git pull`
- Work on a feature branch: `git checkout -b feature/your-thing`
- Commit often (at logical pauses), push to your branch
- Open a PR when the feature is reviewable (doesn't have to be "done")

### Weekly

- **Sync call:** Saturday 8 PM IST (45 min)
  - Demo what you shipped this week
  - Raise blockers
  - Pick tasks for next week
- **Mid-week check:** Wednesday WhatsApp message "what are you working on, blocked on anything?"

### Per module

- Kickoff: 30-min call at start to align on tasks
- Demo: at module end, all three on call, walk through the new functionality together
- Retro: 10 min after demo — what went well, what didn't, what to change

## Pull request process

### Opening a PR

- Branch from `main`
- Reasonable PR size (under ~300 lines changed, ideally under 100)
- Title: short, present tense, like a commit message ("Add phone OTP login")
- Description: explain *what* changed and *why*; link any issues
- Self-review your own PR first — read your changes as if reviewing someone else's
- Mark draft if not ready for review

### Reviewing a PR

- At least one of the other two team members must approve
- Aim to review within 24 hours of being requested
- Look for: correctness, conventions adherence, edge cases, security issues
- Be kind but honest — "this could be clearer" not "this is bad"
- Approve once changes are good. Don't block on style nits — comment as suggestions.

### Merging

- Use "Squash and merge" on GitHub (keeps `main` history clean)
- Delete the feature branch after merge
- The merger pulls latest `main` immediately afterward

### Conflicts on PRs

- The PR author resolves conflicts, not the reviewer
- Rebase your branch on latest main: `git pull origin main --rebase`
- Force-push with care: `git push -f` (only on your own branches, never `main`)

## Communication

### Channels

- **WhatsApp group** — daily chatter, "I'm online," quick questions, links
- **GitHub PRs** — all code-related discussion
- **GitHub Issues** — bug reports, feature ideas, tasks
- **Weekly call** — bigger decisions, demos

### Channel rules

- Code questions → GitHub PR comments (so context stays with code)
- Quick questions → WhatsApp
- Bug reports → GitHub Issues
- Casual stuff → WhatsApp
- **Decisions worth remembering** → write them down in `docs/CURRENT_STATUS.md` or open a GitHub Discussion. WhatsApp messages get lost.

### Response time expectations

- WhatsApp: within a few hours during work time
- GitHub PR review: within 24 hours
- Weekly call: don't miss without prior notice

## Learning resources

For Hitesh and Rohan (and Akash for the React parts):

### React fundamentals

1. **[React docs at react.dev](https://react.dev/learn)** — "Quick Start" → "Describing the UI" → "Adding Interactivity" → "Managing State." About 8-10 hours total. Build a small todo app while doing this.
2. (Optional) **[Joy of React](https://www.joyofreact.com/)** by Josh Comeau — paid but excellent. Skip if you want.

### TypeScript

1. **[Total TypeScript Beginners](https://www.totaltypescript.com/tutorials/beginners-typescript)** by Matt Pocock — free, ~4 hours. Best intro.
2. (Reference) **[TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)** — read "Everyday Types" and "Narrowing" sections.

### Next.js

1. **[Learn Next.js](https://nextjs.org/learn)** — chapters 1-7. About 3 hours.
2. **[Next.js App Router docs](https://nextjs.org/docs)** — skim "Routing" and "Data Fetching" sections.

### Tailwind

1. **[Tailwind Utility-First docs](https://tailwindcss.com/docs/utility-first)** — read first 5 sections, 30 min.
2. VS Code extension "Tailwind CSS IntelliSense" — install, use autocomplete.

### Supabase

1. **[Supabase Quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)** — Next.js + Supabase walkthrough.
2. Skim **[Supabase Auth with Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs)** — relevant for our auth flow.

### Razorpay (for Rohan, before Module 5)

1. **[Razorpay Standard Web Integration](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/)** — read the whole thing.
2. **[Razorpay Route docs](https://razorpay.com/docs/payments/route/)** — for split payouts.
3. **[Webhook handling guide](https://razorpay.com/docs/webhooks/)** — critical.

### Total recommended time

- Hitesh / Rohan: 15-20 hours before first real feature commit. Spread over 5-7 evenings.
- Akash: 6-9 hours to get up to speed on React + Next.js specifics.

## Working agreements

### What we agree on

1. **Quality bar:** Code that works, that we'd happily review for each other, that doesn't break what came before
2. **Communication:** Ask early when stuck, don't suffer for hours
3. **Honesty:** Push back on bad ideas (including each other's), with reasons
4. **No solo heroics:** Don't ship big changes without review. Even Akash.
5. **Sustainability:** This is part-time. Don't burn out. If a week is bad for you, say so.

### What we don't do

1. **Don't merge your own PR.** Always wait for another approval.
2. **Don't break `main`.** It should always run.
3. **Don't argue in comments.** If a code discussion gets heated, move it to a call.
4. **Don't keep secrets.** Discoveries (bugs, blockers, concerns) go in the group.
5. **Don't say "should be easy" about someone else's task.** You don't know.

## Conflict resolution

When team members disagree:

1. First, try to understand the other person's reasoning. Genuinely.
2. If still disagreeing, write up both options briefly. Pros, cons.
3. Bring to the weekly call. Decide together.
4. If still split: Akash makes the call as tech lead. Disagree-and-commit.
5. Document the decision in `docs/CURRENT_STATUS.md`.

## Burnout signals

Watch for these (in yourself or others):

- Stopped pushing code for >1 week without saying why
- Snapping at code reviews
- "I'll catch up next week" repeatedly
- Saying yes to everything but delivering nothing
- Disengaged in calls

If you see this in yourself, say so. If you see it in a teammate, ask gently.

This is a side project. It's allowed to take a backseat to life. We don't trade health for velocity.
