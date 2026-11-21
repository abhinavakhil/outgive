// The charity dashboard in the demo: every view in light and dark, on a desktop and a phone, with its charts, filters, gateways and profile.
// node tests/browser/dashboard.mjs "<chrome.exe>" tests/browser/shots
import puppeteer from "puppeteer-core";

const exe = process.argv[2]; const shots = process.argv[3];
const base = "http://127.0.0.1:5173";
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ["--no-sandbox"] });
const p = await browser.newPage(); await p.setViewport({ width: 1440, height: 1000 });
const errors = [];
p.on("pageerror", (e) => errors.push(`[pageerror] ${String(e).slice(0, 300)}`));
p.on("console", (m) => { if (m.type() === "error" || (m.type() === "warning" && /React|key|act\(/.test(m.text()))) errors.push(`[console] ${m.text().slice(0, 300)}`); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (sel = "body") => p.evaluate((s) => document.querySelector(s)?.innerText.replace(/\s+/g, " ") ?? "", sel).catch(() => "");
const ready = async () => { for (let i = 0; i < 160; i++) { const t = await text(); if (t.length > 40 && !/Starting the demo|Loading…/.test(t)) return; await sleep(250); } };
// The overview's figures count up for a couple of seconds; wait so screenshots show the real numbers.
const go = async (path) => { await p.goto(base + path, { waitUntil: "domcontentloaded" }); await ready(); await sleep(/dashboard$/.test(path) ? 3000 : 900); };
const click = (re, scope = "body") => p.evaluate((src, sc) => { const el = [...document.querySelectorAll(`${sc} button, ${sc} a`)].find((e) => e.getClientRects().length && !e.disabled && new RegExp(src).test((e.getAttribute("aria-label") && !e.textContent.trim() ? e.getAttribute("aria-label") : e.textContent).replace(/\s+/g, " ").trim())); el?.scrollIntoView({ block: "center" }); el?.click(); return !!el; }, re.source, scope);
const until = async (re, ms = 5000, sel = "body") => { for (let i = 0; i < ms / 100; i++) { if (re.test(await text(sel))) return true; await sleep(100); } return false; };
const overflow = () => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const shot = async (n) => { if (!shots) return; await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: `${shots}/dashboard-${n}.png`, fullPage: true }); };
const check = (c, m) => { if (!c) errors.push(`[assert] ${m}`); console.log(`${c ? "ok  " : "FAIL"} ${m}`); };
const count = (sel) => p.evaluate((s) => document.querySelectorAll(s).length, sel);
const rows = (scope = "main") => p.evaluate((s) => [...document.querySelectorAll(`${s} [data-row]`)].map((r) => r.innerText.replace(/\s+/g, " ")), scope);
const dark = () => p.evaluate(() => document.documentElement.classList.contains("dark-mode"));
const current = () => p.evaluate(() => document.querySelector("#od-nav [aria-current=page]")?.textContent.trim() ?? "");

/** [path, title, what must be on it] */
const VIEWS = [
    ["", "Overview", /Raised, last 30 days .* Donations raised .* Gifts by method .* Recent activity/],
    ["/donations", "Donations", /Export CSV Donor Amount Type Gift Aid Method Date Status .* Showing \d+ of \d+ donations/],
    ["/subscriptions", "Subscriptions", /Active subscriptions \d+ .* Expected each month \$[\d,]+ .* Failed payments 1 .* Next payment/],
    ["/analytics", "Analytics", /Raised .* Average gift .* One-off and recurring .* Donor journey .* When people give .* Where gifts come from .* Gift Aid added \d+% of gifts/],
    ["/gateways", "Payment gateways", /Stripe .* PayPal .* Ways to pay at checkout .* Direct Debit .* Preview checkout/],
    ["/profile", "Profile", /Logo .* Name .* Short description .* Brand colour .* Registered charity number .* Website .* Save changes/],
    ["/giving", "My giving", /Given all-time .* Regular gifts .* Every gift|Given all-time .* No regular gifts .* No gifts yet/],
    ["/account", "Account", /Name .* Email .* Save changes/],
];
const slug = (path) => path.slice(1) || "overview";

// ---- Desktop, light: every view renders with its content and nothing spills sideways.
// The OS asks for dark throughout: the dashboard keeps its own light theme until its own toggle says otherwise.
await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
await p.evaluateOnNewDocument(() => { window.__bg = []; const see = () => { const r = document.querySelector("#root > *"); if (r) window.__bg.push(getComputedStyle(r).backgroundColor); requestAnimationFrame(see); }; requestAnimationFrame(see); });
for (const [path, title, has] of VIEWS) {
    await go(`/dashboard${path}`);
    const t = await text();
    check((await text("main h1")) === title && has.test(t) && (await current()).startsWith(title), `${title} renders at /dashboard${path} (light), marked current in the nav`);
    check(await overflow() <= 1, `${title}: no sideways scroll at 1440px (${await overflow()}px)`);
    await shot(`${slug(path)}-light-desk`);
}

// ---- Overview: stats, the bar chart's tooltip, the range toggle, the donut.
await go("/dashboard");
const seen = await p.evaluate(() => [...new Set(window.__bg)]);
check(seen.length === 1 && seen[0] === "rgb(242, 240, 236)" && !(await dark()), `from the first frame the page is the design's warm grey, whatever the OS theme [${seen.join(" | ")}]`);
const nav = await p.evaluate(() => { const n = document.querySelector("#od-nav"), cs = getComputedStyle(n), it = document.querySelector("#od-nav [aria-current=page]"), mark = getComputedStyle(it, "::after"), ics = getComputedStyle(it); return { w: Math.round(n.getBoundingClientRect().width), pad: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom}`, bg: cs.backgroundColor, item: `${Math.round(it.getBoundingClientRect().height)} ${ics.borderRadius} ${ics.fontSize} ${ics.fontWeight} ${ics.backgroundColor}`, mark: `${mark.width} ${mark.height} ${mark.backgroundColor} ${mark.borderRadius} ${Math.round(it.getBoundingClientRect().left + parseFloat(mark.left))}`, rings: document.querySelectorAll("#od-nav svg circle").length, word: getComputedStyle(document.querySelector("#od-nav button span")).fontSize }; });
check(nav.w === 296 && nav.pad === "30px 20px 26px" && nav.bg === "rgb(242, 240, 236)" && nav.item === "50 14px 17px 400 rgba(0, 0, 0, 0)" && nav.mark === "5px 26px rgb(125, 185, 40) 0px 6px 6px 0px 0" && nav.rings === 2 && nav.word === "24px", `the nav follows the design: 296px wide on the page colour, 50px items, a lime 5×26 marker at the edge, the two-ring mark [${JSON.stringify(nav)}]`);
// The nav's width steps with the window, and no label wraps or is cut off at either size.
for (const [vw, want] of [[1280, 296], [1100, 264], [1440, 296]]) {
    await p.setViewport({ width: vw, height: 1000 }); await sleep(300);
    const got = await p.evaluate(() => ({ w: Math.round(document.querySelector("#od-nav").getBoundingClientRect().width), cut: [...document.querySelectorAll("#od-nav .od-nav")].filter((b) => b.scrollWidth > b.clientWidth || Math.round(b.getBoundingClientRect().height) !== 50).map((b) => b.textContent.trim()) }));
    check(got.w === want && got.cut.length === 0 && await overflow() <= 1, `at ${vw}px the nav is ${want}px wide with every label whole on one line [${got.w}; ${got.cut.join(", ")}]`);
    if (vw === 1280) await shot("overview-light-1280");
}
check(/Need help\? .* Contact us/.test(await text("#od-nav")) && /My donation page/.test(await text("#od-nav")) && await p.evaluate(() => [...document.querySelectorAll("#od-nav [role=group][aria-label=Theme] button")].every((b) => b.getBoundingClientRect().width === 40 && getComputedStyle(b).borderRadius === "50%")), "the nav ends with My donation page, Need help? with Contact us, and the 40px round theme buttons");
check(await count("[data-stat]") === 4 && /Raised, last 30 days \$[\d,]+/.test(await text()), "the overview has four stat cards and money raised in the last 30 days");
check(/Clearwell Trust/.test(await text("main > header")), "the header names the organisation");
const tip = () => text("[data-chart=bars] [role=tooltip]");
const bar = (i) => p.evaluate((n) => document.querySelectorAll("[data-chart=bars] button")[n].getAttribute("aria-label"), i);
check(await count("[data-chart=bars] button") === 7 && /\$[\d,]+ \w{3} \d+ \w{3}/.test(await tip()), `seven daily bars, the tooltip on the highest [${await tip()}]`);
await p.hover("[data-chart=bars] button:nth-of-type(2)"); await sleep(150);
let label = await bar(1);
check((await tip()).includes(label.split(": ")[1]) && (await tip()).includes(label.split(": ")[0]), `hovering a bar moves the tooltip to it [${label}]`);
await p.mouse.move(5, 5); await p.focus("[data-chart=bars] button:nth-of-type(5)"); await sleep(150);
label = await bar(4);
check((await tip()).includes(label.split(": ")[0]), `focusing a bar with the keyboard shows its tooltip [${label}]`);
if (shots) await p.screenshot({ path: `${shots}/dashboard-overview-tooltip.png` });
check(/^Bar chart of donations raised, last 7 days\. Highest: /.test(await p.evaluate(() => document.querySelector("[data-chart=bars]").closest("[role=img]").getAttribute("aria-label"))), "the bar chart is labelled for screen readers");
await click(/^6m$/); await sleep(500);
check(await count("[data-chart=bars] button") === 6 && /\w+ 20\d\d/.test(await tip()) && await p.evaluate(() => document.querySelector("[aria-label='Last 6 months']").getAttribute("aria-pressed") === "true"), "the range toggle redraws the chart by month");
await click(/^1m$/); await sleep(300);
check(await count("[data-chart=bars] button") === 4, "and by week");
const donut = await p.evaluate(() => document.querySelector("svg[aria-label^='Donut chart']")?.getAttribute("aria-label") ?? "");
check(/^Donut chart: \d+% of gifts by Card/.test(donut) && (donut.match(/% of gifts by/g) ?? []).length >= 3, `the donut shares gifts by method [${donut}]`);

// ---- Recent activity: search, type filter, sort.
/** The activity rows once the list has stopped animating (rows leaving stay in the DOM until their exit ends). */
const act = async () => { let last = "x"; for (let i = 0; i < 30; i++) { const r = await rows("[data-activity]"); if (r.length <= 5 && r.join() === last) return r; last = r.join(); await sleep(150); } return rows("[data-activity]"); };
const first = await act();
check(first.length === 5 && first.every((r) => /Paid|Failed|Refunded/.test(r)), "recent activity lists the five newest gifts");
const amount = (r) => Number((r.match(/\$([\d,]+(?:\.\d+)?)/) ?? [])[1]?.replace(/,/g, "") ?? NaN);
await click(/^Sort by: newest$/); await sleep(700);
const big = (await act()).map(amount);
check(big.length === 5 && big.every((a, i) => i === 0 || big[i - 1] >= a) && /Sort by: largest/.test(await text("main")), `sort puts the largest gifts first [${big.join(", ")}]`);
await click(/^Filter$/); await sleep(700);
check((await act()).every((r) => / One-off /.test(r)) && (await act()).length > 0, "the type filter keeps one-off gifts");
await click(/^One-off$/); await sleep(700);
check((await act()).every((r) => / Monthly /.test(r)) && (await act()).length > 0, "then monthly gifts");
await click(/^Monthly$/); await click(/^Sort by: largest$/); await sleep(500);
await p.type("input[aria-label='Search donors']", "hannah"); await sleep(700);
check((await act()).length > 0 && (await act()).every((r) => /Hannah Reid/.test(r)), "search narrows the list to a donor");
if (shots) { await p.evaluate(() => document.querySelector("[data-activity]").scrollIntoView({ block: "center" })); await sleep(200); await p.screenshot({ path: `${shots}/dashboard-overview-search.png` }); }
await p.type("input[aria-label='Search donors']", "zzz"); await sleep(600);
check((await act()).length === 0 && /No donations match/.test(await text("[data-activity]")), "and says so when nothing matches");
await click(/^See all donations$/); await sleep(600);
check(/\/dashboard\/donations$/.test(p.url()) && (await text("main h1")) === "Donations", "See all donations opens the donations view");
await p.goBack(); await sleep(600);
check(/\/dashboard$/.test(p.url()) && (await text("main h1")) === "Overview", "back returns to the overview");
await p.goForward(); await sleep(600);
check((await text("main h1")) === "Donations", "and forward to donations again");

// ---- Donations: filters and the count.
const all = (await rows()).length;
await click(/^Monthly$/); await sleep(300);
const monthly = await rows();
check(all > 20 && monthly.length > 0 && monthly.length < all && monthly.every((r) => / Monthly /.test(r)), `the Monthly filter narrows ${all} rows to ${monthly.length}`);
check(await p.evaluate(() => [...document.querySelectorAll("main button")].some((b) => b.textContent === "Export CSV" && !b.disabled)), "the list can be exported as CSV");

// ---- Subscriptions: one tab per state, the failed one flagged in the nav.
await click(/^Subscriptions/, "#od-nav"); await sleep(600);
check(/1 failed/.test(await text("#od-nav")), "the nav flags the failed payment");
const subs = {};
for (const f of ["Active", "Paused", "Failed", "Cancelled"]) { await click(new RegExp(`^${f}$`), "main"); await sleep(250); subs[f] = await rows(); }
check(subs.Active.length >= 4 && subs.Active.every((r) => /a month .* Active$/.test(r)) && subs.Paused.length === 1 && /Sophie Turner .* Paused/.test(subs.Paused[0]) && subs.Failed.length === 1 && /Hannah Reid .* Failed$/.test(subs.Failed[0]) && subs.Cancelled.length === 1 && /James Carter .* Ended \d/.test(subs.Cancelled[0]), `subscriptions sort into active (${subs.Active.length}), paused, failed and cancelled`);

// ---- Analytics: period toggle, the trend's tooltip on hover and focus, the heatmap.
await click(/^Analytics$/, "#od-nav"); await sleep(700);
check(await count("[data-chart=trend] button") === 12 && await count("[data-stat]") === 4 && await count("[data-stat] polyline") === 4, "analytics has four KPIs with sparklines and twelve weeks of trend");
check(!(await count("[data-chart=trend] [role=tooltip]")), "the trend shows no tooltip until asked");
await p.hover("[data-chart=trend] button:nth-of-type(3)"); await sleep(150);
check(/7 days from \d+ \w+ One-off \$[\d,]+ Recurring \$[\d,]+/.test(await text("[data-chart=trend] [role=tooltip]")), `hovering the trend shows one-off and recurring [${await text("[data-chart=trend] [role=tooltip]")}]`);
await p.mouse.move(5, 5); await p.focus("[data-chart=trend] button:nth-of-type(11)"); await sleep(150);
check(/Recurring \$[\d,]+/.test(await text("[data-chart=trend] [role=tooltip]")), "and so does keyboard focus");
if (shots) { await p.evaluate(() => document.querySelector("[data-chart=trend]").scrollIntoView({ block: "center" })); await sleep(200); await p.screenshot({ path: `${shots}/dashboard-analytics-tooltip.png` }); }
await click(/^12 months$/); await sleep(400);
check(await count("[data-chart=trend] button") === 12 && /\b(Jan|Feb|Mar)\b/.test(await text("[data-chart=trend]").then(() => text("main"))), "12 months redraws the trend by month");
await click(/^4 weeks$/); await sleep(300);
check(await count("[data-chart=trend] button") === 4, "4 weeks shows four points");
check(/^Heatmap of gifts by day and time of day\. Busiest: \w+ \w+\.$/.test(await p.evaluate(() => document.querySelector("[aria-label^=Heatmap]").getAttribute("aria-label"))) && await count("[aria-label^=Heatmap] [title]") === 28, "the heatmap has 28 cells and names the busiest time");

// ---- Payment gateways: the same settings as the organiser admin.
await click(/^Payment gateways$/, "#od-nav"); await sleep(600);
const gw = (id) => text(`[data-gateway=${id}]`);
if (!/Connected/.test(await gw("stripe"))) { await click(/Connect$/, "[data-gateway=stripe]"); await sleep(200); await click(/^Connect Stripe \(demo\)$/); await until(/Open Stripe/, 5000, "[data-gateway=stripe]"); }
check(/Connected/.test(await gw("stripe")) && /Open Stripe/.test(await gw("stripe")), "Stripe connects (demo) and shows as connected");
check(await p.evaluate(() => document.querySelector("[role=switch][aria-label=Card]").getAttribute("aria-checked") === "true") && /Card Debit and credit cards, through Stripe Live/.test(await text("main")), "card payments are live once Stripe is connected");
await click(/Connect$/, "[data-gateway=paypal]"); await p.waitForSelector("[data-gateway=paypal] input");
await p.type("[data-gateway=paypal] input", "nope"); await sleep(150);
check(/That isn't a merchant ID/.test(await gw("paypal")) && await p.evaluate(() => document.querySelector("[data-gateway=paypal] button[type=submit]").disabled), "a bad PayPal ID is refused");
await p.type("[data-gateway=paypal] input", "@clearwell.test"); await click(/^Connect PayPal$/);
check(await until(/Paying to nope@clearwell\.test .*Connected/, 5000, "[data-gateway=paypal]"), "PayPal connects with an email");
check(await p.evaluate(() => document.querySelector("[role=switch][aria-label=PayPal]").getAttribute("aria-checked") === "true"), "and PayPal is offered at checkout");
await p.evaluate(() => document.querySelector("[role=switch][aria-label='Pay by bank']").click());
for (let i = 0; i < 30 && await p.evaluate(() => document.querySelector("[role=switch][aria-label='Pay by bank']").getAttribute("aria-checked") === "true"); i++) await sleep(100);
check(await p.evaluate(() => document.querySelector("[role=switch][aria-label='Pay by bank']").getAttribute("aria-checked") === "false") && /Donors see 4 ways to pay/.test(await text("main")), "switching a method off takes it out of the checkout");
await shot("gateways-connected-light-desk");
await p.evaluate(() => document.querySelector("[role=switch][aria-label='Pay by bank']").click()); await until(/Donors see 5 ways to pay/, 4000, "main");
await click(/^Disconnect$/, "[data-gateway=paypal]"); await sleep(200);
check(await count("[data-gateway=paypal] [role=alertdialog]") === 1 && /Disconnect PayPal\? Donors will no longer be able to pay by PayPal/.test(await gw("paypal")), "disconnecting asks first");
if (shots) await p.screenshot({ path: `${shots}/dashboard-gateways-confirm.png` });
await click(/^Cancel$/, "[data-gateway=paypal]"); await sleep(200);
check(/Paying to nope@clearwell\.test/.test(await gw("paypal")), "Cancel keeps PayPal connected");
await click(/^Disconnect$/, "[data-gateway=paypal]"); await sleep(200); await click(/^Disconnect$/, "[data-gateway=paypal] [role=alertdialog]");
check(await until(/PayPal balance or a saved card/, 5000, "[data-gateway=paypal]") && /Available .*PayPal/.test(await text("main")), "confirming disconnects it");

// ---- Profile: edit, save, and the organisation's name follows everywhere.
await click(/^Profile$/, "#od-nav"); await sleep(600);
check(await p.evaluate(() => document.querySelector("input[aria-label=Name]").value === "Clearwell Trust" && document.querySelector("main button[type=submit]").disabled), "the profile starts from the organisation's details, with nothing to save");
await p.click("input[aria-label=Name]"); await p.keyboard.type(" UK"); await sleep(150);
check(/Unsaved changes/.test(await text("main")), "an edit is marked unsaved");
await p.click("button[aria-label=Lime]");
await click(/^Save changes$/, "main");
check(await until(/Saved/, 5000, "main [role=status]") && /Clearwell Trust UK/.test(await text("main > header")), "saving updates the organisation, and the header with it");
await shot("profile-saved-light-desk");
await go("/dashboard/profile");
check(await p.evaluate(() => document.querySelector("input[aria-label=Name]").value === "Clearwell Trust UK" && document.querySelector("button[aria-label=Lime]").getAttribute("aria-pressed") === "true"), "the saved profile survives a reload");
await p.click("input[aria-label=Name]"); for (let i = 0; i < 3; i++) await p.keyboard.press("Backspace"); await click(/^Save changes$/, "main"); await until(/Saved/, 5000, "main [role=status]");

// ---- Theme: the toggle switches the whole dashboard and is remembered.
check(!(await dark()) && await p.evaluate(() => getComputedStyle(document.querySelector(".od")).backgroundColor === "rgb(242, 240, 236)"), "light theme: the warm grey page");
await click(/^Dark theme$/, "#od-nav"); await sleep(200);
check(await dark() && await p.evaluate(() => getComputedStyle(document.querySelector(".od")).backgroundColor === "rgb(24, 24, 27)" && document.querySelector("[aria-label='Dark theme']").getAttribute("aria-pressed") === "true"), "the dark theme button switches the dashboard");
for (const [path, title, has] of VIEWS) {
    await go(`/dashboard${path}`);
    check(await dark() && (await text("main h1")) === title && has.test(await text()), `${title} renders in dark, still dark after a reload`);
    check(await overflow() <= 1, `${title}: no sideways scroll at 1440px in dark (${await overflow()}px)`);
    await shot(`${slug(path)}-dark-desk`);
}

// ---- Phone: a top bar and a drawer, cards stacked, tables scrolling inside their card.
await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
for (const mode of ["dark", "light"]) {
    for (const [path, title, has] of VIEWS) {
        await go(`/dashboard${path}`);
        check((await text("main h1")) === title && has.test(await text()), `${title} renders on a phone (${mode})`);
        check(await overflow() <= 1, `${title}: no sideways scroll at 390px in ${mode} (${await overflow()}px)`);
        await shot(`${slug(path)}-${mode}-phone`);
    }
    if (mode === "dark") {
        await go("/dashboard");
        const navBox = () => p.evaluate(() => { const n = document.querySelector("#od-nav"); const r = n.getBoundingClientRect(); return { shown: getComputedStyle(n).visibility === "visible" && r.right > 0, pos: getComputedStyle(n).position }; });
        check((await navBox()).pos === "fixed" && !(await navBox()).shown, "on a phone the nav is a drawer, closed to begin with");
        await p.click("button[aria-label=Menu]"); await sleep(400);
        check((await navBox()).shown && await p.evaluate(() => document.querySelector("button[aria-label=Menu]").getAttribute("aria-expanded") === "true"), "the menu button opens it");
        if (shots) await p.screenshot({ path: `${shots}/dashboard-drawer-dark-phone.png` });
        const small = await p.evaluate(() => [...document.querySelectorAll("#od-nav button, #od-nav a, main button, header button")].filter((b) => b.getClientRects().length && !b.closest("[data-chart]") && !b.hasAttribute("tabindex")).map((b) => { const r = b.getBoundingClientRect(); const after = getComputedStyle(b, "::after"); const grow = (v) => -2 * Math.min(0, parseFloat(v) || 0); /* a negative inset on ::after widens the hit area */ return [b.textContent.trim() || b.getAttribute("aria-label"), Math.round(r.width + grow(after.left)), Math.round(r.height + grow(after.top))]; }).filter(([, w, h]) => w < 44 || h < 44));
        check(small.length === 0, `every button is at least 44px to the touch [${small.map((s) => s.join(" ")).join("; ")}]`);
        await click(/^Analytics$/, "#od-nav"); await sleep(600);
        check(/\/dashboard\/analytics$/.test(p.url()) && !(await navBox()).shown, "choosing a view closes the drawer and opens the view");
        await p.click("button[aria-label=Menu]"); await sleep(300); await click(/^Light theme$/, "#od-nav"); await sleep(200);
        check(!(await dark()) && await p.evaluate(() => localStorage.getItem("outgive.dash.theme") === "light" && localStorage.getItem("theme") === null), "the light theme button switches back and is remembered, without touching the site's own theme");
    }
}
const table = await p.goto(`${base}/dashboard/donations`, { waitUntil: "domcontentloaded" }).then(ready).then(() => sleep(600)).then(() => p.evaluate(() => { const box = document.querySelector("main [role=table]").parentElement; return box.scrollWidth > box.clientWidth && getComputedStyle(box).overflowX === "auto"; }));
check(table, "a wide table scrolls inside its own card on a phone");

// ---- Reduced motion: numbers are simply there.
await p.setViewport({ width: 1440, height: 1000 });
await p.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await go("/dashboard");
check(/Raised, last 30 days \$[\d,]+/.test(await text()) && !/\$0\b/.test(await text("[data-stat]")), "with reduced motion the figures show at once");

await browser.close();
const u = [...new Set(errors)];
console.log(u.length ? `\n${u.length} problems:\n${u.join("\n")}` : "\ndashboard: every view, chart, filter, gateway and theme works on desktop and phone, no console errors");
process.exit(u.length ? 1 : 0);
