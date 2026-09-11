# Prompt experiment scoring

Do **not** optimise for maximum observation count.

Fixed across A/B/C/D: model (`gpt-4o-mini-2024-07-18` unless `OPENAI_MODEL` is set), temperature 0.2, corpus transcripts, downstream resolve/plan (current branch), scoring code.

## What we score (higher is better unless noted)

| Signal | Direction | Notes |
| --- | --- | --- |
| Correct observation recall | higher | Required names/facts from the frozen holdout appear |
| Hallucination / invention | lower | Names or target ids not in transcript/records |
| Identity contamination | lower | Sibling names bind the wrong observation |
| Wrong entity attachment | lower | Fact hung on the wrong person/record |
| Incorrect target IDs | lower | Invented or foreign ids |
| Unsafe inference | lower | Pronoun resolved, contradiction collapsed |
| Preserved ambiguity | higher | Pronoun / competing names stay Needs You |
| Correct typed entity | higher | person vs responsibility vs milestone, etc. |
| Correct Create/Update suitability | higher | New name is create; existing date is update |
| Contradiction preservation | higher | Both claims survive |
| Name-only People not omitted | higher | Bob/Mike class |
| Downstream executability | higher | Ready writes that Apply can execute |
| Needs You volume | informational | More Needs You is not a fail if it is safer |

Prefer slightly fewer, cleaner observations over unsafe false certainty.

## Holdout

`holdout.ts` was frozen at `PROMPT_HOLDOUT_FROZEN_AT` **before** variants B/C/D were compared. Do not edit expectations to fit a winner.
