/**
 * Optional live stacked Capture hook.
 * Sequential live-model apply is not implemented in this slice.
 * Never fakes success. Never mutates real user data.
 *
 *   npm run eval:stacked-capture
 */
function hasKey(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function main() {
  console.log("Stacked Capture live hook");
  console.log("This is a measuring instrument. Do not tune prompts against it.\n");

  const openai = hasKey("OPENAI_API_KEY");
  const anthropic = hasKey("ANTHROPIC_API_KEY");
  const gemini = hasKey("GEMINI_API_KEY");

  if (!openai && !anthropic && !gemini) {
    console.error(
      "Live stacked Capture skipped: no OPENAI_API_KEY / ANTHROPIC_API_KEY / GEMINI_API_KEY. No results were invented.",
    );
    process.exit(2);
  }

  console.error(
    [
      "Provider keys are present, but sequential live stacked apply is not enabled in this slice.",
      "It would need a live model call between real Review/apply steps against evolving fictional worlds.",
      "Use `npm run eval:capture-v2` for the frozen 22-case corpus, and `npm run test:stacked-capture` for deterministic sequential journeys.",
      "No live stacked results were invented. Prompts were not changed.",
    ].join("\n"),
  );
  process.exit(2);
}

main();
