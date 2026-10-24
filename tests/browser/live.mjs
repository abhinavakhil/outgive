// Live screen layouts + the phone give flow: two pages open at once; a gift from the phone must land on the live screen.
import puppeteer from "puppeteer-core";
const exe = process.argv[2]; const shots = process.argv[3];
const base = "http://127.0.0.1:5173";
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ["--no-sandbox"] });
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const wire = (p, tag) => { p.on("console", (m) => { if (m.type() === "error") errors.push(`[${tag} console] ${m.text().slice(0, 300)}`); }); p.on("pageerror", (e) => errors.push(`[${tag} pageerror] ${String(e).slice(0, 300)}`)); };
const ready = async (p, re, label) => { try { const t0 = Date.now(); for (;;) { const t = await p.evaluate(() => document.body.innerText.replace(/\s+/g, " ")); if (!/Starting the demo|Loading…/.test(t) && re.test(t)) return true; if (Date.now() - t0 > 30000) throw new Error("timeout"); await sleep(250); } } catch { errors.push(`[timeout] ${p.url()} never showed: ${label}`); await p.screenshot({ path: `${shots}/timeout-${label.replace(/\W+/g, "_")}.png` }); return false; } };
const text = (p) => p.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const check = (c, m) => { if (!c) errors.push(`[assert] ${m}`); console.log(`${c ? "ok  " : "FAIL"} ${m}`); };
const click = async (p, re) => { const ok = await p.evaluate((src, flags) => { const r = new RegExp(src, flags); const el = [...document.querySelectorAll("button, a")].find((e) => r.test(e.textContent?.replace(/\s+/g, " ").trim() ?? "") && e.getClientRects().length); if (!el) return false; el.click(); return true; }, re.source, re.flags); if (!ok) errors.push(`[missing] ${re} on ${p.url()}`); return ok; };
const fill = async (p, re, value) => { const ok = await p.evaluate((src, flags) => { const r = new RegExp(src, flags); const lab = [...document.querySelectorAll("label")].find((l) => r.test(l.textContent ?? "")); let el = lab ? (lab.htmlFor ? document.getElementById(lab.htmlFor) : lab.querySelector("input, textarea")) : null; el ??= [...document.querySelectorAll("input, textarea")].find((i) => r.test(i.getAttribute("aria-label") ?? i.getAttribute("placeholder") ?? "")); if (!el) return false; el.setAttribute("data-smoke", "1"); return true; }, re.source, re.flags); if (!ok) { errors.push(`[missing field] ${re} on ${p.url()}`); return; } await p.click("[data-smoke]", { clickCount: 3 }); await p.type("[data-smoke]", value); await p.evaluate(() => document.querySelector("[data-smoke]")?.removeAttribute("data-smoke")); };

// 1. Every layout in both themes renders with the total, the QR and no errors.
const live = await browser.newPage(); wire(live, "live"); await live.setViewport({ width: 1600, height: 900 });
for (const layout of ["classic", "thermo", "impact", "podium", "wall"]) for (const theme of ["dark", "light"]) {
    await live.goto(`${base}/demo/live?layout=${layout}&theme=${theme}`, { waitUntil: "domcontentloaded" });
    const ok = await ready(live, /\$1[\d,]{2,}/, `${layout} ${theme} total`);
    await sleep(900); await live.screenshot({ path: `${shots}/live-${layout}-${theme}.png` });
    const hasQr = await live.evaluate(() => !!document.querySelector('img[alt^="QR code"]'));
    check(ok && hasQr, `live ${layout}/${theme} shows a total and the QR code`);
}
await live.goto(`${base}/demo/c/clean-water-for-40-villages/live`, { waitUntil: "domcontentloaded" });
await ready(live, /funded today/i, "campaign live (impact layout from page.live)");
await sleep(900); await live.screenshot({ path: `${shots}/live-campaign.png` });
check(/A borehole for a village/.test(await text(live)), "campaign live screen lists the impact items");

// 2. Phone give flow while the org live screen is open: the gift must land on the live screen without a reload.
await live.goto(`${base}/demo/live`, { waitUntil: "domcontentloaded" }); await ready(live, /\$1[\d,]{2,}/, "org live");
const phone = await browser.newPage(); wire(phone, "phone"); await phone.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await phone.goto(`${base}/demo/give`, { waitUntil: "domcontentloaded" });
await ready(phone, /What will you fund/, "give screen");
await sleep(800); await phone.screenshot({ path: `${shots}/give-phone.png`, fullPage: true });
const items = await text(phone);
check(/A hand-pump repair/.test(items) && /\$600/.test(items), "give screen lists the impact items with prices");
await click(phone, /^A hand-pump repair/);
await ready(phone, /Name|name/, "give dialog");
await sleep(400); await phone.screenshot({ path: `${shots}/give-dialog.png`, fullPage: true });
await fill(phone, /^Your name/, "Phone Giver");
check(/hand-pump repair/i.test(await text(phone)), "give dialog names the chosen item");
await phone.evaluate(() => document.querySelector("[role=dialog] button[type=submit]")?.click());
const thanked = await ready(phone, /Thank you/i, "thank-you after giving"); await phone.screenshot({ path: `${shots}/give-thanks.png`, fullPage: true });
check(thanked, "phone shows the thank-you after giving");
await sleep(1500); await live.screenshot({ path: `${shots}/live-after-phone-gift.png` });
const lt = await text(live);
check(/Phone Giver/.test(lt), "org live screen shows the phone gift without reload");
check(/hand-pump repair/i.test(lt), "live screen names the cause the phone chose");
await live.goto(`${base}/demo/live?layout=impact`, { waitUntil: "domcontentloaded" }); await ready(live, /funded today/i, "impact layout");
await sleep(600); await live.screenshot({ path: `${shots}/live-impact-after.png` });
const counts = await live.evaluate(() => [...document.querySelectorAll("li")].map((l) => l.innerText.replace(/\s+/g, " ")).find((t) => /hand-pump repair/i.test(t)) ?? "");
check(/\b[1-9]\d* funded today/.test(counts), `impact tile counts tonight's pump repair (${counts.slice(0, 80)})`);

// 3. Campaign-level give page records against the page.
await phone.goto(`${base}/demo/c/clean-water-for-40-villages/give`, { waitUntil: "domcontentloaded" });
await ready(phone, /What will you fund/, "campaign give");
check(/Clean water for 40 villages/.test(await text(phone)), "campaign give page names the campaign");

await browser.close();
const u = [...new Set(errors)];
console.log(u.length ? `\n${u.length} problems:\n${u.join("\n")}` : "\nlive + give: all passed, no console errors");
process.exit(u.length ? 1 : 0);
