// The create flow, step by step: per-step validation, team nesting choices, goal and money split, causes, draft survives reload, review, publish, sidebar guard.
import puppeteer from "puppeteer-core";
const [chrome, out] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: chrome, headless: true });
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 1000 });
const errs = []; p.on("pageerror", (e) => errs.push(String(e))); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
const results = []; const check = (ok, what) => results.push(`${ok ? "ok  " : "FAIL"} ${what}`);
const wait = (ms = 400) => new Promise((r) => setTimeout(r, ms));
const click = async (t) => { const ok = await p.evaluate((t) => { const el = [...document.querySelectorAll("button")].find((x) => x.innerText.trim() === t && !x.disabled); if (el) el.click(); return !!el; }, t); await wait(); return ok; };
const text = () => p.evaluate(() => document.body.innerText);
const fillLabel = async (label, v) => { const id = await p.evaluate((label) => { const l = [...document.querySelectorAll("label")].find((x) => x.textContent.trim().replace(/\*$/, "").trim() === label); return l?.getAttribute("for") || l?.querySelector("input")?.id || null; }, label); const el = id ? await p.$(`#${CSS.escape ? id : id}`) : null; if (!el) return false; await el.click({ clickCount: 3 }); await el.type(v); await wait(200); return true; };
const shot = (n) => p.screenshot({ path: `${out}/create-${n}.png`, fullPage: true });

await p.goto("http://127.0.0.1:5173/demo", { waitUntil: "networkidle0" });
await p.evaluate(() => { localStorage.removeItem("outgive.draft"); localStorage.setItem("theme", "light"); });
await p.goto("http://127.0.0.1:5173/demo/create", { waitUntil: "networkidle0" });
await p.waitForFunction(() => !document.body.innerText.includes("Loading…"), { timeout: 90000 });

// Step 1
await click("Team\nA group sharing one total") || await p.evaluate(() => [...document.querySelectorAll("button[aria-pressed]")].find((x) => /^Team/.test(x.innerText))?.click());
await wait(); await shot("step1"); await click("Continue");
// Step 2: blocked without team name
await click("Continue"); check(/Add the team name\./.test(await text()), "step 2 blocks Continue until the team name is set");
const joinOpts = await p.evaluate(() => [...document.querySelectorAll("select")].find((s) => s.closest("div")?.parentElement?.textContent.includes("Campaign or challenge to join"))?.options.length ?? 0);
check(joinOpts > 1, `step 2 lists the charity's live campaigns and challenges to join (${joinOpts - 1} found)`);
await p.evaluate(() => { const s = [...document.querySelectorAll("select")].find((s) => s.closest("div")?.parentElement?.textContent.includes("Campaign or challenge to join")); if (s && s.options.length > 1) { const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set; set.call(s, s.options[1].value); s.dispatchEvent(new Event("change", { bubbles: true })); } });
const nameInput = await p.$('input[placeholder="e.g. Harbour Runners"]'); await nameInput.type("Harbour Runners"); await wait();
check(!/Add the team name\./.test(await text()), "the message clears once the field is filled");
await shot("step2"); await click("Continue");
// Step 3
check(/What are you aiming to raise/.test(await text()), "step 2 continues to step 3 once complete");
const goalIn = await p.$('input[aria-label^="Goal in"]'); await goalIn.click({ clickCount: 3 }); await p.keyboard.press("Backspace"); await wait();
await click("Continue"); check(/Set a goal above zero\./.test(await text()), "step 3 blocks a zero goal");
await goalIn.type("12500"); await wait();
check(await p.$eval('input[aria-label^="Goal in"]', (i) => i.value) === "12,500", "goal shows grouped digits (12,500)");
const before = await p.$$eval('input[aria-label^="Use "]', (x) => x.length); await click("Add a line"); const after = await p.$$eval('input[aria-label^="Use "]', (x) => x.length);
check(after === before + 1, "money split: a line can be added"); await p.click(`button[aria-label="Remove use ${after}"]`); await wait();
check((await p.$$eval('input[aria-label^="Use "]', (x) => x.length)) === before, "money split: a line can be removed");
check(!/Raise the goal automatically/.test(await text()), "unsaved auto-goal option removed");
await shot("step3"); await click("Continue");
// Step 4
await shot("step4"); await click("Skip for now");
// Step 5
await click("Continue"); check(/Add a title for the page\./.test(await text()), "step 5 blocks Continue without a title");
check((await p.$$eval('[aria-label="Causes"] button', (x) => x.length)) === 16, "all 16 causes offered as chips");
await p.evaluate(() => { for (const t of ["Clean Water", "Children", "Health", "Hunger"]) [...document.querySelectorAll('[aria-label="Causes"] button')].find((b) => b.innerText === t)?.click(); }); await wait();
check((await p.$$eval('[aria-label="Causes"] button[aria-pressed="true"]', (x) => x.length)) === 3, "at most three causes can be chosen");
await (await p.$('input[placeholder^="e.g. Clean water"]')).type("Harbour Runners for water"); await wait();
await shot("step5");
// Reload keeps the draft
await p.reload({ waitUntil: "networkidle0" }); await p.waitForFunction(() => !document.body.innerText.includes("Loading…"), { timeout: 90000 }); await wait(800);
const t5 = await text();
check(/What should we call it/.test(t5) && (await p.$eval('input[placeholder^="e.g. Clean water"]', (i) => i.value)) === "Harbour Runners for water" && (await p.$$eval('[aria-label="Causes"] button[aria-pressed="true"]', (x) => x.length)) === 3, "reload keeps the step, title and causes");
await click("Continue");
// Step 6, 7
await shot("step6"); await click("Continue");
const t7 = await text();
check(/Country/.test(t7) && /Gift buttons/.test(t7) && /Causes/.test(t7) && /Joins/.test(t7) && /12,500/.test(t7), "review lists country, joined campaign, goal, gift buttons and causes");
await p.evaluate(() => { const c = [...document.querySelectorAll("input[type=checkbox]")].find((i) => /agree/i.test(i.closest("label")?.textContent ?? "")); c?.click(); }); await wait();
await shot("step7"); await click("Publish"); await wait(2500);
const tl = await text(); check(/page is live/.test(tl), "publishing reaches the live screen"); await shot("live");
// Sidebar can't jump past an incomplete step
await p.evaluate(() => localStorage.removeItem("outgive.draft"));
await p.goto("http://127.0.0.1:5173/demo/create", { waitUntil: "networkidle0" }); await p.waitForFunction(() => !document.body.innerText.includes("Loading…"), { timeout: 90000 });
await p.evaluate(() => [...document.querySelectorAll("button[aria-pressed]")].find((x) => /^In memory/.test(x.innerText))?.click()); await wait();
await p.evaluate(() => [...document.querySelectorAll('nav[aria-label="Steps"] button')].find((x) => /Review/.test(x.innerText))?.click()); await wait();
check(/Add the name of the person this page remembers\./.test(await text()), "sidebar jump stops at the first incomplete step and says why");
console.log(results.join("\n")); console.log(errs.length ? errs.slice(0, 5) : "create: every step checked, no console errors"); await b.close();
process.exit(results.some((r) => r.startsWith("FAIL")) || errs.length ? 1 : 0);
