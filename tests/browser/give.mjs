// Every way to give opens the gift form: page and board buttons, the phone give screen, embeds, the sample page and ?donate links.
import puppeteer from "puppeteer-core";

const exe = process.argv[2]; const shots = process.argv[3];
const base = "http://127.0.0.1:5173";
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ["--no-sandbox"] });
const p = await browser.newPage(); await p.setViewport({ width: 1300, height: 950 });
const errors = [];
p.on("pageerror", (e) => errors.push(`[pageerror] ${String(e).slice(0, 200)}`));
p.on("console", (m) => { if (m.type() === "error") errors.push(`[console] ${m.text().slice(0, 200)}`); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = () => p.evaluate(() => document.body.innerText.replace(/\s+/g, " ")).catch(() => "");
const ready = async () => { for (let i = 0; i < 120; i++) { const t = await text(); if (t.length > 40 && !/Starting the demo|Loading…/.test(t)) return; await sleep(250); } };
const go = async (path) => { await p.goto(base + path, { waitUntil: "domcontentloaded" }); await ready(); await sleep(400); };
const dialog = () => p.evaluate(() => { const d = document.querySelector("[role=dialog]"); return d ? (d.querySelector("button[type=submit]")?.textContent.trim() ?? "open") : null; }).catch(() => null);
const waitDialog = async () => { for (let i = 0; i < 20; i++) { const d = await dialog(); if (d) return d; await sleep(150); } return null; };
const clickText = (re) => p.evaluate((src) => { const el = [...document.querySelectorAll("button, a")].find((e) => e.getClientRects().length && new RegExp(src).test(e.textContent.replace(/\s+/g, " ").trim())); el?.click(); return !!el; }, re.source);
const check = (c, m) => { if (!c) errors.push(`[assert] ${m}`); console.log(`${c ? "ok  " : "FAIL"} ${m}`); };

// Buttons that must open the gift form in place.
const inPlace = [
    ["/demo", /^Claim rank$/], ["/demo/c/clean-water-for-40-villages", /^Donate now$/], ["/demo/c/clean-water-for-40-villages", /^Donate$/],
    ["/demo/f/amara-okafor", /^Donate now$/], ["/demo/t/the-tuesday-swimmers", /^Outbid$/], ["/demo/give", /^Give any amount/], ["/demo/give", /^A borehole for a village/],
    ["/demo/c/clean-water-for-40-villages/give", /^Give any amount/], ["/layouts", /^Donate now$/],
];
for (const [path, re] of inPlace) { await go(path); const found = await clickText(re); const d = found && (await waitDialog()); check(!!d, `${path} "${re.source.replace(/[\^$]/g, "")}" opens the gift form${d ? ` [${d}]` : found ? "" : " (control missing)"}`); }

// Embeds hand off straight to a gift form.
await go("/demo/embed/c/clean-water-for-40-villages"); await clickText(/^Give$/); await ready(); await sleep(600);
let d = await waitDialog(); check(!!d && /clean-water-for-40-villages/.test(p.url()), `page embed Give lands on the page with the gift form open [${d}]`);
check(!/donate/.test(p.url()), "the ?donate flag is removed from the address once the form is open");
await go("/demo/embed"); await clickText(/^Give$/); await ready(); await sleep(400);
check(/\/demo\/give$/.test(p.url()) && /What will you fund/.test(await text()), "board embed Give lands on the phone give screen");

// ?donate&amount= deep link prefills the amount.
await go("/demo/f/amara-okafor?donate&amount=100"); d = await waitDialog();
check(d === "Give $110", `?donate&amount=100 opens the form at $100 plus the default 10% tip [${d}]`);

// The sample page records an in-memory gift and shows it.
await go("/layouts"); await clickText(/^Donate now$/); await waitDialog();
await p.evaluate(() => { const lab = [...document.querySelectorAll("label")].find((l) => /^Your name/.test(l.textContent) && l.htmlFor); const i = document.getElementById(lab.htmlFor); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, "Sample Giver"); i.dispatchEvent(new Event("input", { bubbles: true })); });
await p.evaluate(() => document.querySelector("[role=dialog] button[type=submit]")?.click());
let thanked = false; for (let i = 0; i < 20 && !thanked; i++) { thanked = /Thank you/.test(await p.evaluate(() => document.querySelector("[role=dialog]")?.innerText ?? "")); await sleep(200); }
check(thanked, "sample page gift reaches the thank-you state");
await p.keyboard.press("Escape"); await sleep(500);
check(/Sample Giver/.test(await text()), "sample page lists the gift");
if (shots) await p.screenshot({ path: `${shots}/give-sample.png` });

await browser.close();
const u = [...new Set(errors)];
console.log(u.length ? `\n${u.length} problems:\n${u.join("\n")}` : "\ngive: every entry point opens the gift form, no console errors");
process.exit(u.length ? 1 : 0);
