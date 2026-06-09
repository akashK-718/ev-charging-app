# EV Charging Marketplace

A peer-to-peer EV charging marketplace — "Airbnb for home EV chargers."
Built with Next.js 14, TypeScript, Tailwind, Supabase, and Razorpay.

## Tech stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, React 18
- **Backend:** Next.js API routes, Supabase (PostgreSQL + PostGIS)
- **Auth:** Phone OTP via MSG91
- **Payments:** Razorpay + Razorpay Route for split payouts
- **Map:** Leaflet + OpenStreetMap
- **Images:** Cloudinary
- **Hosting:** Vercel

## Quick start

### 1. Clone and install

```bash
git clone <your-repo-url>
cd ev-charging-app
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Then open `.env.local` and fill in real values. You'll need accounts at:
- [Supabase](https://supabase.com) — database + auth
- [Razorpay](https://razorpay.com) — payments
- [MSG91](https://msg91.com) — phone OTP
- [Cloudinary](https://cloudinary.com) — image hosting

### 3. Set up the database

In your Supabase project, go to SQL Editor and run the migrations in
`supabase/migrations/` in order.

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
src/
├── app/                # Next.js pages and API routes
│   ├── api/            # Backend endpoints
│   ├── lender/         # Lender-side pages
│   ├── admin/          # Admin dashboard
│   └── ...
├── components/         # Reusable React components
├── lib/                # Shared utilities (Supabase, Razorpay, etc.)
├── hooks/              # Custom React hooks
└── types/              # Shared TypeScript types

supabase/migrations/    # Database schema as SQL files
```

## Development workflow

1. Pull latest from `main`: `git pull`
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make changes, commit, push
4. Open a pull request on GitHub
5. Get a review from another team member
6. Merge into `main`

Vercel auto-deploys every push to `main`.

## Useful commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run type-check   # Check TypeScript without building
npm run lint         # Lint the codebase
```

## Team

- Akash — booking flow, auth
- Hitesh — map, discovery
- Pooja — payments, admin

## Milestones

See [BUILD_PLAN.md](./BUILD_PLAN.md) for the detailed 15-week roadmap.

## License

Private — not for public distribution.
