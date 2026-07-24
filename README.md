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

- **Quick capture on Overview** — type or speak from the top of the main dashboard
- **Voice notes** — record → Whisper transcription → ChatGPT tidy-up → coaching updates
- **Overview dashboard** — KPIs and the most pertinent coaching moves
- **Project tabs** — ATLAS, HORIZON (and more) each with a focused leadership dashboard
- **Meeting strategy** — before / during / after prep so you lead the room
- **Institutional memory** — answer questions months later (“Why did we delay Release 8?”)
- **Release playbook** — monthly lifecycle coaching from merge window through hypercare and closure

## Quick start

```bash
npm install
cp .env.local.example .env.local
# Put your OpenAI API key in .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Connect your ChatGPT / OpenAI account

1. Create an API key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Add it to `.env.local`:

```bash
OPENAI_API_KEY=sk-...
# optional
# OPENAI_MODEL=gpt-4o-mini
```

3. Restart `npm run dev`

**Note:** ChatGPT Plus and the OpenAI API are billed separately. Same OpenAI login can use both; the app needs an **API key**, not your ChatGPT password.

Without a key, typed capture still works with the local coaching engine. Voice transcription requires the key (Whisper).

```bash
npm run build   # production build
npm run lint    # eslint
npm run verify  # coaching engine smoke checks
```

## Stack

- Next.js App Router · React 19 · TypeScript · Tailwind CSS 4
- OpenAI Whisper (voice) + Chat Completions (tidy + coach)
- Local fallback coaching in `src/lib/coach.ts`

## Product north star

Mission Control should never ask *“What task should I create?”*

It should ask:

> How can I make this Project Manager look calm, prepared, proactive and trusted today?
