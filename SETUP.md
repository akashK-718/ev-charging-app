# Setup guide — first time running this project

Follow these steps in order. Should take about 30 minutes the first time.

## Prerequisites

Install these on your laptop (Windows / Mac / Linux all work):

1. **Node.js v20 or later** — [nodejs.org](https://nodejs.org/) (LTS version)
2. **Git** — [git-scm.com](https://git-scm.com/)
3. **VS Code** — [code.visualstudio.com](https://code.visualstudio.com/)
4. **GitHub account** — if you don't have one already

Verify Node is installed:

```bash
node --version    # should print v20.x.x or higher
npm --version     # should print 10.x.x or higher
```

## Step 1 — Clone the repo

```bash
git clone <your-github-repo-url>
cd ev-charging-app
```

## Step 2 — Install dependencies

```bash
npm install
```

This downloads everything in `package.json` into a `node_modules` folder
(~500 MB, takes 2–5 minutes). It's gitignored, so it's never committed.

## Step 3 — Set up environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` in VS Code. For the very first run, you can leave most
values empty — the app will load but features that need them (OTP, payments)
will fail. That's fine for now.

When you're ready to actually use those features, you'll need accounts at:

| Service | What for | Sign-up takes |
|---------|----------|----------------|
| [Supabase](https://supabase.com) | Database + auth | 5 min |
| [Razorpay](https://razorpay.com) | Payments | 1–3 days (KYC) |
| [MSG91](https://msg91.com) | Phone OTP | 1 day (DLT) |
| [Cloudinary](https://cloudinary.com) | Image uploads | 5 min |

## Step 4 — Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
You should see the homepage with the Kirin logo and two buttons.

Edit `src/app/page.tsx` and save — the page reloads instantly. That's
hot module replacement, which makes development fast.

To stop the server, press `Ctrl+C` in the terminal.

## Step 5 — Recommended VS Code extensions

When you open the project in VS Code, it will suggest extensions. Install:

- **Tailwind CSS IntelliSense** — autocompletes Tailwind class names
- **Prettier** — auto-formats code on save
- **ESLint** — flags code issues
- **TypeScript Vue Plugin** (Volar) — improved TS support

## Step 6 — Verify TypeScript works

```bash
npm run type-check
```

Should print nothing (success) or warnings. Errors will show file paths and
line numbers — open them in VS Code to fix.

## Step 7 — Git workflow

Never commit directly to `main`. Always:

```bash
git checkout -b feature/your-feature-name      # create your branch
# ... make changes ...
git add .                                       # stage all changes
git commit -m "Clear description of changes"    # commit them
git push origin feature/your-feature-name       # push to GitHub
```

Then open a Pull Request on GitHub for someone else to review and merge.

## What's in this project

```
src/
├── app/              # Pages (each folder = a URL route)
│   ├── api/          # Backend endpoints
│   ├── login/        # /login
│   ├── chargers/     # /chargers (and /chargers/[id])
│   ├── bookings/     # /bookings
│   ├── lender/       # /lender/*  (lender-side pages)
│   └── admin/        # /admin/*   (admin dashboard)
│
├── components/       # Reusable React components
│   ├── ui/           # Generic primitives (Button, Input, etc.)
│   └── ...           # Feature-specific components
│
├── lib/              # Shared utilities (database client, helpers)
├── hooks/            # Custom React hooks
├── types/            # TypeScript type definitions
└── middleware.ts     # Auth middleware

supabase/
└── migrations/       # Database schema as SQL files
```

## Common commands

```bash
npm run dev          # Start dev server (Ctrl+C to stop)
npm run build        # Build for production (slow, runs all checks)
npm run start        # Run the production build
npm run type-check   # Check TypeScript without building
npm run lint         # Find code issues
```

## Stuck?

- Check the [README.md](./README.md) for the tech stack overview
- Check [BUILD_PLAN.md](./BUILD_PLAN.md) for the 15-week roadmap
- Ping the team WhatsApp group
- Open a GitHub issue for anything that should be tracked

## What to do next

1. Make sure `npm run dev` shows the homepage at localhost:3000
2. Read through `src/app/page.tsx` to see what the homepage code looks like
3. Read through `src/lib/supabase/types.ts` to see the database shape
4. Read through `supabase/migrations/001_initial_schema.sql` to see the actual tables
5. Pick the first task from `BUILD_PLAN.md` Milestone 1 and start building

You're set up. Welcome to the project.
