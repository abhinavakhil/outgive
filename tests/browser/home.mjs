// / at desktop and phone width (the V8 orchid design): it renders in Schibsted Grotesk with no sideways scroll or console errors,
// the hero ask box opens the donate app with its switches, both audiences have their own way in,
// and the live donate page loads in the phone, follows the layout switch and shows no scrollbars.
import puppeteer from "puppeteer-core";

const exe = process.argv[2]; const shots = process.argv[3] ?? "tests/browser/shots";
const base = "http://127.0.0.1:5173";
// Headless Chrome hides scrollbars by default; keep them, so the check that the phone preview shows none means something.
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ["--no-sandbox"], ignoreDefaultArgs: ["--hide-scrollbars"] });
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (c, m) => { if (!c) errors.push(`[assert] ${m}`); console.log(`${c ? "ok  " : "FAIL"} ${m}`); };

for (const [vw, vh, tag] of [[1440, 1000, "desk"], [390, 844, "phone"]]) {
    const p = await browser.newPage(); await p.setViewport({ width: vw, height: vh, isMobile: vw < 500, hasTouch: vw < 500 });
    p.on("pageerror", (e) => errors.push(`[pageerror ${tag}] ${String(e).slice(0, 200)}`));
    p.on("console", (m) => { if (m.type() === "error") errors.push(`[console ${tag}] ${m.text().slice(0, 200)}`); });
    await p.goto(`${base}/`, { waitUntil: "networkidle2" });
    await p.waitForSelector("#how", { timeout: 15000 });
    await p.evaluate(() => document.fonts.ready);
    const overflow = () => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const press = (scope, re) => p.evaluate((scope, src) => { const b = [...document.querySelectorAll(`${scope} button`)].find((e) => new RegExp(src).test(e.textContent.trim())); b?.click(); return !!b; }, scope, re.source);
    const shot = async (sel, name) => { await p.evaluate((s) => document.querySelector(s).scrollIntoView({ block: "start" }), sel); await sleep(1100); await p.screenshot({ path: `${shots}/home-${tag}-${name}.png` }); };
    /** The checkout inside the phone: its address and whether it has drawn anything. */
    const phone = async () => { const f = await (await p.waitForSelector("#donate iframe")).contentFrame(); await f.waitForFunction(() => document.body.innerText.length > 40, { timeout: 20000 }); return f.url(); };
    const font = (sel) => p.$$eval(sel, (els) => els.map((e) => { const s = getComputedStyle(e); return `${s.fontFamily.split(",")[0].replaceAll('"', "")} ${s.fontWeight}`; }));

    await p.screenshot({ path: `${shots}/home-${tag}-hero.png` });
    const h = await p.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < h; y += 500) { await p.evaluate((y) => scrollTo(0, y), y); await sleep(120); }
    await sleep(900);
    check(await p.evaluate(() => [...document.querySelectorAll(".rd-reveal")].every((e) => e.classList.contains("is-in"))), `${tag}: every section reveals on scroll`);
    check(await overflow() <= 1, `${tag}: no sideways scroll (${await overflow()}px)`);

    // type: Schibsted Grotesk for headings and body, JetBrains Mono for the small labels, Caveat for the scribbles
    check(await p.evaluate(() => document.fonts.check('700 40px "Schibsted Grotesk"') && document.fonts.check('500 13px "JetBrains Mono"') && document.fonts.check('600 22px "Caveat"')), `${tag}: the three typefaces are loaded`);
    const heads = await font("h1, main h2:not(#rd-for), main h3, footer h2");
    check(heads.length >= 14 && heads.every((f) => f === "Schibsted Grotesk 700"), `${tag}: every headline is Schibsted Grotesk bold (${heads.length}: ${[...new Set(heads)].join(" | ")})`);
    check((await font("h1 + p"))[0] === "Schibsted Grotesk 400", `${tag}: body text is Schibsted Grotesk 400 (${(await font("h1 + p"))[0]})`);
    check((await font("#give .rd-mono"))[0] === "JetBrains Mono 500", `${tag}: the labels are JetBrains Mono 500 (${(await font("#give .rd-mono"))[0]})`);
    check(await p.evaluate(() => ![...document.querySelectorAll(".rd *")].some((e) => /Junicode|Bricolage/.test(getComputedStyle(e).fontFamily.split(",")[0]))), `${tag}: nothing is set in Junicode or Bricolage`);

    // the design: purple board, lilac paper, the ruler of thirty nights, six honest appeal types, three essentials, three medals
    check(await p.$eval("section.rd-board", (e) => getComputedStyle(e).backgroundColor) === "rgb(74, 29, 107)" && await p.$eval("main", (e) => getComputedStyle(e).backgroundColor) === "rgb(247, 243, 250)", `${tag}: the board is purple and the paper lilac`);
    check(await p.$$eval("section.rd-board [role=img][aria-label*='30 nights'] > div", (c) => c.length === 30 && c.filter((e) => getComputedStyle(e).backgroundColor !== "rgba(0, 0, 0, 0)").length === 10), `${tag}: the ruler has thirty nights with the last ten highlighted`);
    check((await p.$$("section[aria-labelledby=rd-for] li")).length === 6 && !/\[N\]|partner/i.test(await p.$eval("section[aria-labelledby=rd-for]", (e) => e.textContent)), `${tag}: six appeal types in the strip, no partner claims`);
    check((await p.$$("#give article")).length === 3 && (await p.$$("#why article")).length === 3, `${tag}: three essentials and three medals`);
    check(await p.$$eval("#give article", (a) => a.filter((e) => /Coming for Ramadan/.test(e.textContent)).length === 1 && /Last Ten Nights/.test(a[1].textContent) && /Coming for Ramadan/.test(a[1].textContent)), `${tag}: Last 10 Nights scheduling is marked as coming`);
    check(/\[LEGAL NAME\].*\[REG\. NO\.\]/.test(await p.$eval("footer", (e) => e.textContent)), `${tag}: the footer placeholders stay bracketed`);
    const props = await p.$$eval("section.rd-board > [aria-hidden=true]:last-child, footer > [aria-hidden=true]:last-child", (els) => els.map((e) => getComputedStyle(e).display));
    check(props.length === 2 && props.every((x) => x === (vw > 1279 ? "block" : "none")), `${tag}: the desk props ${vw > 1279 ? "show" : "are hidden"} (${props})`);

    // calls to action
    check(await p.$$eval("a", (as) => as.filter((a) => a.textContent.trim() === "Start free").length >= 3 && as.filter((a) => a.textContent.trim() === "Start free").every((a) => a.getAttribute("href") === "/start") && as.filter((a) => a.textContent.trim() === "Start a fundraiser").every((a) => a.getAttribute("href") === "/create")), `${tag}: Start free leads to /start and Start a fundraiser to /create`);
    check(await p.$eval("#rd-charity a", (e) => e.getAttribute("href")) === "/start" && await p.$eval("#rd-fundraiser a", (e) => e.getAttribute("href")) === "/create", `${tag}: charities are led to /start and fundraisers to /create`);
    await shot("#who", "who");

    // the live donate page in the phone, following the layout switch
    await p.evaluate(() => document.querySelector("#donate").scrollIntoView()); await sleep(300);
    check(/checkout_layout=hero/.test(await phone()) && /preview=1/.test(await phone()), `${tag}: the phone loads the live checkout`);
    // the phone: no scrollbars on the previewed page or inside it, and the page sits exactly inside the screen
    const frame = await (await p.$("#donate iframe")).contentFrame();
    if (vw > 500) check(await p.evaluate(() => innerWidth - document.documentElement.clientWidth) > 0, `${tag}: this browser draws real scrollbars (so the next check counts)`);
    const bars = await frame.evaluate(() => ({ preview: document.documentElement.classList.contains("ck-preview"), page: innerWidth - document.documentElement.clientWidth, scrollers: [...document.querySelectorAll("*")].filter((e) => /auto|scroll/.test(getComputedStyle(e).overflow)).length, inner: [...document.querySelectorAll("*")].filter((e) => { const s = getComputedStyle(e); return /auto|scroll/.test(s.overflow) && (e.offsetHeight - e.clientHeight - parseFloat(s.borderTopWidth) - parseFloat(s.borderBottomWidth) > 2 || e.offsetWidth - e.clientWidth - parseFloat(s.borderLeftWidth) - parseFloat(s.borderRightWidth) > 2); }).length, scrolls: document.documentElement.scrollHeight > innerHeight }));
    check(bars.preview && bars.page === 0 && bars.inner === 0 && bars.scrolls, `${tag}: the previewed page still scrolls but shows no scrollbars (${JSON.stringify(bars)})`);
    const fit = await p.evaluate(() => { const f = document.querySelector("#donate iframe"), r = f.getBoundingClientRect(), s = f.parentElement.parentElement, b = s.getBoundingClientRect(), st = document.querySelector("#donate").getBoundingClientRect(); return { inside: r.left >= b.left - 1 && r.right <= b.right + 1 && r.top >= b.top && r.bottom <= b.bottom + 1, wide: Math.abs(r.width - b.width) <= 1, border: getComputedStyle(f).borderTopWidth, clip: getComputedStyle(s).overflow, radius: parseFloat(getComputedStyle(s).borderTopLeftRadius), inStage: b.left >= st.left && b.right <= st.right, events: getComputedStyle(f).pointerEvents }; });
    check(fit.inside && fit.wide && fit.border === "0px" && fit.clip === "hidden" && fit.radius >= 40 && fit.inStage, `${tag}: the page fills the phone screen exactly, with no border (${JSON.stringify(fit)})`);
    // on a small screen the preview is for looking at: a tap opens the page full screen, so it never traps the page's scroll
    if (vw < 500) check(fit.events === "none" && await p.$eval("#donate a", (e) => e.offsetHeight > 300 && /^\/checkout\?checkout_layout=hero/.test(e.getAttribute("href")) && !/preview/.test(e.getAttribute("href"))), `${tag}: tapping the phone opens the donate page full screen`);
    else check(fit.events === "auto" && await p.$eval("#donate a", (e) => getComputedStyle(e).display === "none"), `${tag}: the preview is live and can be used in place`);
    await shot("#how", "how");
    await shot("#donate", "donate-hero");
    await (await p.$("#donate .rd-phone")).screenshot({ path: `${shots}/home-${tag}-phone.png` });
    check((await p.$$("#how ol li")).length === 3, `${tag}: three steps beside the phone`);
    for (const [name, id] of [["Pledge", "pledge"], ["Gift ticket", "ticket"]]) {
        await press("#donate", new RegExp(`^${name}$`)); await sleep(300);
        check(new RegExp(`checkout_layout=${id}`).test(await phone()), `${tag}: the ${name} layout loads in the phone`);
        check(await p.$eval("#how a.rd-btn-yellow", (e, id) => e.textContent === "Open it full screen" && e.getAttribute("href").includes(`checkout_layout=${id}`) && !e.getAttribute("href").includes("preview"), id), `${tag}: "Open it full screen" follows the ${name} layout`);
    }
    check(await p.$eval("#how a.rd-btn-grey", (e) => e.textContent === "Use it for my appeal" && e.getAttribute("href") === "/start"), `${tag}: "Use it for my appeal" leads to /start`);
    await sleep(1500); await shot("#donate", "donate-ticket");
    check(await p.$$eval(".rd button, .rd a[class*=rd-btn]", (bs) => bs.filter((b) => b.offsetParent).every((b) => b.getBoundingClientRect().height >= 44)), `${tag}: every button is at least 44px tall`);
    check(await overflow() <= 1, `${tag}: still no sideways scroll after using the page (${await overflow()}px)`);

    for (const [sel, name] of [["section[aria-labelledby=rd-for]", "strip"], ["#give", "essentials"], ["#give article", "cards"], ["#why", "medals"], ["#why article", "medal-row"], ["#cta", "cta"]]) await shot(sel, name);
    await p.evaluate(() => scrollTo(0, document.body.scrollHeight)); await sleep(900); await p.screenshot({ path: `${shots}/home-${tag}-footer.png` });
    await p.evaluate(() => scrollTo(0, 0)); await sleep(300);
    await p.screenshot({ path: `${shots}/home-${tag}.png`, fullPage: true });

    // the ask box, last because it leaves the page: an example fills it, the switches turn Gift Aid and matching off, and it opens the donate app
    check(await p.$eval("#rd-ask", (e) => e.labels.length === 1 && e.value.length > 10), `${tag}: the ask box is labelled and starts with an example`);
    await p.$eval("button[aria-label^='Try an example: Give every night']", (b) => b.click());
    check(/Last 10 Nights/.test(await p.$eval("#rd-ask", (e) => e.value)), `${tag}: an example chip fills the ask box`);
    await press("form", /^Gift Aid$/);
    check(await p.$$eval("form button[aria-pressed]", (bs) => bs.map((b) => b.getAttribute("aria-pressed")).join()) === "false,true", `${tag}: the Gift Aid switch turns off`);
    await Promise.all([p.waitForNavigation({ waitUntil: "domcontentloaded" }), p.click("form button[type=submit]")]);
    const u = new URL(p.url());
    check(u.pathname === "/checkout" && /Last 10 Nights/.test(u.searchParams.get("appeal")) && u.searchParams.get("giftaid") === "0" && !u.searchParams.has("match"), `${tag}: the ask box opens the donate app with the appeal and giftaid=0 (${u.pathname}${u.search})`);
    await p.close();
}

await browser.close();
if (errors.length) { console.error(`\n${errors.length} problem(s):\n${errors.join("\n")}`); process.exit(1); }
console.log("\nhome: all checks passed");
