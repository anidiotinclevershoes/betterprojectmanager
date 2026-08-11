/**
 * Screenshot pack for Capture workspace refinement completion report.
 */
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const OUT = "/opt/cursor/artifacts/screenshots";
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync("/workspace/artifacts/screenshots", { recursive: true });

async function shot(page, name) {
  const p1 = path.join(OUT, name);
  const p2 = path.join("/workspace/artifacts/screenshots", name);
  await page.screenshot({ path: p1, fullPage: false });
  fs.copyFileSync(p1, p2);
  console.log("wrote", name);
}

async function waitHydrated(page) {
  await page.waitForFunction(() => {
    const loading = Array.from(document.querySelectorAll(".empty-copy")).some(
      (el) => el.textContent?.includes("Loading"),
    );
    return !loading;
  }, { timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(500);
}

async function analyseCapture(page, text) {
  const ta = page.locator("#capture-input");
  await ta.click();
  await ta.fill("");
  await ta.pressSequentially(text, { delay: 2 });
  await page.waitForTimeout(200);
  const btn = page.locator("button.analyse-btn");
  await btn.waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const b = document.querySelector("button.analyse-btn");
    return b && !b.disabled;
  });
  await btn.click();
  // Wait for review UI or error
  await page.waitForSelector(
    ".capture-review, .capture-summary-panel, .capture-reliability, .capture-workspace .error, .status-message",
    { timeout: 45000 },
  ).catch(() => undefined);
  await page.waitForTimeout(1200);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "/usr/local/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("mc-workspace-layout") || k.startsWith("lume-capture")) {
        localStorage.removeItem(k);
      }
    }
  });

  await page.goto("http://localhost:3000/projects/proj-atlas", {
    waitUntil: "networkidle",
  });
  await waitHydrated(page);
  await shot(page, "01-project-owned-workspace.png");

  await page.locator(".capture-workspace-head").scrollIntoViewIfNeeded();
  await shot(page, "02-capture-header.png");

  // Scroll to operational frames
  const todoFrame = page.locator(".frame-type-todo").first();
  if (await todoFrame.count()) {
    await todoFrame.scrollIntoViewIfNeeded();
    await shot(page, "07-todo-frame.png");
  }
  const riskFrame = page.locator(".frame-type-risks").first();
  if (await riskFrame.count()) {
    await riskFrame.scrollIntoViewIfNeeded();
    await shot(page, "06-risks-frame.png");
  }

  await page.locator("#capture-input").scrollIntoViewIfNeeded();
  await analyseCapture(
    page,
    "ATLAS: raise a risk for intermittent payment gateway timeouts.\n\nHORIZON: raise a risk for vendor capacity constraint.\n\nATLAS: remember that CAB Secretariat require the pack 24 hours before the board.\n\nATLAS: chase Sarah for the evidence pack on Friday.",
  );
  await shot(page, "03-multi-project-capture-review.png");

  const remember = page.locator("#capture-remember-panel");
  if (await remember.count()) {
    await remember.scrollIntoViewIfNeeded();
    await shot(page, "04-knowledge-remember-panel.png");
  }

  const newCap = page.getByRole("button", { name: "New Capture" });
  if (await newCap.count()) {
    await newCap.click();
    await page.waitForTimeout(500);
  }
  await analyseCapture(page, "CAB has finally been approved.");
  await shot(page, "05-project-uncertain.png");

  await page.goto("http://localhost:3000/dev/review-preview", {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(400);
  await shot(page, "08-review-preview-header.png");

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
