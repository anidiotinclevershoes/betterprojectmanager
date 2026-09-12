/**
 * Production isolation smoke. Read-only except Sign in.
 * Does not create or mutate projects.
 */
import { chromium } from "@playwright/test";
import { LONGRUN_PRODUCTION_ORIGIN } from "./types";
import { e2eEmail, e2ePassword, vercelBypassSecret } from "../e2e-hosted-vertical/helpers";
import { proveIsolation } from "./isolation";

async function main() {
  const baseURL = (process.env.LUME_LONGRUN_BASE_URL || LONGRUN_PRODUCTION_ORIGIN).replace(/\/$/, "");
  const email = e2eEmail();
  const password = e2ePassword();
  if (!email || !password) {
    throw new Error("AUTH: LUME_E2E_EMAIL / LUME_E2E_PASSWORD required");
  }
  const bypass = vercelBypassSecret();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    baseURL,
    extraHTTPHeaders: bypass
      ? {
          "x-vercel-protection-bypass": bypass,
          "x-vercel-set-bypass-cookie": "true",
        }
      : {},
  });
  const page = await context.newPage();
  await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 30_000 });
  const url = page.url();
  if (/vercel.com\/(?:login|sso)/i.test(url)) {
    throw new Error("VERCEL_PROTECTION: SSO page");
  }
  await page.getByLabel("Email").waitFor({ state: "visible", timeout: 20_000 }).catch(() => undefined);
  const labels = await page.locator("label, input").evaluateAll((els) =>
    els.map((el) => ({
      tag: el.tagName,
      text: (el.textContent || "").trim().slice(0, 40),
      name: el.getAttribute("name"),
      type: el.getAttribute("type"),
      placeholder: el.getAttribute("placeholder"),
    })),
  );
  console.log("form_fields", labels);
  const loginVisible = (await page.getByLabel("Email").count()) > 0;
  let loginError = "";
  if (loginVisible) {
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    const loginResp = page.waitForResponse(
      (res) => res.url().includes("/api/auth/login") && res.request().method() === "POST",
      { timeout: 30_000 },
    );
    await page.getByRole("button", { name: /^Sign in$/i }).click();
    const loginHttp = await loginResp.catch(() => null);
    console.log(
      "login_http",
      loginHttp
        ? { status: loginHttp.status(), ok: loginHttp.ok() }
        : { status: 0, ok: false, note: "no /api/auth/login POST" },
    );
    await page.waitForURL((u) => !/\/login(?:\?|$)/.test(u.pathname), { timeout: 30_000 }).catch(() => undefined);
    if (/\/login/.test(page.url())) {
      loginError = ((await page.locator("body").innerText()) || "").replace(/\S+@\S+/g, "[email]").slice(0, 400);
    }
  }
  const deadline = Date.now() + 40_000;
  let last = "";
  while (Date.now() < deadline) {
    last = await page.evaluate(async () => {
      const me = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
      const ws = await fetch("/api/workspace/state", { credentials: "include", cache: "no-store" });
      const meJson = (await me.json().catch(() => ({}))) as { user?: { id?: string } };
      return JSON.stringify({
        path: location.pathname,
        me: me.status,
        hasUser: Boolean(meJson.user?.id),
        ws: ws.status,
      });
    });
    const parsed = JSON.parse(last) as { me: number; hasUser: boolean; ws: number };
    if (parsed.me === 200 && parsed.hasUser && parsed.ws === 200) break;
    await page.waitForTimeout(400);
  }
  console.log("session_probe", last, "loginError?", Boolean(loginError));
  if (loginError) console.log("login_page_text", loginError);
  const proof = await proveIsolation(page, email);
  await browser.close();
  const safe = {
    baseURL,
    ok: proof.ok,
    emailDomainOk: proof.emailDomainOk,
    projectCount: proof.projectCount,
    projectNames: proof.projectNames,
    suspiciousNames: proof.suspiciousNames,
    reason: proof.reason,
    userIdPresent: Boolean(proof.userId),
    workspaceIdPresent: Boolean(proof.workspaceId),
  };
  console.log(JSON.stringify(safe, null, 2));
  if (!proof.ok) process.exit(2);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
