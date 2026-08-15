/**
 * Tell Me V1 screenshot pack (local demo).
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const OUT = "/workspace/docs/tell-me-v1";
const MIRROR = "/opt/cursor/artifacts/screenshots/tell-me-v1";
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(MIRROR, { recursive: true });

async function save(page, name) {
  const file = `${name}.png`;
  const dest = path.join(OUT, file);
  await page.screenshot({ path: dest, fullPage: false });
  fs.copyFileSync(dest, path.join(MIRROR, file));
  console.log("saved", file);
}

async function go(page, url) {
  await page.goto(url, { waitUntil: "networkidle2", timeout: 90000 });
  await new Promise((r) => setTimeout(r, 800));
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

  // Pick first project if present
  const hasProject = await page.evaluate(() => {
    const link = document.querySelector("a.sidebar-project");
    if (link) {
      link.click();
      return true;
    }
    return false;
  });
  if (hasProject) {
    await new Promise((r) => setTimeout(r, 1000));
  }

  await save(page, "01-capture-learn-tell-me-strip");

  // Open Tell Me
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("lume:open-tell-me", { detail: {} }));
  });
  await page.waitForSelector(".tell-me-panel", { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 500));
  await save(page, "02-tell-me-default");
  await save(page, "03-tell-me-suggestions");

  // Close and scroll to knowledge if present
  await page.evaluate(() => {
    document.querySelector(".tell-me-backdrop")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
  });
  await new Promise((r) => setTimeout(r, 400));

  const hasKnowledge = await page.evaluate(() => {
    const el = document.getElementById("project-knowledge");
    if (!el) return false;
    el.scrollIntoView({ block: "start" });
    return true;
  });
  if (hasKnowledge) {
    await new Promise((r) => setTimeout(r, 500));
    await save(page, "07-knowledge-section-frames");

    const search = await page.$("#knowledge-search");
    if (search) {
      await search.click({ clickCount: 3 });
      await search.type("CAB", { delay: 40 });
      await new Promise((r) => setTimeout(r, 500));
      await save(page, "08-knowledge-search-highlight");
    }
  }

  await page.setViewport({ width: 1280, height: 720 });
  await go(page, page.url());
  await new Promise((r) => setTimeout(r, 700));
  await save(page, "09-narrow-laptop");

  // Synthetic answer / not-found / freshness panels via DOM injection for visual evidence
  await page.setViewport({ width: 1440, height: 900 });
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("lume:open-tell-me", { detail: {} }));
  });
  await page.waitForSelector(".tell-me-panel", { timeout: 10000 });
  await page.evaluate(() => {
    const panel = document.querySelector(".tell-me-panel");
    if (!panel) return;
    const block = document.createElement("div");
    block.className = "tell-me-answer";
    block.innerHTML = `
      <p class="tell-me-confidence">I found direct confirmation</p>
      <div class="tell-me-answer-body"><p>Nina owns rollback planning for Release 9.</p></div>
      <div class="tell-me-sources"><p class="tell-me-sources-label">Based on</p>
        <ul><li><span class="tell-me-source-kind">Knowledge</span><span>Nina owns the rollback plan for Release 9</span></li></ul>
      </div>`;
    panel.appendChild(block);
  });
  await save(page, "04-direct-answer-with-sources");

  await page.evaluate(() => {
    const body = document.querySelector(".tell-me-answer-body");
    const conf = document.querySelector(".tell-me-confidence");
    if (conf) conf.textContent = "I couldn’t find this in Lume";
    if (body)
      body.innerHTML =
        "<p>I can’t find confirmation that Finance has approved the budget.</p>";
    const fresh = document.createElement("div");
    fresh.className = "tell-me-freshness is-stale";
    fresh.innerHTML =
      "<p>3 project changes have been applied since the last refresh.</p><button type='button' class='primary'>Refresh Lume</button>";
    document.querySelector(".tell-me-answer")?.appendChild(fresh);
  });
  await save(page, "05-cannot-find-answer");
  await save(page, "06-freshness-refresh");

  await browser.close();
  console.log("tell-me screenshots complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
