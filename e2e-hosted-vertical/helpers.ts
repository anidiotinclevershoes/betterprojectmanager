import { expect, type Page, type Response, type TestInfo } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import type {
  HostedApiCall,
  JourneyMatrixRow,
  Provenance,
  VerticalBoundary,
} from "./types";

export const RUN_ID = process.env.LUME_E2E_RUN_ID || `hv-${Date.now().toString(36)}`;

const SECRET_KEYS = /password|passwd|secret|token|cookie|authorization|api[_-]?key|openai|bypass/i;
const CALLS = new WeakMap<Page, HostedApiCall[]>();

export function hostedBaseUrl(): string {
  const raw = process.env.LUME_E2E_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || "";
  return raw.replace(/\/$/, "");
}

export function vercelBypassSecret(): string {
  return (
    process.env.LUME_E2E_VERCEL_BYPASS_SECRET ||
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET ||
    ""
  ).trim();
}

export function e2eEmail(): string {
  return (process.env.LUME_E2E_EMAIL || "").trim();
}

export function e2ePassword(): string {
  return process.env.LUME_E2E_PASSWORD || "";
}

export function missingHostedConfig(): string[] {
  const missing: string[] = [];
  if (!hostedBaseUrl()) missing.push("LUME_E2E_BASE_URL");
  if (!e2eEmail()) missing.push("LUME_E2E_EMAIL");
  if (!e2ePassword()) missing.push("LUME_E2E_PASSWORD");
  return missing;
}

export function requireHostedConfig(): { baseUrl: string; email: string; password: string } {
  const missing = missingHostedConfig();
  if (missing.length) {
    throw new Error(
      `AUTH: Hosted vertical journeys are opt-in and require ${missing.join(", ")}. See e2e-hosted-vertical/README.md.`,
    );
  }
  return { baseUrl: hostedBaseUrl(), email: e2eEmail(), password: e2ePassword() };
}

export function sanitizeValue(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    if (value.length > 4000) return `${value.slice(0, 4000)}…[truncated]`;
    return value;
  }
  if (Array.isArray(value)) return value.slice(0, 40).map(sanitizeValue);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEYS.test(key)) {
        out[key] = "[redacted]";
        continue;
      }
      out[key] = sanitizeValue(nested);
    }
    return out;
  }
  return value;
}

export function sanitizeBody(raw: string | undefined): unknown {
  if (!raw) return undefined;
  try {
    return sanitizeValue(JSON.parse(raw));
  } catch {
    const trimmed = raw.replace(SECRET_KEYS, "[redacted]");
    return trimmed.length > 2000 ? `${trimmed.slice(0, 2000)}…[truncated]` : trimmed;
  }
}

export function readProvenance(body: unknown): Provenance | undefined {
  if (!body || typeof body !== "object") return undefined;
  const provenance = (body as { provenance?: unknown }).provenance;
  if (!provenance || typeof provenance !== "object") return undefined;
  const rec = provenance as Record<string, unknown>;
  return {
    provider: typeof rec.provider === "string" ? rec.provider : undefined,
    requestedModel: typeof rec.requestedModel === "string" ? rec.requestedModel : undefined,
    responseModel: typeof rec.responseModel === "string" ? rec.responseModel : undefined,
    fallback: typeof rec.fallback === "boolean" ? rec.fallback : undefined,
    path: typeof rec.path === "string" ? rec.path : undefined,
  };
}

export function assertLiveOpenAi(provenance: Provenance | undefined, label: string): void {
  expect(provenance, `${label} must include D-051 provenance`).toBeTruthy();
  expect(provenance?.provider, `${label} provider`).toBe("openai");
  expect(provenance?.fallback, `${label} must not be a fallback path`).toBe(false);
}

export function classifyFromApi(call: HostedApiCall | undefined): VerticalBoundary | undefined {
  if (!call) return "HOSTED API";
  if (call.status === 0) return "HOSTED API";
  if (call.status === 401 || call.status === 403) return "AUTH";
  if (call.status >= 400) return "HOSTED API";
  const provenance = call.provenance;
  if (!provenance) return "OPENAI";
  if (provenance.provider !== "openai" || provenance.fallback !== false) return "OPENAI";
  return undefined;
}

export function classifyNewProjectLoss(
  call: HostedApiCall | undefined,
  peopleVisible: string[],
): VerticalBoundary {
  const apiBoundary = classifyFromApi(call);
  if (apiBoundary) return apiBoundary;
  const body = call?.body;
  if (body && typeof body === "object") {
    const draft = (body as { draft?: { stakeholders?: unknown[] } }).draft;
    const provisional = (body as { provisionalItems?: unknown[] }).provisionalItems || [];
    const stakeholders = draft?.stakeholders || [];
    if (stakeholders.length === 0 && provisional.length === 0) {
      return "VALIDATION";
    }
    if (stakeholders.length === 0 && provisional.length > 0) {
      return "NEW PROJECT ADAPTER";
    }
  }
  if (peopleVisible.length === 0) return "NEW PROJECT ADAPTER";
  return "IDENTITY";
}

export async function attachJson(testInfo: TestInfo, name: string, value: unknown): Promise<void> {
  await testInfo.attach(name, {
    body: JSON.stringify(value, null, 2),
    contentType: "application/json",
  });
}

export function recordedCalls(page: Page): HostedApiCall[] {
  return CALLS.get(page) ?? [];
}

export async function captureFailureArtifacts(args: {
  page: Page;
  testInfo: TestInfo;
  journey: string;
  calls?: HostedApiCall[];
  extra?: Record<string, unknown>;
}): Promise<void> {
  const dir = args.testInfo.outputPath("diagnostics");
  fs.mkdirSync(dir, { recursive: true });
  const screenshotPath = path.join(dir, `${slug(args.journey)}-failure.png`);
  await args.page
    .screenshot({ path: screenshotPath, fullPage: false, timeout: 8_000 })
    .catch(() => undefined);
  const url = args.page.url();
  const sso = await detectVercelSso(args.page);
  const visibleState = sso
    ? {
        url,
        title: await args.page.title().catch(() => ""),
        vercelSso: true,
        people: [],
        framePeople: [],
        frameKnowledge: [],
        needsYou: [],
        bodyTextPreview: "Vercel Deployment Protection SSO — Lume UI not reachable",
      }
    : {
        url,
        title: await args.page.title().catch(() => ""),
        people: await collectPeopleNames(args.page),
        framePeople: await frameLines(args.page, "np-frame-people"),
        frameKnowledge: await frameLines(args.page, "np-frame-knowledge"),
        needsYou: await collectNeedsYou(args.page),
        bodyTextPreview: ((await args.page.locator("body").innerText().catch(() => "")) || "").slice(
          0,
          2500,
        ),
      };
  const payload = {
    journey: args.journey,
    runId: RUN_ID,
    projectId: await currentProjectId(args.page),
    url,
    calls: args.calls ?? recordedCalls(args.page),
    visibleState,
    extra: sanitizeValue(args.extra || {}),
  };
  fs.writeFileSync(path.join(dir, `${slug(args.journey)}-failure.json`), JSON.stringify(payload, null, 2));
  await args.testInfo.attach("failure-screenshot", { path: screenshotPath }).catch(() => undefined);
  await attachJson(args.testInfo, "failure-diagnostics", payload);
}

export function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function currentProjectId(page: Page): Promise<string | undefined> {
  const attr = await page.locator("[data-project-id]").first().getAttribute("data-project-id").catch(() => null);
  if (attr) return attr;
  const match = page.url().match(/\/projects\/([^/?#]+)/);
  if (match?.[1] && match[1] !== "new") return match[1];
  return undefined;
}

export async function frameLines(page: Page, testId: string): Promise<string[]> {
  const items = page.getByTestId(testId).locator("li span, h4, .compact-change-title");
  const count = await items.count().catch(() => 0);
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const text = ((await items.nth(i).innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
    if (text) out.push(text);
  }
  return out;
}

export async function collectPeopleNames(page: Page): Promise<string[]> {
  const names = new Set<string>();
  for (const testId of ["np-frame-people", "kc-bucket-people", "ocean-frame-people"]) {
    for (const line of await frameLines(page, testId)) names.add(line);
  }
  if (names.size === 0) {
    const body = ((await page.locator("body").innerText().catch(() => "")) || "");
    for (const name of ["Bob", "Mike", "Olga Petrov", "Sarah Kim", "Andris"]) {
      if (new RegExp(`\\b${name}\\b`, "i").test(body)) names.add(name);
    }
  }
  return [...names];
}

export async function collectNeedsYou(page: Page): Promise<string[]> {
  const cards = page.locator("[data-testid='np-needs-you'] li, article[data-review-family='needs_you']");
  const count = await cards.count().catch(() => 0);
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const text = ((await cards.nth(i).innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
    if (text) out.push(text.slice(0, 400));
  }
  return out;
}

export function installApiRecorder(page: Page): { calls: HostedApiCall[] } {
  const calls: HostedApiCall[] = [];
  CALLS.set(page, calls);
  page.on("response", async (response) => {
    const url = response.url();
    if (!/\/api\/(new-project|capture(?:\/apply)?|auth\/login)(?:\?|$)/.test(url)) return;
    if (response.request().method() !== "POST") return;
    const call = await recordResponse(response);
    calls.push(call);
  });
  return { calls };
}

async function recordResponse(response: Response): Promise<HostedApiCall> {
  let text = "";
  try {
    text = await response.text();
  } catch {
    text = "";
  }
  const body = sanitizeBody(text);
  return {
    url: stripQuerySecrets(response.url()),
    method: response.request().method(),
    status: response.status(),
    body,
    provenance: readProvenance(body),
    requestPreview: sanitizeBody(response.request().postData() || undefined),
  };
}

function stripQuerySecrets(url: string): string {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (SECRET_KEYS.test(key)) parsed.searchParams.set(key, "[redacted]");
    }
    return `${parsed.origin}${parsed.pathname}${parsed.search}`;
  } catch {
    return url.split("?")[0] || url;
  }
}

export async function detectVercelSso(page: Page): Promise<boolean> {
  const url = page.url();
  if (/vercel\.com\/(?:login|sso|sso-api)|sso\.vercel|authentication required/i.test(url)) {
    return true;
  }
  const title = await Promise.race([
    page.title(),
    new Promise<string>((resolve) => setTimeout(() => resolve(""), 2000)),
  ]).catch(() => "");
  if (/authentication required|deployment protection/i.test(title)) return true;
  return false;
}

export async function signIn(page: Page): Promise<void> {
  const missing = missingHostedConfig();
  if (missing.includes("LUME_E2E_BASE_URL")) {
    throw new Error(
      "AUTH: Hosted vertical journeys are opt-in and require LUME_E2E_BASE_URL. See e2e-hosted-vertical/README.md.",
    );
  }
  const email = e2eEmail();
  const password = e2ePassword();
  const bypass = vercelBypassSecret();
  await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 20_000 });
  if ((await detectVercelSso(page)) && bypass) {
    await page.goto(`/login?x-vercel-protection-bypass=${encodeURIComponent(bypass)}`, {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    });
  }
  if (await detectVercelSso(page)) {
    throw new Error(
      "AUTH: Preview is behind Vercel Deployment Protection. Enable Protection Bypass for Automation and set LUME_E2E_VERCEL_BYPASS_SECRET. See e2e-hosted-vertical/README.md.",
    );
  }
  if (!email || !password) {
    throw new Error(
      `AUTH: Hosted vertical journeys require ${[!email && "LUME_E2E_EMAIL", !password && "LUME_E2E_PASSWORD"].filter(Boolean).join(" and ")} after reaching ${page.url()}. See e2e-hosted-vertical/README.md.`,
    );
  }
  if (!/\/login/.test(page.url()) && (await page.getByLabel("Email").count()) === 0) {
    return;
  }
  await expect(page.getByLabel("Email")).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await Promise.all([
    page
      .waitForResponse((res) => res.url().includes("/api/auth/login") && res.request().method() === "POST", {
        timeout: 30_000,
      })
      .catch(() => undefined),
    page.getByRole("button", { name: /^Sign in$/i }).click(),
  ]);
  await page.waitForURL((url) => !/\/login(?:\?|$)/.test(url.pathname), { timeout: 30_000 }).catch(() => undefined);
  if (/\/login/.test(page.url()) && (await page.getByLabel("Email").count()) > 0) {
    const body = ((await page.locator("body").innerText()) || "");
    const error = /invalid|don’t match|don't match|failed/i.test(body)
      ? "Invalid email or password"
      : "Still on /login after Sign in";
    throw new Error(`AUTH: ${error}`);
  }
}

export async function dismissCoachIfPresent(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog").filter({ hasText: "Ready when you are" });
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByRole("button").first().click();
    await expect(dialog).toBeHidden();
  }
}

export async function openNewProject(page: Page): Promise<void> {
  await page.goto("/projects/new", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("np-experience")).toBeVisible({ timeout: 20_000 });
}

export async function organiseNotes(page: Page, notes: string): Promise<HostedApiCall | undefined> {
  const organise = page.getByTestId("np-organise-notes");
  const details = page.locator("details").filter({ has: organise });
  if (await details.count()) {
    const open = await details.first().getAttribute("open");
    if (open == null) {
      await details.first().locator("summary").click();
    }
  }
  await expect(organise).toBeVisible({ timeout: 10_000 });
  await organise.fill(notes);
  const responsePromise = page.waitForResponse(
    (res) => /\/api\/new-project(?:\?|$)/.test(new URL(res.url()).pathname) && res.request().method() === "POST",
    { timeout: 180_000 },
  );
  await page.getByTestId("np-organise").click();
  const response = await responsePromise;
  await expect(page.getByTestId("np-organise")).toBeEnabled({ timeout: 180_000 });
  return recordResponse(response);
}

export async function fillProjectName(page: Page, name: string): Promise<void> {
  await page.getByTestId("np-name").fill(name);
}

export async function createProjectFromComposer(page: Page): Promise<string> {
  await expect(page.getByTestId("np-create")).toBeEnabled({ timeout: 10_000 });
  await page.getByTestId("np-create").click();
  await page.waitForURL((url) => /\/projects\/(?!new(?:\/|$))[^/]+/.test(url.pathname), {
    timeout: 60_000,
  });
  await expect(page.getByTestId("ocean-project-workspace")).toBeVisible({ timeout: 30_000 });
  return (await currentProjectId(page)) || "";
}

export async function hardReload(page: Page): Promise<void> {
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("ocean-project-workspace")).toBeVisible({ timeout: 30_000 });
}

export async function openKnowledge(page: Page): Promise<void> {
  await dismissCoachIfPresent(page);
  await page.getByTestId("ocean-mode-knowledge").click();
  await expect(page.getByTestId("ocean-knowledge-centre")).toBeVisible({ timeout: 15_000 });
}

export async function openCapture(page: Page): Promise<void> {
  await dismissCoachIfPresent(page);
  await page.getByTestId("ocean-mode-capture").click();
  await expect(page.getByTestId("ocean-capture-mode")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("ocean-capture-input")).toBeVisible({ timeout: 15_000 });
}

export async function analyseCapture(page: Page, text: string): Promise<HostedApiCall | undefined> {
  await page.getByTestId("ocean-capture-input").fill(text);
  const responsePromise = page.waitForResponse(
    (res) => {
      const pathname = new URL(res.url()).pathname;
      return pathname === "/api/capture" && res.request().method() === "POST";
    },
    { timeout: 180_000 },
  );
  await page.getByTestId("ocean-capture-analyse").click();
  const anyway = page.getByRole("button", { name: "Analyse anyway" });
  if (await anyway.isVisible().catch(() => false)) {
    await anyway.click();
  }
  const response = await responsePromise;
  await expect(page.getByTestId("ocean-capture-review")).toBeVisible({ timeout: 30_000 });
  return recordResponse(response);
}

export async function applyReady(page: Page): Promise<HostedApiCall | undefined> {
  const button = page.getByRole("button", { name: /Apply Ready/i });
  await expect(button).toBeEnabled({ timeout: 15_000 });
  const responsePromise = page.waitForResponse(
    (res) => {
      const pathname = new URL(res.url()).pathname;
      return pathname === "/api/capture/apply" && res.request().method() === "POST";
    },
    { timeout: 180_000 },
  );
  await button.click();
  const response = await responsePromise.catch(() => undefined);
  await page.getByText("Applied").first().waitFor({ timeout: 20_000 }).catch(() => undefined);
  return response ? recordResponse(response) : undefined;
}

export async function expectNoCaptureError(page: Page): Promise<void> {
  await expect(page.locator(".error-banner.capture-error")).toHaveCount(0);
}

export function reviewCards(page: Page) {
  return page.locator("article[data-review-family]");
}

export function reviewCardByName(page: Page, name: RegExp) {
  return page.locator("article[data-review-family]").filter({ hasText: name });
}

export async function reviewFamilies(page: Page): Promise<string[]> {
  const cards = reviewCards(page);
  const count = await cards.count();
  const families: string[] = [];
  for (let i = 0; i < count; i += 1) {
    families.push((await cards.nth(i).getAttribute("data-review-family")) || "unknown");
  }
  return families;
}

export function emptyMatrix(journey: string): JourneyMatrixRow {
  return {
    journey,
    hostedApi: "FAIL",
    liveOpenAi: "FAIL",
    uiInterpretation: "FAIL",
    review: "n/a",
    apply: "n/a",
    reload: "n/a",
    result: "FAIL",
  };
}

export function passCell(ok: boolean): JourneyMatrixRow["hostedApi"] {
  return ok ? "PASS" : "FAIL";
}

export function provenanceNote(call: HostedApiCall | undefined): string | undefined {
  const provenance = call?.provenance;
  if (!provenance) return undefined;
  return `provider=${provenance.provider ?? "?"} requested=${provenance.requestedModel ?? "?"} response=${provenance.responseModel ?? "?"} fallback=${String(provenance.fallback)}`;
}
