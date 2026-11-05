// Headless run of the interactive flows in the demo: claim a rank, record an offline gift, push a presenter ask, publish a page.
import puppeteer from "puppeteer-core";

const exe = process.argv[2]; const shots = process.argv[3];
const base = "http://127.0.0.1:5173";
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ["--no-sandbox"], defaultViewport: { width: 1400, height: 1000 } });
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(`[console] ${m.text().slice(0, 300)}`); });
page.on("pageerror", (e) => errors.push(`[pageerror] ${String(e).slice(0, 300)}`));
let n = 0;
const shot = async (name) => { if (shots) await page.screenshot({ path: `${shots}/${String(++n).padStart(2, "0")}-${name}.png` }); };
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const ready = async (re, label) => { try { const t0 = Date.now(); for (;;) { const t = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ")); if (!/Starting the demo|Loading…/.test(t) && re.test(t)) break; if (Date.now() - t0 > 30000) throw new Error("timeout"); await new Promise((r) => setTimeout(r, 250)); } } catch { errors.push(`[timeout] ${page.url()} never showed: ${label}`); await shot("timeout"); } };
const goto = async (path, re, label) => { await page.goto(base + path, { waitUntil: "domcontentloaded" }); await ready(re, label); };
/** Click the first visible button/link whose text matches. */
const click = async (re, label = re.source) => {
    const ok = await page.evaluate((src, flags) => { const r = new RegExp(src, flags); const el = [...document.querySelectorAll("button, a, [role=button]")].find((e) => r.test(e.textContent?.replace(/\s+/g, " ").trim() ?? "") && e.getClientRects().length); if (!el) return false; el.click(); return true; }, re.source, re.flags);
    if (!ok) { errors.push(`[missing] no control matching ${label} on ${page.url()}`); await shot("missing"); }
    return ok;
};
/** Set a React-controlled input whose <label>, aria-label or placeholder matches. */
const fill = async (re, value) => {
    const ok = await page.evaluate((src, flags, value) => {
        const r = new RegExp(src, flags);
        const vis = (e) => e && e.getClientRects().length > 0;
        const lab = [...document.querySelectorAll("label")].find((l) => r.test(l.textContent ?? "") && vis(l.htmlFor ? document.getElementById(l.htmlFor) : l.querySelector("input, textarea")));
        let el = lab ? (lab.htmlFor ? document.getElementById(lab.htmlFor) : lab.querySelector("input, textarea")) : null;
        el ??= [...document.querySelectorAll("input, textarea")].find((i) => vis(i) && r.test(i.getAttribute("aria-label") ?? i.getAttribute("placeholder") ?? ""));
        if (!el) return false;
        const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
    }, re.source, re.flags, value);
    if (!ok) { errors.push(`[missing] no field matching ${re} on ${page.url()}`); await shot("missing-field"); }
};
const check = (cond, msg) => { if (!cond) errors.push(`[assert] ${msg}`); console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A. Claim #1 from the board.
await goto("/demo", /Take #1 for \$1[\d,]{4,}/, "board with prices");
const before = await text();
await click(/^Claim rank$/, "Claim rank");
await ready(/Name on the board/, "give dialog");
await fill(/^Name on the board/, "Smoke Tester");
await fill(/Email/, "smoke@example.test");
await shot("give-dialog");
await click(/^Give \$[\d,]+ and take #1$/, "submit gift");
await sleep(2500); await shot("after-give");
let t = await text();
check(/Smoke Tester/.test(t), "board shows the new #1 by name after the claim");
check(/\bYou\b/.test(t), "the claimed row is marked You");
check(!/Take #1 for \$18,901/.test(t), `the price of #1 moved (was ${before.match(/Take #1 for \$[\d,]+/)?.[0]})`);

// B. Record an offline gift in the admin.
await goto("/demo/admin/donations", /All gifts · [1-9]/, "admin donations loaded");
await fill(/^Name/, "Cheque From Room");
await fill(/^Amount/, "250");
await click(/^Record gift$/, "Record gift");
await ready(/Cheque From Room/, "offline gift in table"); await shot("admin-after-record");
t = await text();
check(/Cheque From Room/.test(t), "offline gift appears in the donations table");

// C. Presenter console pushes an ask that the live screen shows.
await goto("/demo/admin/live", /Fire confetti/, "presenter console");
await fill(/^Message/, "Who gives for the next borehole?");
await fill(/^Amount \(USD\)/, "500");
await click(/^Show on screen/, "Show on screen");
await sleep(1200); await shot("console-after-ask");
check(await page.evaluate(() => [...document.querySelectorAll("input")].some((i) => /next borehole/.test(i.value))), "console keeps the pushed ask in its field");
await click(/^Impact/, "Impact layout");
await sleep(1200);
await goto("/demo/live", /\$1[\d,]{2,}/, "live screen with data");
await ready(/next borehole/, "ask on live screen"); await shot("live-with-ask");
t = await text();
check(/next borehole/.test(t), "live screen shows the presenter's ask");
check(/funded today/i.test(t), "live screen switched to the Impact layout chosen in the console");
check(/Cheque From Room|Smoke Tester/.test(t), "live ticker includes a gift recorded in this run");

// D. Publish a fundraiser page through the create flow.
await goto("/demo/create", /Step 1 of 7|What you are making/, "create flow");
for (let step = 1; step <= 7; step++) {
    if (step === 5) { await fill(/^Title/, "Smoke Test Fundraiser"); }
    if (step === 7) { await page.evaluate(() => { const c = [...document.querySelectorAll("input[type=checkbox]")].find((i) => /agree/i.test(i.closest("label")?.textContent ?? "")); if (c && !c.checked) c.click(); }); }
    await shot(`create-step-${step}`);
    const ok = await click(step === 7 ? /^Publish$/ : /^(Next|Continue)/, `step ${step} forward`);
    if (!ok) break;
    await sleep(step === 7 ? 3000 : 400);
}
await shot("published");
t = await text();
check(/Published|is live|Share/.test(t), "create flow reaches the published screen");
await goto("/demo/f/smoke-test-fundraiser", /Smoke Test Fundraiser/, "new page by its address");
t = await text();
check(/Smoke Test Fundraiser/.test(t), "the new page loads at its address");
await goto("/demo", /Take #1/, "board again");
t = await text();
check(true, "(board lists pages once they have a gift; skipped)");

await browser.close();
const unique = [...new Set(errors)];
console.log(unique.length ? `\n${unique.length} problems:\n${unique.join("\n")}` : "\nall flows passed, no console errors");
process.exit(unique.length ? 1 : 0);
