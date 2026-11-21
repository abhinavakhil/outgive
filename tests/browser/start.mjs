// /start (a charity creates its organisation) in the demo, at desktop and phone width: the three-step form shows without sign-in, an empty name and
// a bad address are flagged and linked to their fields, the live preview follows the form, and the last step creates the organisation and lands on admin → payments.
import puppeteer from "puppeteer-core";

const exe = process.argv[2]; const shots = process.argv[3] ?? "tests/browser/shots";
const base = "http://127.0.0.1:5173";
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ["--no-sandbox"] });
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (c, m) => { if (!c) errors.push(`[assert] ${m}`); console.log(`${c ? "ok  " : "FAIL"} ${m}`); };

for (const [vw, vh, tag] of [[1440, 900, "desk"], [390, 844, "phone"]]) {
    const p = await browser.newPage(); await p.setViewport({ width: vw, height: vh, isMobile: vw < 500, hasTouch: vw < 500 });
    p.on("pageerror", (e) => errors.push(`[pageerror ${tag}] ${String(e).slice(0, 200)}`));
    p.on("console", (m) => { if (m.type() === "error") errors.push(`[console ${tag}] ${m.text().slice(0, 200)}`); });
    await p.goto(`${base}/start?goal=Clean%20water%20for%2040%20villages`, { waitUntil: "networkidle2" });
    await p.waitForSelector("#st-name", { timeout: 90000 });
    await p.evaluate(() => document.fonts.ready);
    const overflow = () => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const pv = (k) => p.$eval(`[data-pv=${k}]`, (e) => e.textContent);
    const type = async (sel, v) => { await p.$eval(sel, (e) => { e.scrollIntoView({ block: "center" }); e.focus(); e.select?.(); }); await p.keyboard.press("Backspace"); await p.keyboard.type(v); await sleep(120); };
    const described = (sel) => p.$eval(sel, (e) => { const d = document.getElementById(e.getAttribute("aria-describedby") ?? ""); return e.getAttribute("aria-invalid") === "true" && d ? d.textContent : ""; });
    const go = async () => { await p.$eval("button[type=submit]", (e) => e.click()); await sleep(650); };
    const h2 = () => p.$eval("main h2", (e) => e.textContent);
    const now = () => p.$eval(".st-steps [aria-current=step]", (e) => e.textContent.trim());
    const tall = (sel) => p.$$eval(sel, (els) => els.length > 0 && els.every((e) => e.getBoundingClientRect().height >= 44));
    // a tall viewport instead of fullPage, which restarts the entrance animations mid-capture
    const shot = async (n, full) => { await p.evaluate(() => scrollTo(0, 0)); if (full) await p.setViewport({ width: vw, height: Math.max(vh, await p.evaluate(() => document.documentElement.scrollHeight)), isMobile: vw < 500, hasTouch: vw < 500 }); await sleep(700); await p.screenshot({ path: `${shots}/start-${tag}-${n}.png` }); if (full) await p.setViewport({ width: vw, height: vh, isMobile: vw < 500, hasTouch: vw < 500 }); };
    const slug = `harbour-${tag}-${Date.now().toString(36)}`;

    // step 1: the organisation
    check(/What is your organisation called/.test(await h2()) && !(await p.$("input[type=email]")) && /^1\s*Organisation/.test(await now()), `${tag}: step one shows in the demo without sign-in`);
    check(await p.evaluate(() => { const f = (s) => getComputedStyle(document.querySelector(s)).fontFamily.split(",")[0].replaceAll('"', ""); return f(".st h1") === "Schibsted Grotesk" && f(".st-steps button") === "JetBrains Mono" && document.fonts.check('800 40px "Schibsted Grotesk"'); }), `${tag}: Schibsted Grotesk headings and JetBrains Mono labels are loaded`);
    check(await p.$$eval("main input, main textarea, main select", (e) => e.length) <= 8, `${tag}: only step one's few fields are on screen`);
    check(await overflow() <= 1, `${tag}: no sideways scroll (${await overflow()}px)`);
    await shot("1-empty", true);

    await go();
    check(/Give your organisation a name/.test(await described("#st-name")) && await p.evaluate(() => document.activeElement.id === "st-name") && /called/.test(await h2()), `${tag}: an empty name is flagged on its field, focused, and the step does not advance`);
    await type("#st-name", "Harbour Trust");
    check(await described("#st-name") === "" && !(await p.$("#st-name-err")), `${tag}: the name error clears once there is a name`);
    check(await pv("name") === "Harbour Trust" && await pv("url") === "outgive.tech/o/harbour-trust" && await p.$eval(".st-tile", (e) => e.textContent) === "HT", `${tag}: the preview shows the name, its initials and the address made from it`);
    check(await p.$eval("#st-slug", (e) => e.placeholder) === "harbour-trust" && !!(await p.$(".st-url > i")), `${tag}: the address box suggests outgive.tech/o/harbour-trust and ticks it`);
    await type("#st-slug", "-Bad Slug-");
    check(await p.$eval("#st-slug", (e) => e.value) === "-bad-slug-" && /letters, numbers and dashes/.test(await described("#st-slug")) && !(await p.$(".st-url > i")), `${tag}: a bad address is flagged live, linked to its field (${await p.$eval("#st-slug", (e) => e.value)})`);
    check(await pv("url") === "outgive.tech/o/your-charity", `${tag}: a bad address never reaches the preview`);
    await go();
    check(/called/.test(await h2()) && await p.evaluate(() => document.activeElement.id === "st-slug"), `${tag}: a bad address blocks the step and takes the focus`);
    await shot("1-errors");
    await type("#st-slug", slug);
    check(await described("#st-slug") === "" && await pv("url") === `outgive.tech/o/${slug}`, `${tag}: a good address clears the error and reaches the preview`);
    await p.$eval("input[name=st-currency][value=GBP]", (e) => e.click()); await sleep(150);
    check(await p.$eval(".st-hero b", (e) => e.textContent.startsWith("£")), `${tag}: the currency reaches the preview`);
    check(await tall(".st-chip, #st-name, .st-url, .st-cta, .st-steps button"), `${tag}: step one's controls are at least 44px tall`);
    await shot("1-filled", true);

    // step 2: the page. Enter moves on, like the button
    await p.focus("#st-name"); await p.keyboard.press("Enter"); await sleep(650);
    check(/Make the page yours/.test(await h2()) && /^2\s*Your page/.test(await now()) && await p.evaluate(() => document.activeElement.tagName === "H2"), `${tag}: Enter moves to step two, and its heading takes the focus`);
    check(await p.$eval("#st-tagline", (e) => e.value) === "Clean water for 40 villages" && await pv("tagline") === "Clean water for 40 villages", `${tag}: ?goal= prefills the tagline and the preview`);
    await type("#st-tagline", "Boats for every child");
    check(await pv("tagline") === "Boats for every child", `${tag}: the preview follows the tagline`);
    await p.$eval("input[name=st-color][value='#E0457B']", (e) => e.click()); await sleep(450);
    check(await p.$eval("[data-preview]", (e) => e.style.getPropertyValue("--c")) === "#E0457B" && await p.$eval(".st-tile", (e) => getComputedStyle(e).backgroundColor) === "rgb(224, 69, 123)", `${tag}: a swatch recolours the preview`);
    await p.$eval("input[name=st-font][value=Lora]", (e) => e.click()); await p.$eval("input[name=st-variant][value=podium]", (e) => e.click()); await sleep(200);
    check(await p.$eval("[data-preview]", (e) => e.style.fontFamily.startsWith("Lora")) && await pv("variant") === "Podium" && await p.$eval("[data-pv=board]", (e) => e.dataset.kind === "podium" && !!e.querySelector(".st-podium")), `${tag}: the font and the layout redraw the preview`);
    await p.select("#st-variant", "night"); await sleep(150);
    check(await pv("variant") === "Night" && await p.$eval(".st-lay .st-tile2:last-child", (e) => e.dataset.on === "true" && /Night/.test(e.textContent)), `${tag}: every other layout is in the fourth tile`);
    await p.$eval("input[name=st-variant][value=podium]", (e) => e.click()); await sleep(150);
    check(await tall(".st-sw, .st-tile2, #st-tagline, .st-cta, .st-back"), `${tag}: step two's controls are at least 44px tall`);
    check(await overflow() <= 1, `${tag}: no sideways scroll on step two (${await overflow()}px)`);
    await shot("2-page", true);
    // back keeps what was typed
    await p.$eval(".st-back", (e) => e.click()); await sleep(600);
    check(await p.$eval("#st-name", (e) => e.value) === "Harbour Trust" && await p.$eval("#st-slug", (e) => e.value) === slug, `${tag}: Back returns to step one with everything kept`);
    await go();

    // step 3: optional details, then create
    await go();
    check(/receipts/.test(await h2()) && /^3\s*Details/.test(await now()) && /Create my organisation/.test(await p.$eval(".st-cta", (e) => e.textContent)) && /Stripe/.test(await p.$eval(".st-next", (e) => e.textContent)), `${tag}: step three is the optional details, with one call to action and the Stripe note`);
    await type("#st-country", "United Kingdom"); await type("#st-impact_unit", "boats"); await type("#st-impact_usd", "450");
    check(await overflow() <= 1, `${tag}: no sideways scroll on step three (${await overflow()}px)`);
    await shot("3-details", true);

    await go();
    await p.waitForFunction((s) => location.pathname.includes(`/o/${s}/admin/payments`), { timeout: 20000 }, slug).catch(() => {});
    await sleep(1200);
    check(new URL(p.url()).pathname.endsWith(`/o/${slug}/admin/payments`), `${tag}: creating lands on the new organisation's admin payments tab (${new URL(p.url()).pathname})`);
    const made = await p.evaluate(async (s) => { const { db } = await import("/src/shared/lib/db.ts"); return (await (await db()).rpc("org_by_slug", { s }))?.[0] ?? null; }, slug).catch(() => null);
    check(!!made && made.name === "Harbour Trust" && made.color === "#E0457B" && made.font === "Lora" && made.variant === "podium" && made.currency === "GBP" && made.country === "United Kingdom" && made.impact_unit === "boats" && Number(made.impact_usd) === 450 && made.tagline === "Boats for every child", `${tag}: the organisation was saved with every field`);
    check(/Stripe|payments|Harbour Trust/i.test(await p.evaluate(() => document.body.innerText)), `${tag}: the payments screen renders`);
    await p.screenshot({ path: `${shots}/start-${tag}-after.png` });
    await p.close();
}

await browser.close();
if (errors.length) { console.error(`\n${errors.length} problem(s):\n${errors.join("\n")}`); process.exit(1); }
console.log("\nstart: all checks passed");
