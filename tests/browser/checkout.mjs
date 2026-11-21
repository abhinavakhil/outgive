// The /checkout library in all three layouts, desktop and phone: every step, validation, the monthly nudge, a declined card and its retry,
// the payment animation, the thank-you and its next step, the pending screen for Direct Debit, the fast wallet path, a restored draft,
// the trust panel, and the funnel events.
import puppeteer from "puppeteer-core";

const exe = process.argv[2]; const shots = process.argv[3];
const base = "http://127.0.0.1:5173";
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ["--no-sandbox"] });
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (c, m) => { if (!c) errors.push(`[assert] ${m}`); console.log(`${c ? "ok  " : "FAIL"} ${m}`); };
const LAYOUTS = ["hero", "pledge", "ticket"], SIZES = [[1440, 1000, "desk"], [390, 844, "phone"]];
/** The next monthly payment, as the checkout words it: the same day next month, or that month's last day. */
const nextMonth = () => { const d = new Date(), day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + 1); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); };

/** A page on the checkout with the helpers every scenario uses. `fresh` gives it its own storage, so no draft or flag leaks in. */
const open = async (layout, [vw, vh, tag], { fresh = false, query = "" } = {}) => {
    const ctx = fresh ? await browser.createBrowserContext() : null;
    const p = await (ctx ?? browser).newPage(); await p.setViewport({ width: vw, height: vh, isMobile: vw < 500, hasTouch: vw < 500 });
    const name = `${layout}/${tag}`;
    p.on("pageerror", (e) => errors.push(`[pageerror ${name}] ${String(e).slice(0, 200)}`));
    p.on("console", (m) => { if (m.type() === "error") errors.push(`[console ${name}] ${m.text().slice(0, 200)}`); });
    const h = {
        p, name,
        text: () => p.evaluate(() => document.body.innerText.replace(/\s+/g, " ")),
        /** Clicks the first (or, with last, the last) visible, enabled button whose text matches. */
        click: (re, last = false) => p.evaluate((src, last) => { const all = [...document.querySelectorAll("button")].filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== "hidden" && !e.disabled && new RegExp(src).test(e.textContent.replace(/\s+/g, " ").trim())); const el = last ? all.pop() : all[0]; el?.scrollIntoView({ block: "center" }); el?.click(); return !!el; }, re.source, last),
        fill: async (label, v) => { const ok = await p.evaluate((l) => { const lab = [...document.querySelectorAll("label")].find((x) => x.textContent.trim().startsWith(l) && x.querySelector("input")); const i = lab?.querySelector("input"); i?.setAttribute("data-t", "1"); i?.scrollIntoView({ block: "center" }); i?.focus(); return !!lab; }, label); if (!ok) return false; await p.keyboard.type(v); /* focused directly: on a phone a sticky footer can sit over the field's centre */ await p.evaluate(() => document.querySelector("[data-t]")?.removeAttribute("data-t")); return true; },
        typeIn: async (sel, v) => { await p.click(sel, { count: 3 }); await p.keyboard.press("Backspace"); await p.keyboard.type(v); },
        overflow: () => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
        shot: (n) => p.screenshot({ path: `${shots}/checkout-${layout}-${tag}-${n}.png`, fullPage: true }),
        alert: () => p.evaluate(() => document.querySelector("[role=alert]")?.textContent ?? ""),
        events: () => p.evaluate(() => window.__events.map((e) => ({ event: e.event, ...e.data }))),
        count: async (ev) => (await h.events()).filter((e) => e.event === ev).length,
        wait: (re, ms = 9000) => p.waitForFunction((src) => new RegExp(src).test(document.body.innerText.replace(/\s+/g, " ")), { timeout: ms }, re.source).then(() => true).catch(() => false),
        load: async (q = "") => { await p.goto(`${base}/checkout?checkout_layout=${layout}${q}`, { waitUntil: "domcontentloaded" }); await h.wait(/Continue|Thank you|Welcome back/, 15000); await sleep(500); },
        details: async () => { await h.fill("First name", "Sam"); await h.fill("Last name", "Lee"); await h.fill("Email", "sam@example.com"); await h.fill("Postcode", "LS9 7AB"); await h.fill("House number", "1 Marsh Lane"); },
        close: async () => { await p.close(); await ctx?.close(); },
    };
    await h.load(query);
    return h;
};

// ---------------------------------------------------------------- the whole flow, with a card
for (const layout of LAYOUTS) for (const size of SIZES) {
    const h = await open(layout, size), { p, name, text, click, fill, typeIn, overflow, shot } = h;
    check(/Continue with £25/.test(await text()), `${name}: opens on the amount step at £25`);
    check(await overflow() <= 1, `${name}: no sideways scroll on the amount step (${await overflow()}px)`);
    check(!/Verified/.test(await text()) && !/\[Registration number\]|\[Charity legal name\]|\[Fund name\]/.test(await text()), `${name}: an unverified charity shows no "Verified" badge and no trust claims`);
    await shot("1-amount");
    await click(/^£50$/); await sleep(100);
    check(/Continue with £50/.test(await text()), `${name}: a preset changes the amount`);
    // The dial: a click on its right edge lands near a quarter turn.
    const dial = await p.$("[role=slider]"); const b = await dial.boundingBox();
    await p.mouse.click(b.x + b.width - 6, b.y + b.height / 2); await sleep(100);
    const now = await p.$eval("[role=slider]", (e) => Number(e.getAttribute("aria-valuenow")));
    check(now >= 110 && now <= 140, `${name}: the dial picks an amount by angle (${now})`);
    await click(/^£25$/);
    await click(/^Continue with £25$/); await sleep(400);
    await shot("2-boost");
    check(await overflow() <= 1, `${name}: no sideways scroll on the boost step`);
    // The monthly nudge: inline, and a "no" is remembered.
    check(/Give £10 a month instead\?/.test(await text()) && !(await p.$("[role=dialog]")), `${name}: the monthly nudge shows inline on the boost step`);
    await click(/^Keep it one-off$/); await sleep(150);
    check(!/a month instead\?/.test(await text()) && /Continue/.test(await text()), `${name}: declining the nudge removes it and leaves the step as it was`);
    await click(/Add a hot meal/); await sleep(100);
    check(/£28|£35/.test(await text()), `${name}: an extra adds to the total`);
    check(/one-time/.test(await text()), `${name}: an add-on's price says it is one-time`);
    await click(/^Continue$/); await sleep(400);
    await click(/^Back$/); await sleep(400);
    check(!/a month instead\?/.test(await text()), `${name}: the declined nudge is not shown again`);
    await click(/^Continue$/); await sleep(400);
    // Details: an empty form says what's missing.
    await click(/^Continue to payment$/); await sleep(200);
    check(/first name/i.test(await h.alert()), `${name}: details step asks for a first name`);
    check(await p.$eval("input.ck-check", (e) => !e.checked), `${name}: the recovery email opt-in is unticked by default`);
    await h.details();
    await shot("3-details");
    check(await overflow() <= 1, `${name}: no sideways scroll on the details step`);
    await click(/^Continue to payment$/); await sleep(400);
    check(/How would you like to pay|I’ll pay/.test(await text()), `${name}: reaches the payment step`);
    check(await overflow() <= 1, `${name}: no sideways scroll on the payment step`);
    check(!(await p.$("[data-ck-trust]")), `${name}: no trust panel for an unverified charity`);
    await shot("4-pay");
    // No payment without real card details.
    await click(/^Give £28/); await sleep(300);
    check(/card number/i.test(await h.alert()) && !/Sending/.test(await text()), `${name}: an empty card can't pay`);
    await typeIn('input[aria-label="Card number"]', "4242424242424241"); await sleep(100);
    check(await p.$eval('input[aria-label="Card number"]', (e) => e.getAttribute("aria-invalid") === "true"), `${name}: a wrong card number is flagged as you type`);
    await typeIn('input[aria-label="Card number"]', "4000000000000002");
    await typeIn('input[aria-label="Expiry date, month and year"]', "0120");
    await fill("Name on card", "Sam Lee");
    await typeIn('input[aria-label="Security code"]', "123");
    await click(/^Give £28/); await sleep(300);
    check(/expired/i.test(await h.alert()), `${name}: an expired card can't pay`);
    await typeIn('input[aria-label="Expiry date, month and year"]', "1230");
    // A declined card: an error with what to do next, no thank-you, and nothing recorded as paid.
    await click(/^Give £28/);
    check(await h.wait(/Your card was declined/), `${name}: a declined card says so`);
    await sleep(200);
    check(/nothing was taken/.test(await h.alert()) && !/Thank you/.test(await text()) && await h.count("checkout_paid") === 0, `${name}: a declined card takes nothing and shows no thank-you`);
    check((await h.events()).some((e) => e.event === "checkout_pay_failed" && e.reason === "card_declined" && e.method === "card"), `${name}: checkout_pay_failed carries the decline code`);
    check(await overflow() <= 1, `${name}: no sideways scroll with the payment error showing`);
    await shot("4c-declined");
    // Another card, and it goes through.
    await typeIn('input[aria-label="Card number"]', "4242424242424242");
    await shot("4b-card-filled");
    await click(/^Give £28/); await sleep(700);
    check(/Sending £28 to the club/.test(await text()), `${name}: the payment animation plays`);
    await p.screenshot({ path: `${shots}/checkout-${layout}-${size[2]}-5-paying.png` });
    check(await h.wait(/Thank you, Sam/), `${name}: thanks the donor by name`);
    await sleep(400);
    check(await overflow() <= 1, `${name}: no sideways scroll on the thank-you`);
    check(await h.count("checkout_paid") === 1 && await h.count("checkout_pay_start") === 2, `${name}: two tries, exactly one checkout_paid`);
    // One next step, chosen by the rules: a one-off gift of £25 is asked to go monthly.
    check(!!(await p.$('[data-ck-next="monthly"]')) && (await p.$$("[data-ck-next]")).length === 1, `${name}: the thank-you offers one next step (monthly)`);
    await shot("6-thanks");
    const evs = await h.events(), names = evs.map((e) => e.event);
    const funnel = ["checkout_view", "checkout_step_boost", "checkout_step_details", "checkout_step_pay", "checkout_pay_start", "checkout_paid"];
    check(funnel.every((e) => names.includes(e)), `${name}: funnel events sent [${funnel.filter((e) => !names.includes(e)).join(", ") || "all"}]`);
    check(names.includes("checkout_invalid") && names.includes("checkout_extra"), `${name}: validation and extra events sent`);
    check(names.filter((e) => e === "checkout_nudge_shown").length === 1 && names.filter((e) => e === "checkout_nudge_declined").length === 1 && !names.includes("checkout_nudge_accepted"), `${name}: nudge shown once and declined once`);
    check(evs.some((e) => e.event === "checkout_next_shown" && e.kind === "monthly"), `${name}: checkout_next_shown names the kind`);
    check(evs.every((e) => e.preset_variant === "smart") && evs.find((e) => e.event === "checkout_paid").method === "card", `${name}: every event carries preset_variant, and the paid event its method`);
    await click(/^No thanks$/); await sleep(200);
    check(!(await p.$("[data-ck-next]")) && (await h.events()).some((e) => e.event === "checkout_next_declined" && e.kind === "monthly") && /monthly/.test(await p.evaluate(() => sessionStorage.getItem("ck_declined"))), `${name}: "No thanks" closes the next step and is remembered for the session`);
    check(await p.evaluate(() => !localStorage.getItem("outgive.checkout.draft.sample")), `${name}: the draft is cleared once the gift is paid`);
    await h.close();
}

// ---------------------------------------------------------------- a monthly gift by Direct Debit ends on the pending screen
for (const layout of LAYOUTS) for (const size of SIZES) {
    const h = await open(layout, size, { fresh: true }), { p, name, text, click, fill, overflow, shot } = h;
    if (layout === "pledge") await p.evaluate(() => document.querySelector('button[aria-label^="How often"]').click()); else await click(/^Monthly$/);
    await sleep(150);
    check(/Continue with £10/.test(await text()), `${name}: monthly re-picks the amount from the monthly presets (£10)`);
    await click(/^Continue with £10$/); await sleep(400);
    check(!/a month instead\?/.test(await text()), `${name}: no monthly nudge on a gift that is already monthly`);
    await click(/Add a hot meal/); await click(/Cover the card fee/); await sleep(150);
    check(/every month/.test(await text()) && /one-time/.test(await text()), `${name}: the fee cover is priced every month and the meal one-time`);
    await click(/^Continue$/); await sleep(400);
    await h.details();
    await click(/^Continue to payment$/); await sleep(400);
    await click(/^Direct Debit/); await sleep(150);
    await fill("Account holder name", "Sam Lee"); await fill("Sort code", "123456"); await fill("Account number", "12345678");
    await click(/^I authorise/); await sleep(150);
    check(new RegExp(`next on ${nextMonth()}`).test(await text()), `${name}: the authorisation names the next payment date (${nextMonth()})`);
    check(await overflow() <= 1, `${name}: no sideways scroll on the Direct Debit step`);
    await shot("4d-direct-debit");
    await click(/^Give £13\.35/);
    check(await h.wait(/on its way, Sam/), `${name}: Direct Debit ends on the pending screen`);
    await sleep(400);
    const t = await text();
    check(!/Thank you, Sam/.test(t) && !/You paid|Download receipt/.test(t) && /don’t pay again/.test(t), `${name}: the pending screen does not say paid or offer a receipt`);
    check(await h.count("checkout_pending") === 1 && await h.count("checkout_paid") === 0, `${name}: checkout_pending sent, not checkout_paid`);
    // Today and later, line by line.
    check(/Monthly gift Every month £10/.test(t) && /Hot meal Today only £3/.test(t) && /Card fee( covered)? Every month £0\.35/.test(t), `${name}: each line of today's payment is tagged recurring or today only`);
    check(new RegExp(`Then £10\\.35 every month Next payment on ${nextMonth()}`).test(t), `${name}: later payments show the amount and the next date`);
    check(!!(await p.$('[data-ck-next="fundraiser"]')), `${name}: a regular giver is offered their own fundraiser next`);
    check(await overflow() <= 1, `${name}: no sideways scroll on the pending screen`);
    await shot("7-pending");
    await h.close();
}

// ---------------------------------------------------------------- the fast wallet path, and the add-on after it
for (const layout of LAYOUTS) for (const size of SIZES) {
    const h = await open(layout, size, { fresh: true }), { p, name, text, click, fill, overflow, shot } = h;
    await h.typeIn('input[aria-label$="amount in GBP"]', "5"); await sleep(100);
    await click(/^Apple Pay$/); await sleep(400);
    let names = (await h.events()).map((e) => e.event);
    check(names.includes("checkout_express") && names.includes("checkout_step_pay") && !names.includes("checkout_step_boost") && !names.includes("checkout_step_details"), `${name}: the wallet shortcut goes straight to payment, skipping boost and details`);
    check(/Add £1\.25 with Gift Aid\?/.test(await text()) && !(await p.$('label input[autocomplete="postal-code"]')), `${name}: Gift Aid is asked inline, with no address until the donor says yes`);
    await click(/^Yes$/); await sleep(150);
    const payNow = () => layout === "ticket" ? click(/^Give £5/) : click(/^Apple Pay$/, true);
    await payNow(); await sleep(300);
    check(/postcode/i.test(await h.alert()) && await h.count("checkout_pay_start") === 0, `${name}: a Gift Aid yes needs the home address before the wallet pays`);
    await fill("Postcode", "LS9 7AB"); await fill("House number", "1 Marsh Lane");
    check(await overflow() <= 1, `${name}: no sideways scroll on the express payment step`);
    await shot("x-express");
    await payNow();
    check(await h.wait(/Thank you\./), `${name}: the wallet payment reaches the thank-you`);
    await sleep(400);
    const paid = (await h.events()).find((e) => e.event === "checkout_paid");
    check(paid?.method === "wallet" && paid?.giftaid === 1 && /Gift Aid from HMRC \+£1\.25/.test(await text()), `${name}: the express gift carries its Gift Aid`);
    // £5 is too small for a monthly ask, so the related-cause add-on is next. It is a separate payment behind its own confirmation.
    check(/Add £5 for \[Related cause\]\?/.test(await text()) && !!(await p.$('[data-ck-next="addon"]')), `${name}: the add-on is offered as the next step`);
    await click(/^Add £5$/); await sleep(200);
    check(/Confirm a separate gift of £5/.test(await text()) && await h.count("checkout_addon_pay_start") === 0, `${name}: "Add" only opens the confirmation; nothing is charged yet`);
    await shot("8-addon-confirm");
    await click(/^Confirm and pay £5$/);
    check(await h.wait(/£5 more for \[Related cause\]/), `${name}: the add-on is paid after its own confirmation`);
    names = (await h.events()).map((e) => e.event);
    check(names.filter((e) => e === "checkout_paid").length === 1 && names.filter((e) => e === "checkout_addon_paid").length === 1, `${name}: the add-on is its own payment (one checkout_paid, one checkout_addon_paid)`);
    check(await overflow() <= 1, `${name}: no sideways scroll with the add-on paid`);
    await shot("8-addon-paid");
    await h.close();
}

// ---------------------------------------------------------------- an unfinished gift is kept, and a resume link restores it
for (const layout of LAYOUTS) {
    const size = layout === "hero" ? SIZES[0] : SIZES[1];
    const h = await open(layout, size, { fresh: true }), { p, name, text, click, fill, overflow, shot } = h;
    await click(/^£50$/); await click(/^Continue with £50$/); await sleep(400);
    await click(/Add a sports kit/); await click(/^Continue$/); await sleep(400);
    await fill("First name", "Sam"); await fill("Email", "sam@example.com"); await fill("Postcode", "LS9 7AB");
    await p.click("input.ck-check"); await sleep(1100);
    const draft = await p.evaluate(() => JSON.parse(localStorage.getItem("outgive.checkout.draft.sample") ?? "null"));
    check(draft?.amount === 50 && draft.consent === true && draft.step === 2 && draft.extras.includes("kit"), `${name}: the unfinished gift is saved in this browser`);
    check(draft && !/LS9|postcode|card|address/i.test(JSON.stringify(draft)), `${name}: the draft holds no address or payment details`);
    await h.load(`&resume=${draft?.id}`);
    check(/Welcome back, Sam\. We kept your gift of £50/.test(await text()), `${name}: a resume link restores the gift and says so`);
    check(await p.evaluate(() => [...document.querySelectorAll("label")].find((l) => l.textContent.startsWith("First name"))?.querySelector("input").value === "Sam") && await p.$eval("input.ck-check", (e) => e.checked), `${name}: it lands on the details step with the name and opt-in kept`);
    check(/£55|Gift Aid adds £13\.75/.test(await text()), `${name}: the restored gift keeps its extra`); // £50 + the £5 kit, or Gift Aid on both
    check((await h.events()).some((e) => e.event === "checkout_resumed" && e.source === "link"), `${name}: checkout_resumed sent`);
    check(await overflow() <= 1, `${name}: no sideways scroll with the welcome-back note`);
    await shot("9-resumed");
    await click(/^Start again$/); await sleep(300);
    check(/Continue with £25/.test(await text()) && await p.evaluate(() => !localStorage.getItem("outgive.checkout.draft.sample")), `${name}: "Start again" clears the draft`);
    await h.close();
}

// ---------------------------------------------------------------- the trust panel shows only verified, filled-in claims
for (const layout of LAYOUTS) {
    const size = layout === "hero" ? SIZES[0] : SIZES[1];
    const h = await open(layout, size, { fresh: true }), { p, name, text, click, overflow, shot } = h;
    await click(/^Apple Pay$/); await sleep(400);
    // The sample's trust details are placeholders. Swap in test values on the running page (the checkout reads them on each render).
    const setTrust = async (trust) => { await p.evaluate(async (t) => { const url = performance.getEntriesByType("resource").map((e) => e.name).find((n) => /features\/checkout\/model\.ts/.test(n)); (await import(url)).SAMPLE.trust = t; }, trust); await click(/^(Yes|No)$/, true); await sleep(200); };
    const full = { legalName: "Test Charity Ltd", regNo: "TEST-0001", regulator: "Test Regulator", verified: true, verifiedAt: "2026-05-03", taxReceipts: true, fund: { name: "Test fund", restricted: true } };
    await setTrust(full);
    let panel = await p.evaluate(() => document.querySelector("[data-ck-trust]")?.innerText.replace(/\s+/g, " ") ?? "");
    check(/Verified Checked on 3 May 2026/.test(panel) && /Test Charity Ltd/.test(panel) && /No\. TEST-0001, Test Regulator/.test(panel) && /Test fund, and is used only for that/.test(panel) && /tax relief/.test(panel), `${name}: a verified charity shows its name, registration, fund and tax-receipt wording`);
    check(await overflow() <= 1, `${name}: no sideways scroll with the trust panel`);
    await shot("t-trust");
    await setTrust({ ...full, regNo: "[Registration number]", taxReceipts: false, fund: { name: "", restricted: false } });
    panel = await p.evaluate(() => document.querySelector("[data-ck-trust]")?.innerText.replace(/\s+/g, " ") ?? "");
    check(/Test Charity Ltd/.test(panel) && !/Registered|Registration|goes to|tax relief/.test(panel), `${name}: a placeholder registration, an empty fund and no tax receipts are left out`);
    await setTrust({ ...full, verified: false });
    check(!(await p.$("[data-ck-trust]")) && !/Verified/.test(await text()), `${name}: unverified, nothing is claimed at all`);
    await setTrust({ ...full, verifiedAt: undefined });
    check(!(await p.$("[data-ck-trust]")), `${name}: verified with no check date counts as unverified`);
    await h.close();
}

// A monthly gift needs the authorisation switched on.
{
    const p = await browser.newPage(); await p.setViewport({ width: 1300, height: 950 });
    const click = (re) => p.evaluate((src) => { const el = [...document.querySelectorAll("button")].find((e) => e.getClientRects().length && new RegExp(src).test(e.textContent.replace(/\s+/g, " ").trim())); el?.click(); return !!el; }, re.source);
    await p.goto(`${base}/checkout?checkout_layout=hero`, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => /Continue with/.test(document.body.innerText), { timeout: 15000 }); await sleep(300);
    await click(/^Monthly$/); await click(/^Apple Pay$/); await sleep(300); // express jumps to payment
    await p.evaluate(() => [...document.querySelectorAll("button")].filter((b) => b.textContent.trim() === "Apple Pay").pop()?.click()); await sleep(200); // the wallet button on the payment step
    check(/authorisation/.test(await p.evaluate(() => document.querySelector("[role=alert]")?.textContent ?? "")), "monthly: paying without the Direct Debit authorisation is stopped");
    await p.goto(`${base}/checkout`, { waitUntil: "domcontentloaded" }); await sleep(800);
    check(/Gift Aid/.test(await p.evaluate(() => document.querySelector("nav")?.innerText ?? "")), "the flag override is remembered in this browser (hero nav still showing)");
    await p.goto(`${base}/checkout?checkout_layout=`, { waitUntil: "domcontentloaded" }); await p.close();
}

// The dashboard decides what the checkout offers.
{
    const p = await browser.newPage(); await p.setViewport({ width: 1300, height: 950 });
    const text = () => p.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
    const ready = async (re) => { for (let i = 0; i < 120; i++) { if (re.test(await text())) return; await sleep(250); } };
    const toggle = (name) => p.evaluate((n) => { const i = document.querySelector(`input[aria-label="${n}"]`); i?.click(); return !!i; }, name);
    const checkoutPay = async () => {
        await p.goto(`${base}/demo/checkout?checkout_layout=hero`, { waitUntil: "domcontentloaded" }); await ready(/Continue with/); await sleep(300);
        await p.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Apple Pay")?.click()); await sleep(400);
        return text();
    };
    await p.goto(`${base}/demo/admin/payments`, { waitUntil: "domcontentloaded" }); await ready(/Ways to pay at checkout/);
    check(/Ways to pay at checkout/.test(await text()), "dashboard: Payments has the ways-to-pay panel");
    await p.screenshot({ path: `${shots}/checkout-admin-payments.png`, fullPage: true });
    check(/Donors can't pay yet|Donors see/.test(await text()), "dashboard: says how many ways donors can pay");
    if (await p.evaluate(() => !!document.querySelector('input[aria-label="Card"]')?.disabled)) {
        await p.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Connect Stripe/.test(b.textContent))?.click());
        for (let i = 0; i < 40 && await p.evaluate(() => !!document.querySelector('input[aria-label="Card"]')?.disabled); i++) await sleep(250);
    }
    const stripeOn = await p.evaluate(() => !document.querySelector('input[aria-label="Card"]')?.disabled);
    check(stripeOn, "dashboard: Stripe connected unlocks card, wallets, bank and Direct Debit");
    if (stripeOn) {
        await toggle("Card"); await sleep(600);
        const t1 = await checkoutPay();
        check(!(await p.$('input[aria-label="Card number"]')) && /Barclays/.test(t1), "checkout: card switched off in the dashboard disappears");
        await p.goto(`${base}/demo/admin/payments`, { waitUntil: "domcontentloaded" }); await ready(/Ways to pay at checkout/);
        await toggle("Card"); await sleep(600);
    } else console.log("skip: demo org has no Stripe connected");
    await p.click('input[placeholder^="e.g. 7Q2"]').catch(() => {}); await p.keyboard.type("giving@example.org");
    await p.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Connect PayPal")?.click()); await sleep(600);
    check(/PayPal connected/.test(await text()), "dashboard: PayPal connects with a merchant email");
    check(/PayPal/.test(await checkoutPay()), "checkout: PayPal shows once connected");
    await p.goto(`${base}/demo/admin/payments`, { waitUntil: "domcontentloaded" }); await ready(/Ways to pay at checkout/);
    await p.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Disconnect PayPal")?.click()); await sleep(500);
    await p.close();
}

await browser.close();
if (errors.length) { console.log(errors.join("\n")); process.exit(1); }
console.log("checkout: all good");
