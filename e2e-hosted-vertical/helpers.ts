import { expect, type Page, type Response, type TestInfo } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { organisedDraftHasYmd, textRepresentsYmd } from "./dates";
import type {
  HostedApiCall,
  JourneyMatrixRow,
  MatrixCell,
  Provenance,
  VerticalBoundary,
} from "./types";

export { organisedDraftHasYmd, textRepresentsYmd } from "./dates";

export type JourneyKind = "bob" | "full" | "capture" | "andris" | "ambiguity" | "mixed";

const JOURNEY_CODE_PREFIX: Record<JourneyKind, string> = {
  bob: "B",
  full: "F",
  capture: "C",
  andris: "N",
  ambiguity: "G",
  mixed: "M",
};

export const RUN_ID = process.env.LUME_E2E_RUN_ID || `hv-${Date.now().toString(36)}`;

const SECRET_KEYS = /password|passwd|secret|token|cookie|authorization|api[_-]?key|openai|bypass|email/i;
const CALLS = new WeakMap<Page, HostedApiCall[]>();
const AUDIT_PATH = path.join(process.cwd(), "test-results", "hosted-vertical", "openai-audit.jsonl");
const recentAudit: string[] = [];

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

export function redactPageUrl(raw: string): string {
  try {
    const parsed = new URL(raw);
    for (const key of [...parsed.searchParams.keys()]) {
      if (SECRET_KEYS.test(key) || /vercel|bypass/i.test(key)) parsed.searchParams.set(key, "[redacted]");
    }
    const search = parsed.searchParams.toString();
    return `${parsed.pathname}${search ? `?${search}` : ""}`;
  } catch {
    return "/unknown";
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
  if (!call) return "HOSTED_API";
  if (call.status === 0) return "HOSTED_API";
  if (call.status === 401 || call.status === 403) return "AUTH";
  if (call.status >= 400) return "HOSTED_API";
  const provenance = call.provenance;
  if (!provenance) return "OPENAI";
  if (provenance.provider !== "openai" || provenance.fallback !== false) return "OPENAI";
  return undefined;
}

export function uniqueProjectIdentity(kind: JourneyKind): { name: string; code: string } {
  const compact = RUN_ID.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(-10);
  const code = `${JOURNEY_CODE_PREFIX[kind]}${compact}`.slice(0, 12);
  return {
    name: `E2E ${kind} ${RUN_ID}`,
    code,
  };
}

export async function fillUniqueProject(page: Page, kind: JourneyKind): Promise<{ name: string; code: string }> {
  const identity = uniqueProjectIdentity(kind);
  await fillProjectName(page, identity.name);
  const codeField = page.getByTestId("np-code");
  await expect(codeField).toBeVisible({ timeout: 20_000 });
  await codeField.fill(identity.code);
  await expect(codeField).toHaveValue(identity.code);
  return identity;
}

export async function addComposeLine(page: Page, testId: string, value: string): Promise<void> {
  const frame = page.getByTestId(testId);
  await expect(frame).toBeVisible({ timeout: 20_000 });
  const input = frame.locator("form input").first();
  await expect(input).toBeVisible();
  await input.fill(value);
  await frame.locator("form").getByRole("button").click();
  await expect(frame.locator("li span").filter({ hasText: value })).toBeVisible({
    timeout: 10_000,
  });
}

export async function assertHostedSessionReady(page: Page): Promise<void> {
  const deadline = Date.now() + 40_000;
  let last = "no-probe";
  while (Date.now() < deadline) {
    const probe = await page.evaluate(async () => {
      async function peek(path: string): Promise<{ status: number; hasUser?: boolean }> {
        const res = await fetch(path, { credentials: "include", cache: "no-store" });
        if (path.includes("/api/auth/me")) {
          const json = (await res.json().catch(() => ({}))) as { user?: { id?: string } };
          return { status: res.status, hasUser: Boolean(json.user?.id) };
        }
        return { status: res.status };
      }
      const [me, workspace, billing] = await Promise.all([
        peek("/api/auth/me"),
        peek("/api/workspace/state"),
        peek("/api/billing/status"),
      ]);
      return { meStatus: me.status, hasUser: Boolean(me.hasUser), wsStatus: workspace.status, billingStatus: billing.status };
    });
    last = JSON.stringify(probe);
    if (
      probe.meStatus === 200 &&
      probe.hasUser &&
      probe.wsStatus !== 401 &&
      probe.billingStatus !== 401 &&
      (probe.wsStatus === 200 || probe.billingStatus === 200)
    ) {
      return;
    }
    await page.waitForTimeout(400);
  }
  throw new Error(`AUTH: session not ready after login (${last})`);
}

function unauthenticatedMessage(call: HostedApiCall, label: string): string {
  const body = call.body && typeof call.body === "object" ? (call.body as Record<string, unknown>) : {};
  const code = typeof body.code === "string" ? body.code : "";
  const error = typeof body.error === "string" ? body.error : "";
  return `AUTH: ${label} ${call.method} ${call.url} HTTP ${call.status}${code ? ` ${code}` : ""}${error ? ` ${error}` : ""} after session readiness. Not retrying.`;
}

export function throwIfUnauthenticatedAiCall(call: HostedApiCall, label: string): void {
  if (call.status === 401 || call.status === 403) {
    throw new Error(unauthenticatedMessage(call, label));
  }
}

export function assertHostedAiSuccess(call: HostedApiCall | undefined, label: string): HostedApiCall {
  if (!call) {
    throw new Error(`HOSTED_API: ${label} did not return a recorded response.`);
  }
  throwIfUnauthenticatedAiCall(call, label);
  if (call.status !== 200) {
    throw new Error(`HOSTED_API: ${label} HTTP ${call.status}`);
  }
  assertLiveOpenAi(call.provenance, label);
  return call;
}

export async function collectReviewCards(
  page: Page,
): Promise<Array<{ family: string; text: string }>> {
  const cards = reviewCards(page);
  const count = await cards.count();
  const out: Array<{ family: string; text: string }> = [];
  for (let i = 0; i < count; i += 1) {
    const family = (await cards.nth(i).getAttribute("data-review-family")) || "unknown";
    const text = ((await cards.nth(i).innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
    if (text) out.push({ family, text: text.slice(0, 500) });
  }
  return out;
}

export async function openKnowledgeDates(page: Page): Promise<string> {
  await openKnowledge(page);
  const knowledgeTab = page.getByTestId("kc-bucket-knowledge");
  if ((await knowledgeTab.count()) > 0) await knowledgeTab.click();
  const datesTab = page.getByTestId("kc-subtype-dates");
  if ((await datesTab.count()) > 0) await datesTab.click();
  return ((await page.locator("body").innerText().catch(() => "")) || "").replace(/\s+/g, " ");
}

export function assertTextRepresentsYmd(text: string, ymd: string, label: string): void {
  if (textRepresentsYmd(text, ymd)) return;
  throw new Error(`${label} does not represent ${ymd}.`);
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
      return "NEW_PROJECT_ADAPTER";
    }
  }
  if (peopleVisible.length === 0) return "NEW_PROJECT_ADAPTER";
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

async function clearCredentialFields(page: Page): Promise<void> {
  const email = page.getByLabel("Email");
  const password = page.getByLabel("Password");
  if (await email.count()) await email.fill("").catch(() => undefined);
  if (await password.count()) await password.fill("").catch(() => undefined);
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
  await clearCredentialFields(args.page);
  const screenshotPath = path.join(dir, `${slug(args.journey)}-failure.png`);
  await args.page
    .screenshot({ path: screenshotPath, fullPage: false, timeout: 8_000 })
    .catch(() => undefined);
  const url = redactPageUrl(args.page.url());
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
  return { calls };
}

function rememberCall(page: Page, call: HostedApiCall): void {
  const calls = CALLS.get(page) ?? [];
  calls.push(call);
  CALLS.set(page, calls);
}

function appendOpenAiAudit(call: HostedApiCall): void {
  let pathname = call.url;
  try {
    pathname = new URL(call.url, "https://lume.example").pathname;
  } catch {
    pathname = call.url.split("?")[0] || call.url;
  }
  if (!/^\/api\/(new-project|capture)$/.test(pathname)) return;
  const line = JSON.stringify({
    runId: RUN_ID,
    path: pathname,
    status: call.status,
    provenance: call.provenance || null,
  });
  if (recentAudit.includes(line)) return;
  recentAudit.push(line);
  fs.mkdirSync(path.dirname(AUDIT_PATH), { recursive: true });
  fs.appendFileSync(AUDIT_PATH, `${line}\n`);
}

async function recordResponse(response: Response): Promise<HostedApiCall> {
  const url = stripQuerySecrets(response.url());
  let pathname = url;
  try {
    pathname = new URL(url, "https://lume.example").pathname;
  } catch {
    pathname = url.split("?")[0] || url;
  }
  if (/\/api\/auth\//.test(pathname)) {
    return {
      url: pathname,
      method: response.request().method(),
      status: response.status(),
      body: { authResponse: "[redacted]", ok: response.status() < 400 },
    };
  }
  let text = "";
  try {
    text = await response.text();
  } catch {
    text = "";
  }
  const body = sanitizeBody(text);
  const call: HostedApiCall = {
    url: pathname,
    method: response.request().method(),
    status: response.status(),
    body,
    provenance: readProvenance(body),
    requestPreview: sanitizeBody(response.request().postData() || undefined),
  };
  appendOpenAiAudit(call);
  return call;
}

async function recordAndRemember(page: Page, response: Response): Promise<HostedApiCall> {
  const call = await recordResponse(response);
  rememberCall(page, call);
  return call;
}

function stripQuerySecrets(url: string): string {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (SECRET_KEYS.test(key)) parsed.searchParams.set(key, "[redacted]");
    }
    return `${parsed.pathname}${parsed.search}`;
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

export async function signIn(page: Page): Promise<{ vercelAccess: MatrixCell; lumeAuth: MatrixCell }> {
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
    await page.goto("/login", {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    });
  }
  if (await detectVercelSso(page)) {
    throw new Error(
      "VERCEL_PROTECTION: Preview is behind Vercel Deployment Protection. Enable Protection Bypass for Automation and set LUME_E2E_VERCEL_BYPASS_SECRET. See e2e-hosted-vertical/README.md.",
    );
  }
  if (!email || !password) {
    throw new Error(
      `AUTH: Hosted vertical journeys require ${[!email && "LUME_E2E_EMAIL", !password && "LUME_E2E_PASSWORD"].filter(Boolean).join(" and ")} after reaching Lume /login. See e2e-hosted-vertical/README.md.`,
    );
  }
  if (!/\/login/.test(page.url()) && (await page.getByLabel("Email").count()) === 0) {
    await assertHostedSessionReady(page);
    return { vercelAccess: "PASS", lumeAuth: "PASS" };
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
    await clearCredentialFields(page);
    const error = /invalid|don’t match|don't match|failed/i.test(body)
      ? "Invalid email or password"
      : "Still on /login after Sign in";
    throw new Error(`AUTH: ${error}`);
  }
  await assertHostedSessionReady(page);
  return { vercelAccess: "PASS", lumeAuth: "PASS" };
}

export async function dismissCoachIfPresent(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog").filter({ hasText: "Ready when you are" });
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByRole("button").first().click();
    await expect(dialog).toBeHidden();
  }
}

export async function openNewProject(page: Page): Promise<void> {
  await page.goto("/projects/new", { waitUntil: "load" });
  await expect(page.getByTestId("np-experience")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel("Project name")).toBeEditable({ timeout: 20_000 });
}

export async function organiseNotes(page: Page, notes: string): Promise<HostedApiCall | undefined> {
  const details = page.locator("details.np-organise");
  if ((await details.count()) && (await details.first().getAttribute("open")) == null) {
    await details.first().locator("summary").click();
  }
  const organise = page.getByTestId("np-organise-notes");
  await expect(organise).toBeVisible({ timeout: 10_000 });
  await organise.fill(notes);
  await expect(organise).toHaveValue(notes);
  const responsePromise = page.waitForResponse(
    (res) => /\/api\/new-project(?:\?|$)/.test(new URL(res.url()).pathname) && res.request().method() === "POST",
    { timeout: 180_000 },
  );
  await page.getByTestId("np-organise").click();
  const pasteError = page.getByText("Paste some notes first.");
  const pasteShown = await pasteError
    .waitFor({ state: "visible", timeout: 2_000 })
    .then(() => true)
    .catch(() => false);
  if (pasteShown) {
    throw new Error("UI_INPUT: Organise ran with empty notes.");
  }
  const http = await responsePromise;
  await expect(page.getByTestId("np-organise")).toBeEnabled({ timeout: 180_000 });
  const call = await recordAndRemember(page, http);
  throwIfUnauthenticatedAiCall(call, "Organise");
  return call;
}

export async function fillProjectName(page: Page, name: string): Promise<void> {
  const field = page.getByTestId("np-name");
  await expect(field).toHaveCount(1);
  await expect(field).toBeVisible({ timeout: 20_000 });
  await field.fill(name);
  await expect(field).toHaveValue(name);
}

export async function createProjectFromComposer(page: Page): Promise<string> {
  const create = page.getByTestId("np-create");
  const name = page.getByLabel("Project name");
  const nameValue = ((await name.inputValue().catch(() => "")) || "").trim();
  if (!nameValue) {
    throw new Error("UI_INPUT: Create Project is blocked because Project name is empty.");
  }
  await expect(create).toBeEnabled({ timeout: 10_000 });
  await create.click();
  try {
    await page.waitForURL((url) => /\/projects\/(?!new(?:\/|$))[^/]+/.test(url.pathname), {
      timeout: 60_000,
    });
  } catch (error) {
    const text = ((await page.getByTestId("np-create-error").innerText().catch(() => "")) || "").trim();
    if (text) throw new Error(`IDENTITY: Create Project failed: ${text}`);
    throw error;
  }
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
  const call = await recordAndRemember(page, response);
  throwIfUnauthenticatedAiCall(call, "Capture analyse");
  return call;
}

export async function applyReady(page: Page): Promise<HostedApiCall | undefined> {
  const button = page.getByRole("button", { name: /Apply Ready|Apply \d+ changes/i });
  if ((await button.count()) === 0) {
    throw new Error("APPLY: Apply Ready control is missing (silent dead button or nothing marked ready).");
  }
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
  return response ? recordAndRemember(page, response) : undefined;
}

export async function expectNoCaptureError(page: Page): Promise<void> {
  const banner = page.locator(".error-banner.capture-error");
  const count = await banner.count();
  if (count === 0) return;
  const text = ((await banner.first().innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
  throw new Error(`APPLY: Capture error banner: ${text.slice(0, 400)}`);
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
    vercelAccess: "PASS",
    lumeAuth: "PASS",
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
