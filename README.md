# Lume

**You can't keep an entire project in your head. Lume can.**

Lume is an individual-first project-memory companion for project managers. Capture notes, review before anything is written, keep truth in Knowledge Centre, ask questions, and catch up on a project.

v0.9 is the **safe closed-alpha product**. Durable authority is **Supabase**. Production auth is **Supabase Auth**. Capture V2 is the sole Analyse → Review → Apply engine.

This root README is onboarding only. It is **not** the product specification.

| Start here | Why |
| --- | --- |
| [`docs/README.md`](docs/README.md) | Documentation authority map |
| [`docs/LUME_V09_TO_V1_HANDOFF.md`](docs/LUME_V09_TO_V1_HANDOFF.md) | What v0.9 is, what is frozen, remaining debt, path to V1 |
| [`docs/v1-reference-pack/`](docs/v1-reference-pack/) | Product / trust / Ocean UI constitution |
| [`docs/LUME_V1_KNOWN_DISCOVERIES.md`](docs/LUME_V1_KNOWN_DISCOVERIES.md) | Open vs resolved defects |

Do **not** treat older Phase/SLICE handovers, `docs/EXPERIMENTAL_PROGRAMME.md`, or Mission Control / localStorage copy as current architecture.

Production: https://betterprojectmanager.vercel.app

## Quick start

```bash
npm install
cp .env.local.example .env.local
# Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, OPENAI_API_KEY
# Production also needs SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SITE_URL
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Hosted setup: [`docs/VERCEL_PRODUCTION_SETUP.md`](docs/VERCEL_PRODUCTION_SETUP.md).

```bash
npm run build
npm run lint
npm test
```

`DEMO_USERS` / localStorage-as-truth is **not** the production path. Do not enable demo auth in production.

## What v0.9 is (one paragraph)

Modes: **Capture | Knowledge Centre | Catch Me Up | Advise (coming soon)**. Coach is hidden. Nothing durable is written until the user approves Capture Review. Needs-you is success for difficult cases. Ask Lume and Catch Me Up use authenticated server-loaded project truth.

## Stack

Next.js App Router · React · TypeScript · Tailwind · Supabase (Postgres + Auth + RLS) · OpenAI (`gpt-4o-mini-2024-07-18` for frozen Capture)

## Historical name

The repository and some leftover copy still say “Mission Control”. The product is **Lume**.
