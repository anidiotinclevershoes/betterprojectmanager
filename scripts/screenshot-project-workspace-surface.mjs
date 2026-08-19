/**
 * Before/after screenshots for project workspace visual ownership.
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const OUT = "/opt/cursor/artifacts/screenshots";
fs.mkdirSync(OUT, { recursive: true });

async function save(page, name) {
  const dest = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: dest, fullPage: false });
  console.log("saved", dest);
}

async function openHorizon(page, width, height) {
  await page.setViewport({ width, height });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle2" });
  // Ensure seeded projects exist (default seed)
  await page.waitForSelector(".sidebar-project", { timeout: 15000 });
  await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll("a.sidebar-project"));
    const horizon = links.find((a) => /HORIZON/i.test(a.textContent || ""));
    horizon?.click();
  });
  await page.waitForSelector(".project-owned-workspace", { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 700));
}

async function main() {
  const label = process.argv[2] || "after";
  const browser = await puppeteer.launch({
    executablePath: "/usr/local/bin/google-chrome",
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1440,960"],
    defaultViewport: { width: 1440, height: 960 },
  });
  const page = await browser.newPage();

  await openHorizon(page, 1440, 960);
  await save(page, `project-workspace-ownership-${label}-desktop`);

  await openHorizon(page, 1100, 900);
  await save(page, `project-workspace-ownership-${label}-laptop`);

  // Overview should not have project framing
  await page.setViewport({ width: 1440, height: 960 });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle2" });
  await page.waitForSelector(".workspace-page", { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 500));
  const hasOwned = await page.$(".project-owned-workspace");
  console.log("overviewHasProjectOwned", Boolean(hasOwned));
  await save(page, `project-workspace-ownership-${label}-overview`);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
