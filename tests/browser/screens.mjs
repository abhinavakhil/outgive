// Every screen, at desktop and phone width: it loads, shows real content, has no console or page errors, no failed requests and no sideways scroll.
import puppeteer from "puppeteer-core";

const exe = process.argv[2]; const shots = process.argv[3];
const base = "http://127.0.0.1:5173";
const ROUTES = [
    "/", "/ramadan", "/legacy", "/pricing", "/checkout", "/checkout?checkout_layout=pledge", "/checkout?checkout_layout=ticket",
    "/blog", "/about", "/faq", "/rules", "/terms", "/privacy", "/start", "/login", "/create",
    "/dashboard", "/demo", "/demo/donate", "/demo/live", "/demo/admin", "/demo/admin/payments", "/demo/checkout",
    "/demo/c/clean-water-for-40-villages", "/demo/f/amara-okafor", "/demo/embed", "/demo/overlay", "/layouts", "/nope-404",
];
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ["--no-sandbox"] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const check = (c, m) => { if (!c) fails.push(m); console.log(`${c ? "ok  " : "FAIL"} ${m}`); };
for (const [w, h, tag] of [[1440, 900, "desk"], [390, 844, "phone"]]) {
    const p = await browser.newPage(); await p.setViewport({ width: w, height: h });
    let errs = [];
    p.on("pageerror", (e) => errs.push(`pageerror ${String(e).slice(0, 160)}`));
    p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource: .*(404|ERR_ABORTED)/.test(m.text())) errs.push(`console ${m.text().slice(0, 160)}`); });
    p.on("requestfailed", (r) => { const u = r.url(); if (u.startsWith(base) && !/\/@vite|hot-update|favicon/.test(u) && r.failure()?.errorText !== "net::ERR_ABORTED") errs.push(`request ${r.failure()?.errorText} ${u.replace(base, "")}`); });
    for (const route of ROUTES) {
        errs = [];
        await p.goto(base + route, { waitUntil: "domcontentloaded" });
        // wait for real content: past the demo's "Starting…/Loading…" splash
        let text = "";
        for (let i = 0; i < 80; i++) { text = await p.evaluate(() => document.body.innerText.replace(/\s+/g, " ")).catch(() => ""); if (text.length > (route.includes("overlay") ? 5 : 60) && !/^(Loading…|Starting the demo)/.test(text.trim())) break; await sleep(250); }
        await sleep(700);
        const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth).catch(() => -1);
        const name = `${tag} ${route}`;
        // the stream overlay is a small transparent bar by design, so it needs far less text
        check(text.length > (route.includes("overlay") ? 5 : 60), `${name}: shows content`);
        check(over <= 1, `${name}: no sideways scroll${over > 1 ? ` (${over}px)` : ""}`);
        check(!errs.length, `${name}: no errors${errs.length ? ` [${errs.slice(0, 3).join(" | ")}]` : ""}`);
        await p.screenshot({ path: `${shots}/screen-${tag}-${route.replace(/[^a-z0-9]+/gi, "_") || "home"}.png` });
    }
    await p.close();
}
await browser.close();
if (fails.length) { console.log(`\n${fails.length} problem(s):\n${fails.join("\n")}`); process.exit(1); }
console.log("screens: all good");
