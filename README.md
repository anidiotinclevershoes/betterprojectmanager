# Mission Control

**AI Chief Project Officer · Executive Coach · Second Brain**

Mission Control is not a project management application.

Its primary responsibility is not to manage projects.

Its primary responsibility is to make **you** a better Project Manager.

Every feature answers:

> Will this help the user sound like the confident person leading the project?

Every recommendation is generated as if by an exceptional Programme Manager asking:

> If I were an exceptional Programme Manager, what would I do next?

## What it does

- **Overview dashboard** — cross-project KPIs and the most pertinent coaching moves
- **Project tabs** — ATLAS, HORIZON (and more) each with a focused leadership dashboard
- **Capture** — notes, conversations and voice scraps analysed immediately
- **Meeting strategy** — before / during / after prep so you lead the room
- **Institutional memory** — answer questions months later (“Why did we delay Release 8?”)
- **Release playbook** — monthly lifecycle coaching from merge window through hypercare and closure

## Principles baked into the product

| Principle | Behaviour |
| --- | --- |
| Never passive | New information triggers continuous analysis |
| Coach, don’t display | Every recommendation explains *why* it matters |
| Imperfect information | Reasons from conversations and notes; labels assumptions instead of blocking |
| Leadership presence | Scripts, challenges and ownership moments — not ticket creation |
| Daily test | “How can I make this PM look calm, prepared, proactive and trusted today?” |

Core mission source of truth: [`src/lib/mission.ts`](src/lib/mission.ts)

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Demo projects (Atlas Release 9, Horizon roadmap) and institutional memory load automatically. State persists in `localStorage`.

```bash
npm run build   # production build
npm run lint    # eslint
npm run verify  # coaching engine smoke checks
```

## Stack

- Next.js App Router · React 19 · TypeScript · Tailwind CSS 4
- Rule-based coaching engine in `src/lib/coach.ts` (AI-provider ready via `COACHING_SYSTEM_PROMPT` in `src/lib/mission.ts`)

## Product north star

Mission Control should never ask *“What task should I create?”*

It should ask:

> How can I make this Project Manager look calm, prepared, proactive and trusted today?
