// /pricing at desktop and phone width: it renders in the right type, stays short, has no sideways scroll or console errors,
// the plans say who pays what, the one calculator answers its slider and tips switch, and the FAQ opens.
import puppeteer from "puppeteer-core";

const exe = process.argv[2]; const shots = process.argv[3] ?? "tests/browser/shots";
const base = "http://127.0.0.1:5173";
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ["--no-sandbox"] });
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (c, m) => { if (!c) errors.push(`[assert] ${m}`); console.log(`${c ? "ok  " : "FAIL"} ${m}`); };

for (const [vw, vh, tag] of [[1440, 1000, "desk"], [390, 844, "phone"]]) {
    const p = await browser.newPage(); await p.setViewport({ width: vw, height: vh, isMobile: vw < 500, hasTouch: vw < 500 });
    p.on("pageerror", (e) => errors.push(`[pageerror ${tag}] ${String(e).slice(0, 200)}`));
    p.on("console", (m) => { if (m.type() === "error") errors.push(`[console ${tag}] ${m.text().slice(0, 200)}`); });
    await p.goto(`${base}/pricing`, { waitUntil: "networkidle2" });
    await p.waitForSelector("#pr-raised", { timeout: 15000 });
    await p.evaluate(() => document.fonts.ready);
    const out = (k) => p.$eval(`[data-out=${k}]`, (e) => e.textContent);
    const tips = () => p.$eval("#calculator [role=switch]", (e) => e.click());
    /** Sets the slider the way a drag would, through the input's own value setter so React sees the change. */
    const raise = (n) => p.$eval("#pr-raised", (e, n) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(e, n); e.dispatchEvent(new Event("input", { bubbles: true })); }, n);
    const overflow = () => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    /** Scrolls through the page so every section reveals, then returns to the top. */
    const reveal = async () => { const h = await p.evaluate(() => document.body.scrollHeight); for (let y = 0; y < h; y += 500) { await p.evaluate((y) => scrollTo(0, y), y); await sleep(120); } await sleep(900); await p.evaluate(() => scrollTo(0, 0)); await sleep(300); };
    const font = (sel) => p.$$eval(sel, (els) => els.map((e) => { const s = getComputedStyle(e); return `${s.fontFamily.split(",")[0].replaceAll('"', "")} ${s.fontWeight} ${s.fontStyle}`; }));

    check(/Free to start\.\s*Fair when you grow\./.test(await p.$eval("h1", (e) => e.textContent)), `${tag}: the hero headline shows`);
    check((await font("h1"))[0].startsWith("Schibsted Grotesk 7"), `${tag}: the h1 is Schibsted Grotesk bold (${await font("h1")})`);
    check(await p.evaluate(() => document.fonts.check('700 40px "Schibsted Grotesk"')), `${tag}: Schibsted Grotesk is loaded`);
    const heads = await font("h2, h3");
    check(heads.length === 13 && heads.every((f) => f.startsWith("Schibsted Grotesk 7")), `${tag}: every h2 and h3 is Schibsted Grotesk bold (${heads.length}: ${[...new Set(heads)].join(" | ")})`);
    check((await p.$$("h2 .rd-accent, h3 .rd-accent")).length === 0, `${tag}: no accent spans outside the h1`);
    check((await font("#plans dd"))[0].startsWith("Schibsted Grotesk"), `${tag}: body text is Schibsted Grotesk (${(await font("#plans dd"))[0]})`);
    check(await overflow() <= 1, `${tag}: no sideways scroll (${await overflow()}px)`);
    check(await p.$eval("title", (e) => /Pricing/.test(e.textContent)), `${tag}: the page title is set`);
    // short: about three screens on desktop
    const tall = await p.evaluate(() => document.documentElement.scrollHeight);
    check(tall <= (vw > 500 ? 3300 : 5200), `${tag}: the page is short (${tall}px)`);
    check((await p.$$("table, #compare")).length === 0, `${tag}: no comparison table`);

    // plans: tips on (recommended), tips off, fundraisers, enterprise; each says who pays what
    const plans = await p.$$eval("#plans article", (a) => a.map((e) => [e.getAttribute("aria-label"), e.textContent.replace(/\s+/g, " ")]));
    check(plans.map(([n]) => n).join() === "Tips on,Tips off,Fundraisers,Enterprise" && plans.filter(([, t]) => /Recommended/.test(t)).length === 1 && /Recommended/.test(plans[0][1]), `${tag}: four plan cards, tips on recommended`);
    check(/0%\s*platform fee/.test(plans[0][1]) && /optional tip, 10% suggested/.test(plans[0][1]) && /2\.9% \+ 30p card processing \(estimate\)/.test(plans[0][1]), `${tag}: tips on is 0% with an optional 10% tip and Stripe's estimate`);
    check(/3%\s*platform fee per gift/.test(plans[1][1]) && /Never see a tip/.test(plans[1][1]) && /2\.9% \+ 30p/.test(plans[1][1]), `${tag}: tips off is 3% with no tip`);
    check(/£0/.test(plans[2][1]) && /Fundraisers never pay/.test(plans[2][1]) && /\[Enterprise price\]/.test(plans[3][1]), `${tag}: fundraisers never pay, and the enterprise placeholder stays bracketed`);
    check(await p.$$eval("#plans article a", (a) => a.length === 4 && a.every((e) => e.offsetHeight >= 44)), `${tag}: one 44px call to action per plan`);
    check(await p.$$eval("#plans article", (a) => a[3].getBoundingClientRect().height < a[0].getBoundingClientRect().height / 2), `${tag}: the enterprise card is the small one`);

    // the calculator: one slider and one switch. Defaults: £25,000 in £25 gifts, tips on at 10%
    check(await p.$$eval("#calculator input, #calculator button", (c) => c.map((e) => e.type === "range" ? "range" : e.getAttribute("role")).join()) === "range,switch", `${tag}: the calculator is one slider and one switch`);
    check(await out("charity") === "£23,970" && await out("stripe") === "−£1,030" && await out("fee") === "£0" && await out("tips") === "£2,500", `${tag}: defaults give £23,970 to the charity, £1,030 to Stripe, no platform fee, £2,500 in tips (${await out("charity")}, ${await out("stripe")}, ${await out("fee")}, ${await out("tips")})`);
    await raise(100000); await sleep(100);
    check(await out("charity") === "£95,880", `${tag}: the slider changes the result (${await out("charity")})`);
    check(await p.$eval("#pr-raised", (e) => e.value === "100000" && e.getAttribute("aria-valuetext") === "£100,000 raised" && e.labels.length === 1), `${tag}: the slider is labelled, with value text`);
    check(await p.$eval("output[for=pr-raised]", (e) => e.textContent) === "£100,000", `${tag}: the value bubble follows`);
    await p.focus("#pr-raised"); await p.keyboard.press("ArrowRight"); await sleep(100);
    check(await p.$eval("#pr-raised", (e) => e.value) === "101000" && await out("charity") !== "£95,880", `${tag}: the arrow keys move it (${await out("charity")})`);
    await raise(100000); await tips(); await sleep(100);
    check(await out("fee") === "−£3,000" && await out("tips") === "£0" && await out("charity") === "£92,880", `${tag}: tips off takes a 3% fee and no tips (${await out("fee")}, ${await out("tips")}, ${await out("charity")})`);
    check(await p.$eval("#calculator [role=switch]", (e) => e.getAttribute("aria-checked") === "false" && e.getBoundingClientRect().height >= 44 && /Off: 3% platform fee/.test(e.textContent)), `${tag}: the switch reports its state`);
    // the big figure is exact at once (no counting animation that could disagree with the breakdown)
    const big = await p.$eval("[data-out=charity]", (e) => e.textContent.trim());
    check(big === "£92,880" && await p.$eval("[data-out=charity]", (e) => e.children.length === 0), `${tag}: the charity figure is shown exactly, as plain text (${big})`);
    // back to the defaults for the screenshots
    await tips(); await raise(25000); await sleep(100);
    check(await out("charity") === "£23,970", `${tag}: and back to the defaults`);

    const faq = () => p.$$eval("#faq button", (b) => b.map((e) => e.getAttribute("aria-expanded")).join());
    check((await faq()) === "true,false,false,false,false", `${tag}: five questions, the first one open`);
    await p.evaluate(() => document.querySelectorAll("#faq button")[4].click()); await sleep(900);
    check((await faq()) === "false,false,false,false,true", `${tag}: an FAQ answer opens and the last one closes`);
    check(await p.$eval("#pr-a4", (e) => e.getBoundingClientRect().height > 40 && /\[Whether tips and platform fees are returned on a refund\]/.test(e.textContent)) && await p.$eval("#pr-a0", (e) => e.getBoundingClientRect().height < 2), `${tag}: its panel has height, and keeps its placeholder`);
    await p.evaluate(() => document.querySelectorAll("#faq button")[0].click()); await sleep(500);

    await reveal();
    check(await p.evaluate(() => [...document.querySelectorAll(".rd-reveal")].every((e) => e.classList.contains("is-in"))), `${tag}: every section reveals on scroll`);
    check(await overflow() <= 1, `${tag}: still no sideways scroll after using the page (${await overflow()}px)`);
    await p.screenshot({ path: `${shots}/pricing-${tag}.png`, fullPage: true });
    await p.screenshot({ path: `${shots}/pricing-${tag}-top.png` });
    for (const id of ["plans", "calculator", "faq"]) { await p.evaluate((id) => document.querySelector(`#${id}`).scrollIntoView(), id); await sleep(500); await p.screenshot({ path: `${shots}/pricing-${tag}-${id}.png` }); }
    await p.close();
}

await browser.close();
if (errors.length) { console.error(`\n${errors.length} problem(s):\n${errors.join("\n")}`); process.exit(1); }
console.log("\npricing: all checks passed");
