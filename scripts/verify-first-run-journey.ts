/**
 * Hawkeye v0.9 — first-user journey + New Project Ocean presentation.
 * Deterministic. No OpenAI. No persistence architecture change.
 *
 * Run: npx tsx scripts/verify-first-run-journey.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  shouldShowFirstCaptureCue,
  shouldShowFirstProjectGuidance,
} from "../src/lib/first-run";

const ROOT = join(import.meta.dirname, "..");

function readSrc(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function check(name: string, fn: () => void) {
  fn();
  console.log(`✓ ${name}`);
}

function main() {
  const experience = readSrc("src/components/onboarding/NewProjectExperience.tsx");
  const review = readSrc("src/components/onboarding/ProjectSetupReview.tsx");
  const capture = readSrc("src/components/capture/CaptureWorkspace.tsx");
  const projectPage = readSrc("src/app/projects/[id]/page.tsx");
  const home = readSrc("src/app/page.tsx");
  const login = readSrc("src/app/login/page.tsx");
  const signup = readSrc("src/app/signup/page.tsx");
  const store = readSrc("src/lib/store.tsx");
  const persist = readSrc("src/lib/data/supabase/persist-mutations.ts");
  const oceanCss = readSrc("src/components/onboarding/new-project-ocean.css");

  check("zero-project home still opens New Project first-run", () => {
    assert.match(home, /zeroProjects/);
    assert.match(home, /NewProjectExperience/);
    assert.match(home, /variant="first-run"/);
    assert.doesNotMatch(home, /sample project|demo project|Start with a sample/i);
  });

  check("first user with no project can clearly create one", () => {
    assert.match(experience, /Tell Lume what this project is about/);
    assert.match(experience, /Talk It Through/);
    assert.match(experience, /Start Blank/);
    assert.match(experience, /Talk it through/);
    assert.match(experience, /Build My Project/);
    assert.match(experience, /Create Project/);
    assert.doesNotMatch(experience, /Paste Project Information/);
    assert.doesNotMatch(experience, /pricing|checkout|upgrade|Start trial/i);
  });

  check("New Project success adopts durable result only after createProject", () => {
    const fn = experience.slice(experience.indexOf("const createFromDraft"));
    const body = fn.slice(0, fn.indexOf("async function analyseNarrative"));
    assert.match(body, /await createProject\(/);
    assert.match(body, /setSuccess\(/);
    assert.match(body, /router\.push\(`\/projects\/\$\{id\}`\)/);
    const successIdx = body.indexOf("setSuccess(");
    const pushIdx = body.indexOf("router.push");
    const catchIdx = body.indexOf("} catch");
    assert.ok(successIdx > 0 && pushIdx > successIdx && successIdx < catchIdx);
    assert.match(body, /clientProjectId/);
    assert.match(body, /createLockRef/);
    assert.doesNotMatch(body, /persistNewProject\(/);
  });

  check("failure does not falsely imply project creation", () => {
    const fn = experience.slice(experience.indexOf("const createFromDraft"));
    const body = fn.slice(0, fn.indexOf("async function analyseNarrative"));
    assert.match(body, /setSuccess\(null\)/);
    assert.match(body, /Could not create the project/);
    assert.match(review, /np-create-error/);
    assert.match(experience, /np-create-error/);
    assert.doesNotMatch(experience, /np-tell-me-nudge/);
  });

  check("AI build failure stays on Talk and does not create", () => {
    assert.match(experience, /Nothing was created/);
    assert.doesNotMatch(experience, /Showing a local draft instead/);
    const analyse = experience.slice(experience.indexOf("async function analyseNarrative"));
    const analyseBody = analyse.slice(0, analyse.indexOf("function cancelBuild"));
    assert.doesNotMatch(analyseBody, /createProject\(/);
    assert.doesNotMatch(analyseBody, /setSuccess\(/);
    assert.doesNotMatch(analyseBody, /assembleFromNarrative/);
    assert.doesNotMatch(analyseBody, /setPath\("review"\)/);
    assert.doesNotMatch(analyseBody, /setCreateUnlocked\(true\)/);
  });

  check("first-project state transitions into workspace after create", () => {
    assert.match(experience, /router\.push\(`\/projects\/\$\{id\}`\)/);
    assert.match(projectPage, /OceanProjectWorkspace/);
    assert.match(projectPage, /FirstProjectGuidance/);
  });

  check("first-Capture cue appears only where intended", () => {
    assert.match(capture, /FirstCaptureCue/);
    assert.match(capture, /isOcean && !collapsed/);
    assert.equal(
      shouldShowFirstCaptureCue({
        dismissed: false,
        hasCaptureHistory: false,
        composeEmpty: true,
        analysing: false,
        reviewOpen: false,
        projectCount: 1,
      }),
      true,
    );
    assert.equal(
      shouldShowFirstProjectGuidance({
        dismissed: false,
        projectCount: 1,
        hasCaptureHistory: false,
      }),
      true,
    );
  });

  check("cue does not obstruct established users", () => {
    assert.equal(
      shouldShowFirstCaptureCue({
        dismissed: false,
        hasCaptureHistory: false,
        composeEmpty: true,
        analysing: false,
        reviewOpen: false,
        projectCount: 3,
      }),
      false,
    );
    assert.equal(
      shouldShowFirstCaptureCue({
        dismissed: false,
        hasCaptureHistory: true,
        composeEmpty: true,
        analysing: false,
        reviewOpen: false,
        projectCount: 1,
      }),
      false,
    );
    assert.equal(
      shouldShowFirstCaptureCue({
        dismissed: true,
        hasCaptureHistory: false,
        composeEmpty: true,
        analysing: false,
        reviewOpen: false,
        projectCount: 1,
      }),
      false,
    );
    assert.equal(
      shouldShowFirstCaptureCue({
        dismissed: false,
        hasCaptureHistory: false,
        composeEmpty: false,
        analysing: false,
        reviewOpen: false,
        projectCount: 1,
      }),
      false,
    );
    assert.equal(
      shouldShowFirstCaptureCue({
        dismissed: false,
        hasCaptureHistory: false,
        composeEmpty: true,
        analysing: false,
        reviewOpen: true,
        projectCount: 1,
      }),
      false,
    );
    assert.equal(
      shouldShowFirstProjectGuidance({
        dismissed: false,
        projectCount: 2,
        hasCaptureHistory: false,
      }),
      false,
    );
    assert.equal(
      shouldShowFirstProjectGuidance({
        dismissed: true,
        projectCount: 1,
        hasCaptureHistory: false,
      }),
      false,
    );
  });

  check("no tutorial engine, sample project, or commercial funnel", () => {
    assert.doesNotMatch(experience, /product tour|checklist|gamif/i);
    assert.doesNotMatch(home, /Start with a sample/);
    assert.doesNotMatch(signup, /pricing|upgrade|checkout|Start your trial/i);
    assert.doesNotMatch(login, /pricing|upgrade|checkout/i);
  });

  check("auth first-run copy stays a small polish", () => {
    assert.match(signup, /confirm your email/);
    assert.match(signup, /first project/);
    assert.match(signup, /Check your email/);
    assert.match(login, /confirmation link/);
    assert.match(login, /clearAuthenticatedBrowserState/);
  });

  check("mobile layout keeps usable controls and sticky CTAs", () => {
    assert.match(oceanCss, /min-height: 44px/);
    assert.match(oceanCss, /font-size: 16px/);
    assert.match(oceanCss, /safe-area-inset-bottom/);
    assert.match(oceanCss, /position: sticky/);
    assert.match(oceanCss, /np-transcript-field textarea/);
    const cueCss = readSrc("src/components/onboarding/first-run.css");
    assert.match(cueCss, /first-project-guidance/);
    assert.match(cueCss, /data-project-mode="capture"/);
  });

  check("Capture and persistence architecture unchanged", () => {
    assert.match(store, /\/api\/workspace\/projects/);
    assert.match(store, /createProjectInFlightRef/);
    const createFn = store.slice(store.indexOf("const createProject = useCallback"));
    const createBody = createFn.slice(0, createFn.indexOf("const cloneRelOps"));
    assert.doesNotMatch(createBody, /persistNewProject\(/);
    assert.match(persist, /export async function persistNewProject/);
    assert.doesNotMatch(capture, /planCaptureApply|executeCaptureApply/);
    assert.match(capture, /Nothing enters maintained project truth/);
  });

  check("review still happens before create", () => {
    assert.match(review, /Check this before anything is created/);
    assert.match(experience, /if \(!createUnlocked\)/);
    assert.match(experience, /Approve the categorisation map before creating/);
  });

  console.log("verify-first-run-journey: OK");
}

main();
