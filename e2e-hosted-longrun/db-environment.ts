/**
 * Prove the production origin under test writes to the expected Supabase project.
 * Uses only the public JS bundle — no service-role key, no customer data.
 */
import { LONGRUN_PRODUCTION_ORIGIN } from "./types";
import {
  LONGRUN_PRODUCTION_DB_HOST,
  LONGRUN_PRODUCTION_SUPABASE_NAME,
  LONGRUN_PRODUCTION_SUPABASE_REF,
  LONGRUN_PRODUCTION_SUPABASE_URL,
} from "./db-verify";

export type DbEnvironmentProof = {
  ok: boolean;
  origin: string;
  supabaseName: string;
  supabaseRef: string;
  supabaseUrl: string;
  databaseHost: string;
  observedRefs: string[];
  proof: string;
  reason?: string;
};

export async function proveProductionSupabaseCorrespondence(
  origin = LONGRUN_PRODUCTION_ORIGIN,
): Promise<DbEnvironmentProof> {
  const base = origin.replace(/\/$/, "");
  const observed = new Set<string>();
  try {
    const login = await fetch(`${base}/login`);
    if (!login.ok) {
      return fail(base, `login HTTP ${login.status}`);
    }
    const html = await login.text();
    const srcs = [...html.matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
    for (const src of srcs) {
      const url = src.startsWith("http") ? src : `${base}${src}`;
      const js = await fetch(url);
      if (!js.ok) continue;
      const body = await js.text();
      for (const m of body.matchAll(/https:\/\/([a-z0-9-]+)\.supabase\.co/g)) {
        observed.add(m[1]);
      }
    }
  } catch (error) {
    return fail(base, error instanceof Error ? error.message : String(error));
  }
  const refs = [...observed].sort();
  if (refs.length !== 1 || refs[0] !== LONGRUN_PRODUCTION_SUPABASE_REF) {
    return fail(
      base,
      refs.length === 0
        ? "no supabase.co URL in production JS"
        : `production JS refs ${refs.join(",")} !== ${LONGRUN_PRODUCTION_SUPABASE_REF}`,
      refs,
    );
  }
  return {
    ok: true,
    origin: base,
    supabaseName: LONGRUN_PRODUCTION_SUPABASE_NAME,
    supabaseRef: LONGRUN_PRODUCTION_SUPABASE_REF,
    supabaseUrl: LONGRUN_PRODUCTION_SUPABASE_URL,
    databaseHost: LONGRUN_PRODUCTION_DB_HOST,
    observedRefs: refs,
    proof: `Production ${base}/login JS embeds ${LONGRUN_PRODUCTION_SUPABASE_URL}`,
  };
}

function fail(origin: string, reason: string, observedRefs: string[] = []): DbEnvironmentProof {
  return {
    ok: false,
    origin,
    supabaseName: LONGRUN_PRODUCTION_SUPABASE_NAME,
    supabaseRef: LONGRUN_PRODUCTION_SUPABASE_REF,
    supabaseUrl: LONGRUN_PRODUCTION_SUPABASE_URL,
    databaseHost: LONGRUN_PRODUCTION_DB_HOST,
    observedRefs,
    proof: "",
    reason,
  };
}
