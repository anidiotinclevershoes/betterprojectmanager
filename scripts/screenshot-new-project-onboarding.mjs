/**
 * Capture onboarding screenshots for the completion report.
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const OUT = "/opt/cursor/artifacts/screenshots";
const MIRROR = "/workspace/artifacts/screenshots";
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(MIRROR, { recursive: true });

const EXAMPLE = `This is the Horizon Customer Portal project.

We're replacing the current portal before the November renewal window.

Sarah owns the business side and Marcus is leading technical delivery.

Security sign-off is due on the 12th.

We're worried the identity provider integration may delay testing.

CAB needs the release pack 48 hours before the meeting, and Sarah normally wants the residual-risk summary in writing before she'll approve anything.

We've already started regression testing, but we still need confirmation from Finance on budget release, and we're waiting on the vendor for the OAuth scope list.`;

const emptyState = {
  projects: [],
  releases: [],
  meetings: [],
  recommendations: [],
  todos: [],
  memories: [],
  knowledge: [],
  timeline: [],
  history: [],
  analysesThisMonth: 0,
  analysesMonthKey: new Date().toISOString().slice(0, 7),
  lastAnalyzedAt: null,
};

async function save(page, name) {
  const file = `${name}.png`;
  const dest = path.join(OUT, file);
  await page.screenshot({ path: dest, fullPage: true });
  fs.copyFileSync(dest, path.join(MIRROR, file));
  console.log("saved", dest);
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: "/usr/local/bin/google-chrome",
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--window-size=1440,960",
    ],
    defaultViewport: { width: 1440, height: 960 },
  });

  const page = await browser.newPage();
  await page.goto("http://localhost:3000/login", {
    waitUntil: "networkidle2",
  });

  // Soft-auth if login form exists
  const email = await page.$('input[type="email"], input[name="email"]');
  if (email) {
    await email.type("demo@lume.app");
    const password = await page.$(
      'input[type="password"], input[name="password"]',
    );
    if (password) await password.type("demo");
    const submit = await page.$('button[type="submit"]');
    if (submit) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => null),
        submit.click(),
      ]);
    }
  }

  await page.evaluate((state) => {
    localStorage.setItem("mission-control-state-v5", JSON.stringify(state));
  }, emptyState);

  await page.goto("http://localhost:3000/", { waitUntil: "networkidle2" });
  await page.waitForSelector(".np-experience", { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 600));
  await save(page, "onboarding-first-run-zero-projects");
  await save(page, "onboarding-three-creation-paths");

  // Talk path
  await page.click(".np-path-card.is-recommended .primary-btn");
  await page.waitForSelector(".np-talk", { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 400));
  await save(page, "onboarding-talk-guidance");

  // Simulate recording UI: grant fake media and click Start Recording
  try {
    await page.click(".np-record-actions .primary-btn");
    await new Promise((r) => setTimeout(r, 800));
    const status = await page.$eval(".np-record-status", (el) => el.textContent);
    if (status && /Recording|Paused/.test(status)) {
      await save(page, "onboarding-transcription-recording");
      await page.evaluate(() => {
        const buttons = Array.from(
          document.querySelectorAll(".np-record-actions button"),
        );
        buttons.find((b) => /Stop/i.test(b.textContent || ""))?.click();
      });
      await new Promise((r) => setTimeout(r, 500));
    }
  } catch (e) {
    console.warn("recording simulate failed", e.message);
  }

  await page.waitForSelector(".np-transcript-field textarea", { timeout: 10000 });

  // Fill transcript for review
  await page.$eval(
    ".np-transcript-field textarea",
    (el, text) => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value",
      ).set;
      setter.call(el, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    },
    EXAMPLE,
  );
  await new Promise((r) => setTimeout(r, 300));
  await save(page, "onboarding-transcription-state");

  await page.click(".np-talk-footer .primary-btn");
  await page.waitForSelector(".np-review", { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 700));
  await save(page, "onboarding-project-setup-review");

  // Scroll knowledge into view
  await page.evaluate(() => {
    const sections = Array.from(document.querySelectorAll(".np-section, section, details"));
    const knowledge = sections.find((s) =>
      /Things Lume will remember|Knowledge/i.test(s.textContent || ""),
    );
    knowledge?.scrollIntoView({ block: "center" });
  });
  await new Promise((r) => setTimeout(r, 400));
  await save(page, "onboarding-things-lume-will-remember");

  // Back to pathways → paste
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    buttons.find((b) => /Back|Pathways|←/i.test(b.textContent || ""))?.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    buttons.find((b) => /Pathways|←/i.test(b.textContent || ""))?.click();
  });
  await page.waitForSelector(".np-path-grid", { timeout: 8000 });
  await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll(".np-path-card"));
    const paste = cards.find((c) => /Paste/i.test(c.textContent || ""));
    paste?.querySelector("button")?.click();
  });
  await page.waitForSelector(".np-paste, textarea", { timeout: 8000 }).catch(() => null);
  await new Promise((r) => setTimeout(r, 400));
  await save(page, "onboarding-paste-path");

  // Blank path
  await page.evaluate(() => {
    document.querySelector(".np-back")?.click();
  });
  await page.waitForSelector(".np-path-grid", { timeout: 8000 });
  await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll(".np-path-card"));
    const blank = cards.find((c) => /Blank/i.test(c.textContent || ""));
    blank?.querySelector("button")?.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  await save(page, "onboarding-start-blank");

  await browser.close();
  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
