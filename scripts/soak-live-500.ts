/**
 *   npm run soak:live-500 -- --out=longhaul-500-soak
 *
 * Live 500 two-project durability soak. Not in npm test.
 */
import { runLive500 } from "./soak/live-500";

function arg(name: string, fallback: string) {
  const prefixed = `--${name}`;
  const idx = process.argv.indexOf(prefixed);
  if (idx >= 0) return process.argv[idx + 1] ?? fallback;
  const eq = process.argv.find((a) => a.startsWith(`${prefixed}=`));
  if (eq) return eq.slice(prefixed.length + 1);
  return fallback;
}

async function main() {
  const out = arg("out", "longhaul-500-soak");
  const result = await runLive500(out);
  if (result.liveBlocked) {
    console.error(result.liveBlocked);
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
