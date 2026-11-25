// The Ramadan donate flow (/ramadhan/give), phone and desktop. The basket is shared with the charity page both ways; the menu's
// ADD, stepper and quick baskets; the one-page checkout (nights, boosts, night 27, emergency gift, Gift Aid, round-up, tip, bill);
// the details and pay sheets; a declined card and its retry; the payment animation; the thank-you tracker; a reload keeping the
// checkout; no sideways scroll; and the rg_* events.
import puppeteer from "puppeteer-core";

const exe = process.argv[2]; const shots = process.argv[3];
const base = "http://127.0.0.1:5173";
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ["--no-sandbox"] });
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (c, m) => { if (!c) errors.push(`[assert] ${m}`); console.log(`${c ? "ok  " : "FAIL"} ${m}`); };

for (const [vw, vh, tag] of [[390, 844, "phone"], [1280, 900, "desk"]]) {
    const ctx = await browser.createBrowserContext();
    const p = await ctx.newPage(); await p.setViewport({ width: vw, height: vh, isMobile: vw < 500, hasTouch: vw < 500 });
    p.on("pageerror", (e) => errors.push(`[pageerror ${tag}] ${String(e).slice(0, 200)}`));
    p.on("console", (m) => { if (m.type() === "error") errors.push(`[console ${tag}] ${m.text().slice(0, 200)}`); });
    const text = () => p.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
    const click = (sel, re) => p.evaluate((sel, src) => { const el = [...document.querySelectorAll(sel)].find((e) => e.getClientRects().length && (!src || new RegExp(src).test(e.textContent.replace(/\s+/g, " ")))); el?.click(); return !!el; }, sel, re?.source);
    const row = (title, sel) => p.evaluate((title, sel) => { const r = [...document.querySelectorAll(".rg-row")].find((x) => x.querySelector("h3").textContent === title); r?.querySelector(sel)?.click(); return !!r; }, title, sel);
    const fill = async (label, v) => { const h = await p.evaluateHandle((l) => [...document.querySelectorAll("input")].find((i) => i.getClientRects().length && (i.getAttribute("aria-label") || "").startsWith(l)), label); const el = h.asElement(); if (!el) return false; await el.click({ count: 3 }); await p.keyboard.press("Backspace"); await el.type(v); return true; };
    let before = [];
    const events = async () => [...before, ...await p.evaluate(() => (window.__events ?? []).map((e) => e.event))];
    const keep = async () => { before = await events(); };
    const payTotal = () => p.evaluate(() => [...document.querySelectorAll(".rg-place-t b")].find((e) => e.getClientRects().length)?.textContent);

    // On the charity page: give to Water and choose the last ten nights.
    await p.goto(`${base}/ramadhan`, { waitUntil: "networkidle0" });
    await p.evaluate(() => localStorage.removeItem("outgive.rgive.v2"));
    await p.reload({ waitUntil: "networkidle0" });
    await p.waitForSelector(".bp-tabs", { timeout: 60000 });
    await click(".bp-tabs button", /Causes/); await sleep(150);
    await p.evaluate(() => [...document.querySelectorAll(".bp-cause")].find((c) => c.querySelector("h3").textContent === "Water").querySelector(".bp-pick").click());
    await click(".bp-seg button", /Last 10 nights/); await sleep(150);
    check(/1 in your basket/.test(await text()), `${tag}: page basket shows 1 item`);
    await keep();
    await click(".bp-dock .bp-give");
    // The link opens on step 1, "Add to the pile", with the page's basket.
    await p.waitForSelector(".gb-stage", { timeout: 60000 });
    check(/for Water/.test(await p.$eval(".gb-titles", (e) => e.textContent)), `${tag}: step 1 opens first, for the cause picked on the page`);
    // The causes link opens the menu.
    await click(".gb-titles .gb-tx"); await p.waitForSelector(".rg-menu");
    const waterN = await p.evaluate(() => [...document.querySelectorAll(".rg-row")].find((r) => r.querySelector("h3").textContent === "Water")?.querySelector(".rg-step b")?.textContent);
    check(waterN === "1", `${tag}: Water picked on the page is in the flow's basket`);
    if (tag === "desk") check(await p.$eval(".rg-side", (e) => e.getClientRects().length > 0 && /Water/.test(e.textContent)), "desk: basket sits beside the menu");
    else check(/1 item added/i.test(await text()) && /£5 a night/.test(await text()), "phone: basket bar shows 1 item at £5 a night");

    // ADD, stepper, a one-off duty and a quick basket.
    check(await row("Food and iftar", ".rg-add"), `${tag}: ADD on Food and iftar`); await sleep(80);
    await row("Food and iftar", ".rg-step button:last-child"); await sleep(80);
    await row("Food and iftar", ".rg-step button:first-child"); await sleep(80);
    await row("Food and iftar", ".rg-step button:last-child"); await sleep(80);
    await row("Zakat al-Fitr", ".rg-add"); await sleep(80);
    await p.evaluate(() => [...document.querySelectorAll(".rg-bundles li")].find((l) => /Nightly Zakat/.test(l.textContent)).querySelector("button").click()); await sleep(80);
    const foodN = await p.evaluate(() => [...document.querySelectorAll(".rg-row")].find((r) => r.querySelector("h3").textContent === "Food and iftar").querySelector(".rg-step b").textContent);
    check(foodN === "2", `${tag}: stepper counts 2 meals`);
    await p.screenshot({ path: `${shots}/rg-1-menu-${tag}.png` });

    // Back on the page, the flow's basket shows: Food and iftar is added there too.
    await keep();
    await p.goto(`${base}/ramadhan`, { waitUntil: "networkidle0" }); await p.waitForSelector(".bp-tabs");
    await click(".bp-tabs button", /Causes/); await sleep(150);
    const foodOn = await p.evaluate(() => [...document.querySelectorAll(".bp-cause")].find((c) => c.querySelector("h3").textContent === "Food and iftar").querySelector(".bp-pick").getAttribute("aria-pressed"));
    check(foodOn === "true", `${tag}: items added in the flow show as added on the page`);
    await keep();
    await p.goto(`${base}/ramadhan/give`, { waitUntil: "networkidle0" });

    // Step 1, "Add to the pile": bundles set the nightly amount, the pile shows your coins, nights carry over from the page.
    await p.waitForSelector(".gb-stage");
    check(await p.$eval(".gb-freqs button.on", (b) => b.textContent) === "Last 10", `${tag}: nights chosen on the page carry into step 1`);
    const amount = () => p.$eval(".gb-amount input", (e) => e.value);
    check(await amount() === "23", `${tag}: the amount starts as the basket (£23 a night)`);
    check(await p.$$eval(".gb-you", (x) => x.filter((e) => e.offsetHeight > 0).length) > 0 && /You · £23\/night/.test(await text()), `${tag}: the pile shows your coins`);
    await click(".gb-bundle", /£20/); await sleep(120);
    check(await amount() === "20" && /Champion/.test(await p.$eval(".gb-becomes", (e) => e.textContent)), `${tag}: a bundle sets £20 a night, Level 3 · Champion`);
    await click(".gb-nudge button"); await sleep(120);
    check(await amount() === "50", `${tag}: Level up moves to the next bundle (£50)`);
    await p.evaluate(() => document.querySelector(".gb-amount .down").click()); await sleep(80);
    check(await amount() === "20", `${tag}: − steps back a level (£20)`);
    await p.select(".gb-giveas select", "Sadaqah Jariyah"); await sleep(80);
    check(/Give this Sadaqah Jariyah on behalf/.test(await text()), `${tag}: Give as Sadaqah Jariyah`);
    await p.screenshot({ path: `${shots}/rg-2-pile-${tag}.png`, fullPage: true });

    // A reload keeps the screen and every choice.
    await keep();
    await p.reload({ waitUntil: "networkidle0" }); await p.waitForSelector(".gb-stage", { timeout: 30000 });
    check(await amount() === "20", `${tag}: reload keeps step 1 and the amount`);

    // Step 2, "Complete your gift": power-ups, tip slider, missing details, a declined card, then a good one.
    if (tag === "desk") await click(".gb-form .gb-btn.primary"); else await click(".gb-mbar .gb-btn"); await p.waitForSelector(".gb-pay");
    await p.evaluate(() => document.querySelector("[aria-label='Add Gift Aid']").click()); await sleep(80);
    await p.evaluate(() => document.querySelector("[aria-label='Double the last 10 nights']").click()); await sleep(80);
    await p.evaluate(() => document.querySelector("[aria-label='Tip 10%']").click()); await sleep(120);
    const side = await p.evaluate(() => [...document.querySelectorAll(".gb-lines")].find((e) => e.getClientRects().length).innerText.replace(/\s+/g, " "));
    console.log("     side:", side.slice(0, 320));
    // £20 a night on nights 21 to 30, doubled = £400, plus £5 Zakat al-Fitr today = £405; the tip is 10% of £20 on each payment.
    check(/last 10 doubled \+ £5 today/.test(side) && /£405\.00/.test(side) && /Gift Aid from HMRC \+£101\.25/.test(side) && /10% \(£2\.00\)/.test(side), `${tag}: gift £405 (doubled + Zakat al-Fitr), Gift Aid +£101.25, tip 10%`);
    check(/to the appeal/.test(side), `${tag}: Gift power shows what reaches the appeal`);
    const donate = () => p.evaluate(() => [...document.querySelectorAll(".gb-pay .gb-btn.primary")].find((e) => e.getClientRects().length).click());
    await donate(); await sleep(300);
    check(await p.$$eval(".gb-field.bad", (x) => x.length) === 5, `${tag}: missing email, names and Gift Aid address flagged`);
    await fill("Email", "aisha@example.com"); await fill("First name", "Aisha"); await fill("Last name", "Khan"); await fill("House", "12"); await fill("Home postcode", "e1 6an");
    await click(".gb-method button", /Card/); await sleep(100);
    await fill("Card number", "4000 0000 0000 0002"); await fill("Expiry", "1230"); await fill("Security", "123");
    await donate(); await sleep(900);
    check(await p.$(".rg-paying .ck-fly") !== null, `${tag}: payment animation runs`);
    check(await p.$eval(".rg-paying", (e) => { const r = e.getBoundingClientRect(); return r.top <= 0 && r.height >= innerHeight - 1; }), `${tag}: payment animation covers the screen`);
    await sleep(2600);
    check(/declined\. Nothing was taken/.test(await text()), `${tag}: declined card says so and takes nothing`);
    await fill("Card number", "4242 4242 4242 4242");
    await donate(); await sleep(3300);
    check(/Gift confirmed/.test(await text()), `${tag}: success tick`);
    await p.waitForSelector(".gb-medal", { timeout: 8000 }); await sleep(600);
    const done = await text();
    check(/Level 3 unlocked!/.test(done) && /Jazakallah khair, Aisha/.test(done) && /Badges/.test(done) && /10 nights on the pile/.test(done) && /Your receipt/.test(done), `${tag}: level-up thank-you with badges and nights`);
    check(await p.evaluate(() => localStorage.getItem("outgive.rgive.v2")) === null, `${tag}: basket and details are cleared after paying`);
    check(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, `${tag}: nothing scrolls sideways`);
    await p.screenshot({ path: `${shots}/rg-3-done-${tag}.png`, fullPage: true });

    const ev = await events();
    for (const e of ["rg_open", "rg_item_add", "rg_item_remove", "rg_bundle", "rg_step", "rg_bundle_pick", "rg_levelup", "rg_give_as", "rg_boost", "rg_addon", "rg_pay_invalid", "rg_method", "rg_pay_start", "rg_pay_fail", "rg_paid", "rg_thanks"]) check(ev.includes(e), `${tag}: event ${e}`);
    check(ev.filter((e) => e === "rg_item_add").length === 4, `${tag}: each add sends one event`);
    await ctx.close();
}

await browser.close();
if (errors.length) { console.log(errors.join("\n")); process.exit(1); }
console.log("ramadan give: all good");
