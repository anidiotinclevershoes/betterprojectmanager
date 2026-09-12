import { expect, type Browser, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  analyseCapture,
  applyReady,
  assertHostedAiSuccess,
  collectReviewCards,
  createProjectFromComposer,
  e2eEmail,
  expectNoCaptureError,
  fillProjectName,
  hardReload,
  installApiRecorder,
  openCapture,
  openKnowledge,
  openNewProject,
  organiseNotes,
  recordedCalls,
  reviewCards,
  signIn,
} from "../e2e-hosted-vertical/helpers";
import { textRepresentsYmd } from "../e2e-hosted-vertical/dates";
import { mentions, projectSlice } from "./ledger";
import { readWorkspaceState } from "./isolation";
import { NP_WORKING_TITLE, STATE0_MUST_INCLUDE } from "./new-project";
import type { CanonicalSlice, ReviewStep } from "./types";

export {
  analyseCapture,
  applyReady,
  assertHostedAiSuccess,
  collectReviewCards,
  createProjectFromComposer,
  e2eEmail,
  expectNoCaptureError,
  fillProjectName,
  hardReload,
  installApiRecorder,
  openCapture,
  openKnowledge,
  openNewProject,
  organiseNotes,
  recordedCalls,
  reviewCards,
  signIn,
  textRepresentsYmd,
};

export const ARTIFACT_DIR = path.join(process.cwd(), "test-results", "hosted-longrun");

export async function startFreshCapture(page: Page): Promise<void> {
  await openCapture(page);
  const input = page.getByTestId("ocean-capture-input");
  if (await input.isVisible().catch(() => false)) return;
  const neu = page.getByRole("button", { name: /^New Capture$/i });
  if (await neu.count()) await neu.click();
  await expect(input).toBeVisible({ timeout: 15_000 });
}

export async function collectRememberTexts(page: Page): Promise<string[]> {
  const items = page.locator(".capture-remember-text");
  const count = await items.count().catch(() => 0);
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const text = ((await items.nth(i).innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
    if (text) out.push(text);
  }
  return out;
}

export async function rememberExpectedKnowledge(page: Page, titles: string[]): Promise<string[]> {
  const notes: string[] = [];
  if (!titles.length) return notes;
  const rememberAll = page.getByRole("button", { name: /^Remember All$/i });
  const remember = page.getByRole("button", { name: /^Remember$/i });
  const texts = await collectRememberTexts(page);
  const hit = texts.some((text) => titles.some((title) => mentions(text, title)));
  if (hit && (await rememberAll.count())) {
    await rememberAll.click();
    notes.push(`Remember All (${texts.join(" | ")})`);
    return notes;
  }
  if (hit && (await remember.count())) {
    await remember.first().click();
    notes.push(`Remember (${texts[0]})`);
    return notes;
  }
  if (texts.length) notes.push(`remember panel present but no title match: ${texts.join(" | ")}`);
  return notes;
}

export function longrunRunId(): string {
  return (process.env.LUME_E2E_RUN_ID || `lr${Date.now().toString(36)}`).replace(/[^a-zA-Z0-9-]/g, "");
}

export function uniqueLongrunIdentity(runId: string): { name: string; code: string } {
  const compact = runId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(-8);
  return {
    name: `E2E-LONGRUN-${NP_WORKING_TITLE} ${runId}`,
    code: `LR${compact}`.slice(0, 12),
  };
}

export function writeJson(rel: string, value: unknown): string {
  const full = path.join(ARTIFACT_DIR, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, JSON.stringify(value, null, 2));
  return full;
}

export async function snapshotProject(page: Page, projectId: string): Promise<CanonicalSlice> {
  const ws = await readWorkspaceState(page);
  if (ws.status !== 200 || !ws.state) {
    throw new Error(`PERSIST: /api/workspace/state HTTP ${ws.status}`);
  }
  return projectSlice(ws.state as never, projectId, {
    workspaceId: ws.workspaceId,
    userId: ws.userId,
  });
}

export async function screenshot(page: Page, name: string): Promise<string> {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const dest = path.join(ARTIFACT_DIR, "screens", `${name}.png`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await page.screenshot({ path: dest, fullPage: false, timeout: 8_000 }).catch(() => undefined);
  return dest;
}

export async function bodyText(page: Page): Promise<string> {
  return ((await page.locator("body").innerText().catch(() => "")) || "").replace(/\s+/g, " ");
}

export async function readyApplyCount(page: Page): Promise<number> {
  const strong = page.locator(".lume-commit-ready strong");
  if (await strong.count()) {
    const n = Number(((await strong.first().innerText()) || "").trim());
    if (Number.isFinite(n)) return n;
  }
  const btn = page.getByRole("button", { name: /Apply \d+ changes/i });
  if (await btn.count()) {
    const label = (await btn.first().innerText()) || "";
    const m = label.match(/(\d+)/);
    if (m) return Number(m[1]);
  }
  return 0;
}

export function cardByMatch(page: Page, match: string) {
  return reviewCards(page).filter({ hasText: new RegExp(match, "i") }).first();
}

export async function applyReviewSteps(page: Page, steps: ReviewStep[]): Promise<string[]> {
  const notes: string[] = [];
  for (const step of steps) {
    const card = cardByMatch(page, step.match);
    const present = (await card.count()) > 0;
    if (!present) {
      notes.push(`${step.kind}: no card matching /${step.match}/`);
      continue;
    }
    if (step.kind === "exclude" || step.kind === "needs_you_exclude") {
      const btn = card.getByRole("button", { name: /Exclude change|Dismiss/i }).first();
      if (await btn.count()) {
        await btn.click();
        notes.push(`${step.kind}: clicked on /${step.match}/`);
      } else {
        notes.push(`${step.kind}: no Exclude/Dismiss on /${step.match}/`);
      }
      continue;
    }
    if (step.kind === "exclude_then_reinclude") {
      const exclude = card.getByRole("button", { name: /Exclude change|Dismiss/i }).first();
      if (await exclude.count()) await exclude.click();
      const include = page.getByRole("button", { name: /Include|Re-include|Undo|Restore/i });
      if (await include.count()) {
        await include.first().click();
        notes.push("reinclude: clicked Include/Undo");
      } else {
        notes.push("reinclude: PRODUCT_MODEL_GAP — no re-include control after Exclude");
      }
      continue;
    }
    if (step.kind === "edit_date" || (step.kind === "needs_you_resolve" && step.resolve === "date")) {
      const input = card.getByTestId("review-missing-date-input");
      if (await input.count()) {
        await input.fill(step.kind === "edit_date" ? step.date : step.date || "");
        const use = card.getByTestId("review-missing-date-apply");
        if (await use.count()) await use.click();
        notes.push(`edit_date: provided ${step.kind === "edit_date" ? step.date : step.date}`);
      } else {
        notes.push("edit_date: no date field on matching card");
      }
      continue;
    }
    if (step.kind === "edit_entity_kind") {
      const select = card.locator("select.compact-change-entity-select");
      if (await select.count()) {
        await select.selectOption(step.entity);
        const applyType = card.getByRole("button", { name: /Apply type/i });
        if (await applyType.count()) await applyType.click();
        notes.push(`edit_entity_kind: set ${step.entity}`);
      } else {
        notes.push("edit_entity_kind: no entity select (card may already be the intended kind)");
      }
      continue;
    }
    if (step.kind === "choose_target") {
      const choose = card.getByRole("button", { name: /Choose another/i });
      if (await choose.count()) {
        await choose.click();
        const option = page.getByRole("button", { name: new RegExp(step.target, "i") });
        if (await option.count()) {
          await option.first().click();
          notes.push(`choose_target: ${step.target}`);
        } else {
          notes.push(`choose_target: option ${step.target} missing`);
        }
      } else {
        notes.push("choose_target: no Choose another");
      }
      continue;
    }
    if (step.kind === "needs_you_resolve") {
      if (step.resolve === "use_this") {
        const btn = card.getByRole("button", { name: /Use this|Update existing|Update /i }).first();
        if (await btn.count()) {
          await btn.click();
          notes.push("needs_you_resolve: Use this — staged only if product does not auto-apply");
        } else notes.push("needs_you_resolve: no Use this");
      } else if (step.resolve === "create_new") {
        const btn = card.getByTestId("review-existing-or-new-create");
        if (await btn.count()) await btn.click();
        else notes.push("needs_you_resolve: no Create new");
      } else if (step.resolve === "resolve") {
        const btn = card.getByRole("button", { name: /Resolve|Complete|Resolve Risk/i }).first();
        if (await btn.count()) {
          await btn.click();
          notes.push("needs_you_resolve: Resolve clicked (product may write immediately)");
        } else notes.push("needs_you_resolve: no Resolve");
      } else if (step.resolve === "share" || step.resolve === "replace") {
        const testId = step.resolve === "share" ? "review-ownership-share" : "review-ownership-replace";
        const btn = card.getByTestId(testId);
        if (await btn.count()) {
          if (step.chooseName && step.resolve === "replace") {
            const named = card.getByRole("button", { name: new RegExp(step.chooseName, "i") });
            if (await named.count()) await named.first().click();
            else await btn.first().click();
          } else {
            await btn.first().click();
          }
          notes.push(`needs_you_resolve: ${step.resolve} (product may write immediately)`);
        } else {
          const use = card.getByRole("button", { name: /Use this|Approve|Update /i }).first();
          if (await use.count()) {
            await use.click();
            notes.push("needs_you_resolve: fell back to Use this/Approve");
          } else notes.push("needs_you_resolve: no ownership or approve control");
        }
      }
    }
  }
  return notes;
}

export async function applyIfReady(page: Page): Promise<{ applied: boolean; http?: number; error?: string }> {
  const count = await readyApplyCount(page);
  if (count <= 0) return { applied: false };
  try {
    const call = await applyReady(page);
    await expectNoCaptureError(page);
    return { applied: true, http: call?.status };
  } catch (error) {
    return { applied: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function ensureComposerPeople(page: Page, names: string[]): Promise<string[]> {
  const added: string[] = [];
  const frame = page.getByTestId("np-frame-people");
  const existing = ((await frame.innerText().catch(() => "")) || "").toLowerCase();
  for (const name of names) {
    if (existing.includes(name.toLowerCase())) continue;
    const input = frame.locator("form input").first();
    if (!(await input.count())) continue;
    await input.fill(name);
    await frame.locator("form").getByRole("button").click();
    added.push(name);
  }
  return added;
}

export async function projectionCheck(page: Page, slice: CanonicalSlice): Promise<string[]> {
  const misses: string[] = [];
  await openKnowledge(page);
  const text = await bodyText(page);
  for (const person of slice.people) {
    if (!new RegExp(person.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text)) {
      misses.push(`People projection missing ${person.name}`);
    }
  }
  for (const risk of slice.risks.filter((r) => r.status === "open" || r.status === "watch")) {
    const peopleTab = page.getByTestId("kc-bucket-issues");
    if (await peopleTab.count()) await peopleTab.click();
    const issues = await bodyText(page);
    if (!new RegExp(risk.title.slice(0, 18).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(issues + text)) {
      misses.push(`Issues projection missing open risk ${risk.title}`);
    }
  }
  await page.getByTestId("kc-bucket-knowledge").click().catch(() => undefined);
  const knowledgeText = await bodyText(page);
  for (const ms of slice.milestones) {
    if (!textRepresentsYmd(knowledgeText + text, ms.startAt) && !knowledgeText.toLowerCase().includes(ms.label.toLowerCase().slice(0, 12))) {
      misses.push(`Dates/knowledge projection weak for ${ms.label} ${ms.startAt}`);
    }
  }
  return misses;
}

export async function searchKnowledge(page: Page, query: string): Promise<string> {
  await openKnowledge(page);
  const search = page.getByRole("searchbox").or(page.getByPlaceholder(/search/i)).first();
  if (await search.count()) {
    await search.fill(query);
  }
  return bodyText(page);
}

export async function openDedicatedProject(page: Page, projectId: string): Promise<void> {
  await page.goto(`/projects/${projectId}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("ocean-project-workspace")).toBeVisible({ timeout: 30_000 });
}

export async function signOutIfPossible(page: Page): Promise<void> {
  const btn = page.getByRole("button", { name: /^Sign out$/i });
  if (await btn.count()) {
    await btn.click();
    await page.waitForURL(/login|welcome|signup/i, { timeout: 20_000 }).catch(() => undefined);
  }
}

export async function recreateSession(
  browser: Browser,
  projectId: string,
): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  installApiRecorder(page);
  await signIn(page);
  await openDedicatedProject(page, projectId);
  return page;
}

export function state0Gaps(slice: CanonicalSlice): string[] {
  const blob = [
    ...slice.people.map((p) => p.name),
    ...slice.todos.map((t) => t.title),
    ...slice.risks.map((r) => r.title),
    ...slice.milestones.map((m) => `${m.label} ${m.startAt}`),
    ...slice.knowledge.map((k) => k.body),
    ...slice.responsibilities.map((r) => `${r.personName} ${r.scope}`),
  ]
    .join(" ")
    .toLowerCase();
  const gaps: string[] = [];
  for (const name of STATE0_MUST_INCLUDE.people) {
    if (!blob.includes(name.toLowerCase())) gaps.push(`missing person ${name}`);
  }
  for (const token of STATE0_MUST_INCLUDE.issuesOrRisks) {
    if (!blob.includes(token.toLowerCase())) gaps.push(`missing issue/risk ${token}`);
  }
  for (const token of STATE0_MUST_INCLUDE.todos) {
    if (!blob.includes(token.toLowerCase())) gaps.push(`missing todo ${token}`);
  }
  for (const date of STATE0_MUST_INCLUDE.dates) {
    if (!blob.includes(date.ymd) && !blob.includes(date.label.toLowerCase())) {
      gaps.push(`missing date ${date.label} ${date.ymd}`);
    }
  }
  for (const token of STATE0_MUST_INCLUDE.knowledge) {
    if (!blob.includes(token.toLowerCase())) gaps.push(`missing knowledge ${token}`);
  }
  return gaps;
}
