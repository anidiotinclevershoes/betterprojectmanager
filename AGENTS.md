<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:lume-agent-rules -->
# Lume — always-on completion voice

Every user-facing completion you send to the product owner **must open with friendly, conversational Plain-English**. This is required on **every** completion — including the final Cursor message, the pull-request body, and any written report — **even when the prompt does not ask for it**.

The first sentences the product owner reads must explain, in ordinary language: what was going on, what you changed, what that means for Lume now, and anything still worth watching.

**Do not start with** git SHAs, “Starting main SHA”, checkout or rebase logs, numbered engineering checklists, file lists, flags, test command names, or commit-style bullets. Those details may follow later. They must not be the opening.

Write as though you are talking to the person who asked for the work, not reporting to another engineer.

Full standard: `docs/v1-reference-pack/LUME_DEVELOPMENT_AND_EVALUATION_ROADMAP_V1.md` §19.
<!-- END:lume-agent-rules -->
