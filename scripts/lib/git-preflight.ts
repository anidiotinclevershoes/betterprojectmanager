/**
 * Branch freshness classification for Lume.
 *
 * Commit counts alone do not prove semantic safety. A single architecture
 * commit on main can make a branch more dangerous than twenty docs commits.
 */

export type BranchClassification =
  | "CURRENT"
  | "MINOR DRIFT"
  | "MATERIALLY STALE"
  | "EXPERIMENT";

export const MATERIAL_PATH_PREFIXES = [
  "src/lib/capture/",
  "src/lib/data/supabase/",
  "src/lib/store.tsx",
  "src/lib/types.ts",
  "src/types/database.ts",
  "supabase/migrations/",
  "src/lib/canonical-truth/",
] as const;

export function isMaterialPath(file: string): boolean {
  return MATERIAL_PATH_PREFIXES.some(
    (prefix) => file === prefix || file.startsWith(prefix),
  );
}

export function classifyBranch(input: {
  experiment: boolean;
  containsCurrentMain: boolean;
  behindCount: number;
  filesChangedOnMainSinceMergeBase: string[];
}): {
  classification: BranchClassification;
  materialFilesOnMain: string[];
  failNormalWork: boolean;
} {
  const materialFilesOnMain = input.filesChangedOnMainSinceMergeBase.filter(
    isMaterialPath,
  );

  if (input.experiment) {
    return {
      classification: "EXPERIMENT",
      materialFilesOnMain,
      failNormalWork: false,
    };
  }

  if (input.containsCurrentMain && input.behindCount === 0) {
    return {
      classification: "CURRENT",
      materialFilesOnMain,
      failNormalWork: false,
    };
  }

  if (materialFilesOnMain.length > 0 || !input.containsCurrentMain) {
    if (materialFilesOnMain.length > 0) {
      return {
        classification: "MATERIALLY STALE",
        materialFilesOnMain,
        failNormalWork: true,
      };
    }
    return {
      classification: "MINOR DRIFT",
      materialFilesOnMain,
      failNormalWork: false,
    };
  }

  return {
    classification: "MINOR DRIFT",
    materialFilesOnMain,
    failNormalWork: false,
  };
}
