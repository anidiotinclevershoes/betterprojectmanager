/**
 * Intelligence header UX screenshot pack (phone-review friendly).
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const OUT = "/workspace/docs/intelligence-header-ux";
const MIRROR = "/opt/cursor/artifacts/screenshots/intelligence-header-ux";
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(MIRROR, { recursive: true });

async function save(page, name, opts = {}) {
  const file = `${name}.png`;
  const dest = path.join(OUT, file);
  await page.screenshot({
    path: dest,
    fullPage: Boolean(opts.fullPage),
    clip: opts.clip,
  });
  fs.copyFileSync(dest, path.join(MIRROR, file));
  console.log("saved", file);
}

async function saveCrop(page, name, selector) {
  const el = await page.$(selector);
  if (!el) {
    await save(page, name);
    return;
  }
  const box = await el.boundingBox();
  if (!box) {
    await save(page, name);
    return;
  }
  await save(page, name, {
    clip: {
      x: Math.max(0, box.x - 8),
      y: Math.max(0, box.y - 8),
      width: Math.min(box.width + 16, 1400),
      height: Math.min(box.height + 16, 900),
    },
  });
}

async function go(page, url) {
  await page.goto(url, { waitUntil: "networkidle2", timeout: 90000 });
  await new Promise((r) => setTimeout(r, 700));
}

async function selectFirstProject(page) {
  await page.evaluate(() => {
    document.querySelector("a.sidebar-project")?.click();
  });
  await new Promise((r) => setTimeout(r, 900));
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: "/usr/local/bin/google-chrome",
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1440,900"],
    defaultViewport: { width: 1440, height: 900 },
  });
  const page = await browser.newPage();

  await go(page, "http://localhost:3000/");
  await selectFirstProject(page);

  // 01 default capture
  await page.evaluate(() => {
    window.dispatchEvent(new Event("lume:open-coach")); // open then close to ensure capture
  });
  await new Promise((r) => setTimeout(r, 200));
  await page.evaluate(() => {
    document.querySelector(".intelligence-mode.is-capture")?.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  await save(page, "01-default-capture");
  await saveCrop(page, "02-capture-header-close", ".intelligence-loop");

  // Tell Me active
  await page.evaluate(() => {
    document.querySelector(".intelligence-mode.is-tell-me")?.click();
  });
  await page.waitForSelector(".tell-me-workspace", { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 500));
  await save(page, "03-tell-me-active-full");
  await saveCrop(page, "04-tell-me-header-close", ".intelligence-stage");

  // Inject answer + sources for visual evidence
  await page.evaluate(() => {
    const ws = document.querySelector(".tell-me-workspace");
    if (!ws) return;
    const existing = ws.querySelector(".tell-me-answer");
    existing?.remove();
    const block = document.createElement("div");
    block.className = "tell-me-answer";
    block.innerHTML = `
      <p class="tell-me-confidence">I found direct confirmation</p>
      <div class="tell-me-answer-body"><p>Nina owns rollback planning for Release 9.</p></div>
      <div class="tell-me-sources"><p class="tell-me-sources-label">Based on</p>
      <ul><li><span class="tell-me-source-kind">Knowledge</span><span>Nina owns the rollback plan for Release 9</span></li></ul></div>`;
    ws.appendChild(block);
  });
  await save(page, "05-tell-me-answer");

  await page.evaluate(() => {
    const conf = document.querySelector(".tell-me-confidence");
    const body = document.querySelector(".tell-me-answer-body");
    const sources = document.querySelector(".tell-me-sources");
    if (conf) conf.textContent = "I couldn’t find this in Lume";
    if (body)
      body.innerHTML =
        "<p>I can’t find confirmation that Finance has approved the budget.</p>";
    if (sources) {
      sources.outerHTML =
        '<p class="tell-me-no-sources">No supporting project evidence found</p>';
    }
  });
  await save(page, "06-no-evidence");

  // Coach
  await page.evaluate(() => {
    document.querySelector(".intelligence-mode.is-coach")?.click();
  });
  await new Promise((r) => setTimeout(r, 600));
  await save(page, "07-coach-active-full");
  await saveCrop(page, "08-coach-separation-close", ".intelligence-loop");

  // Learn / memory link
  await page.evaluate(() => {
    document.querySelector(".intelligence-mode.is-capture")?.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  await saveCrop(page, "09-learn-memory-link", ".intelligence-mode.is-capture");

  await page.evaluate(() => {
    document.querySelector(".intelligence-learn-link")?.click();
  });
  await new Promise((r) => setTimeout(r, 900));
  await save(page, "10-knowledge-scroll-result");

  // Narrow
  await page.setViewport({ width: 1280, height: 720 });
  await page.evaluate(() => {
    document.querySelector(".intelligence-mode.is-capture")?.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  await save(page, "11-narrow-capture");
  await page.evaluate(() => {
    document.querySelector(".intelligence-mode.is-tell-me")?.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  await save(page, "12-narrow-tell-me");
  await page.evaluate(() => {
    document.querySelector(".intelligence-mode.is-coach")?.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  await save(page, "13-narrow-coach");

  // Mobile
  await page.setViewport({ width: 390, height: 844 });
  await page.evaluate(() => {
    document.querySelector(".intelligence-mode.is-capture")?.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  await save(page, "14-mobile-header");
  await page.evaluate(() => {
    document.querySelector(".intelligence-mode.is-tell-me")?.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  await save(page, "15-mobile-tell-me");

  // Comparison note image: capture strip at mobile+desktop isn't side-by-side easily;
  // save desktop strip again as before/after reference placeholder.
  await page.setViewport({ width: 1440, height: 900 });
  await go(page, page.url());
  await selectFirstProject(page);
  await saveCrop(page, "16-before-after-header", ".intelligence-loop");

  await browser.close();
  console.log("intelligence-header screenshots complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
