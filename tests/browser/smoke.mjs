// Headless walk through the demo: every screen must render without console errors and with real seeded data.
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const exe = process.argv[2];
const base = "http://127.0.0.1:5173";
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ["--no-sandbox", "--window-size=1400,900"], defaultViewport: { width: 1400, height: 900 } });
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(`[console] ${m.text().slice(0, 300)}`); });
page.on("pageerror", (e) => errors.push(`[pageerror] ${String(e).slice(0, 300)}`));
page.on("requestfailed", (r) => { if (!r.url().includes("fonts.g")) errors.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`); });

const shots = process.argv[3];
const visit = async (path, waitFor, label) => {
    const t = Date.now();
    await page.goto(base + path, { waitUntil: "domcontentloaded" });
    try { await page.waitForFunction(waitFor, { timeout: 60000 }); } catch { errors.push(`[timeout] ${path} did not show: ${label}`); }
    const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 400));
    if (shots) await page.screenshot({ path: `${shots}/${path.replace(/[^a-z0-9]+/gi, "_") || "root"}.png` });
    console.log(`${String(Date.now() - t).padStart(6)}ms  ${path}\n        ${text.slice(0, 220)}`);
};

const ready = (re) => new Function("return " + `!/Starting the demo|Loading…/.test(document.body.innerText) && ${re}.test(document.body.innerText)`);
await visit("/demo/live", ready(/\$[1-9][\d,]{3,}/), "live total");
await visit("/demo/c/clean-water-for-40-villages/live", ready(/\$[1-9][\d,]{3,}/), "page live total");
await visit("/demo/overlay?theme=ticker", ready(/\$[1-9][\d,]{2,}/), "overlay total");
await visit("/demo/embed", ready(/\$[1-9]/), "embed rows");
await browser.close();
const unique = [...new Set(errors)];
console.log(unique.length ? `\n${unique.length} problems:\n${unique.join("\n")}` : "\nno console errors, no failed requests");
process.exit(unique.length ? 1 : 0);
