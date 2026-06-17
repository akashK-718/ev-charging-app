# Context Package — Index

This package documents the EV Charging Marketplace project for AI coding assistants (Claude Code, Cursor, etc.) and new human team members.

## How to use this package

**Place all these files in your project repo root**, so they live alongside your code:

```
your-project/
├── CLAUDE.md              ← entry point — AI assistants read this first
├── .claude/
│   └── settings.json      ← Claude Code project settings
└── docs/
    ├── TECH_STACK.md
    ├── DATABASE_SCHEMA.md
    ├── ROADMAP.md
    ├── CODING_CONVENTIONS.md
    ├── API_DESIGN.md
    ├── USER_FLOWS.md
    ├── BUSINESS_RULES.md
    ├── CURRENT_STATUS.md
    └── TEAM_AND_PROCESS.md
```

Commit them to git. They evolve with the project.

## Reading order

For a new AI assistant joining the project:

1. **CLAUDE.md** — project overview, hard constraints, forbidden patterns (5 min)
2. **docs/TECH_STACK.md** — tools and why each was chosen (5 min)
3. **docs/ROADMAP.md** — what's in scope right now vs later (3 min)
4. **docs/CURRENT_STATUS.md** — what's done, what's blocked (2 min)
5. **docs/CODING_CONVENTIONS.md** — patterns to follow (5 min)

The other four are reference docs — load when relevant to the task:

- **DATABASE_SCHEMA.md** when working with data
- **API_DESIGN.md** when building endpoints
- **USER_FLOWS.md** when building UI
- **BUSINESS_RULES.md** when making policy decisions
- **TEAM_AND_PROCESS.md** when joining the team or reviewing PRs

## Keeping this fresh

The single most important habit: **update `CURRENT_STATUS.md` weekly**, after each demo. If it goes stale, AI assistants will give you stale advice.

For other files, update when the underlying decision changes:

- New tool added → update TECH_STACK.md
- Schema migration → update DATABASE_SCHEMA.md
- Policy change → update BUSINESS_RULES.md
- New convention adopted → update CODING_CONVENTIONS.md

The code is the ground truth. These docs describe intent. When they diverge, fix one or the other so they stay aligned.

## How to use this with Claude Code specifically

When using Claude Code (or similar AI coding assistants):

1. Place `CLAUDE.md` at your project root
2. Open the project in Claude Code
3. It will automatically read `CLAUDE.md` on session start
4. When making changes, Claude Code will reference the conventions and constraints documented here
5. Ask Claude Code to "read docs/X.md" when working on a specific area

For specific tasks, paste relevant sections into your prompt:

> "I'm starting Module 1 work on the OTP login flow. Reference CLAUDE.md, docs/API_DESIGN.md, and docs/CODING_CONVENTIONS.md. Build the `/api/auth/send-otp` and `/api/auth/verify-otp` endpoints following our patterns."

That gives the assistant maximum context without you having to re-explain the project.
