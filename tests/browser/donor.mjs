// Donor self-service in the demo: a monthly gift shows in the history with a receipt, and the regular gift can be resized, paused, resumed and cancelled.
import puppeteer from "puppeteer-core";

const exe = process.argv[2]; const shots = process.argv[3];
const base = "http://127.0.0.1:5173";
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ["--no-sandbox"] });
const p = await browser.newPage(); await p.setViewport({ width: 1440, height: 1000 });
const errors = [];
p.on("pageerror", (e) => errors.push(`[pageerror] ${String(e).slice(0, 200)}`));
p.on("console", (m) => { if (m.type() === "error") errors.push(`[console] ${m.text().slice(0, 200)}`); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = () => p.evaluate(() => document.body.innerText.replace(/\s+/g, " ")).catch(() => "");
const ready = async () => { for (let i = 0; i < 120; i++) { const t = await text(); if (t.length > 40 && !/Starting the demo|Loading…|Finding your receipt/.test(t)) return; await sleep(250); } };
const go = async (path) => { await p.goto(base + path, { waitUntil: "domcontentloaded" }); await ready(); await sleep(500); };
const click = (re, scope = "body") => p.evaluate((src, sc) => { const el = [...document.querySelectorAll(`${sc} button, ${sc} a`)].find((e) => e.getClientRects().length && !e.disabled && new RegExp(src).test(e.textContent.replace(/\s+/g, " ").trim())); el?.scrollIntoView({ block: "center" }); el?.click(); return !!el; }, re.source, scope);
const until = async (re, ms = 5000) => { for (let i = 0; i < ms / 100; i++) { if (re.test(await text())) return true; await sleep(100); } return false; };
const regular = () => p.evaluate(() => [...document.querySelectorAll("[data-regular]")].map((e) => `${e.dataset.regular}: ${e.innerText.replace(/\s+/g, " ")}`));
const overflow = () => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const shot = (n) => shots && p.screenshot({ path: `${shots}/donor-${n}.png`, fullPage: true });
const check = (c, m) => { if (!c) errors.push(`[assert] ${m}`); console.log(`${c ? "ok  " : "FAIL"} ${m}`); };

// Nothing given yet: both lists explain themselves.
await go("/dashboard/giving");
let t = await text();
check(/No regular gifts/.test(t) && /No gifts yet/.test(t), "giving opens at /dashboard/giving with empty states for regular gifts and history");
await shot("1-empty-desk");

// A monthly gift from a fundraiser's page.
await go("/demo/f/amara-okafor/donate/100");
check(await click(/^Monthly$/, "[role=dialog]"), "the gift form offers a monthly gift");
await sleep(150);
await p.evaluate(() => document.querySelector("[role=dialog] button[type=submit]")?.click());
check(await until(/Thank you/), "the monthly gift goes through");

await go("/dashboard/giving");
t = await text();
check(/Every gift ?· 1/.test(t) && /Amara Okafor/.test(t) && /Demo gift/.test(t) && /Paid/.test(t), "the gift is in the history with its campaign, method and status");
let reg = await regular();
check(reg.length === 1 && /^active: Amara Okafor Active \$100 a month .* next payment \d/.test(reg[0]), `it opened a regular gift with a next payment date [${reg[0]}]`);
check(await overflow() <= 1, "no sideways scroll at 1440px");

// Change the amount: refused out of range, then saved.
await click(/^Change amount$/); await p.waitForSelector("[role=dialog] input"); await sleep(800); // let the dialog settle: a click mid-animation lands on the overlay and closes it
const type = async (v) => { await p.click("[role=dialog] input", { clickCount: 3 }); await p.keyboard.press("Backspace"); await p.keyboard.type(v); };
await type("1"); await click(/^Save amount$/, "[role=dialog]");
check(await until(/Choose between \$2 and \$10,000/), "an amount below the minimum is refused with the range");
if (shots) await p.screenshot({ path: `${shots}/donor-2-amount-dialog.png` });
await type("40"); await click(/^Save amount$/, "[role=dialog]");
check(await until(/Now \$40 a month/), "the new amount is saved");
await sleep(400); reg = await regular();
check(/\$40 a month/.test(reg[0] ?? ""), `the regular gift shows the new amount [${reg[0]}]`);

// Pause and resume.
await click(/^Pause$/); await until(/Paused\. No payments/); await sleep(400); reg = await regular();
check(/^paused: .*no payments while paused/.test(reg[0] ?? "") && !(await click(/^Pause$/)), `pausing stops the payments [${reg[0]}]`);
await shot("3-paused-desk");
await click(/^Resume$/); await until(/Resumed/); await sleep(400); reg = await regular();
check(/^active: /.test(reg[0] ?? ""), "resuming starts them again");

// Cancel asks first.
await click(/^Cancel$/); check(await until(/Cancel your gift to Amara Okafor\?/), "cancel asks for confirmation");
if (shots) { await sleep(300); await p.screenshot({ path: `${shots}/donor-4-cancel-dialog.png` }); }
await click(/^Keep giving$/, "[role=dialog]"); await sleep(500); reg = await regular();
check(/^active: /.test(reg[0] ?? ""), "Keep giving leaves the gift running");
await click(/^Cancel$/); await until(/Cancel your gift/); await sleep(200); await click(/^Cancel gift$/, "[role=dialog]");
check(await until(/Cancelled\. Thank you/), "confirming cancels it");
await sleep(400); reg = await regular();
check(/^cancelled: .*cancelled \d/.test(reg[0] ?? "") && !(await click(/^(Pause|Resume|Change amount)$/)), `a cancelled gift has no controls left [${reg[0]}]`);
await go("/dashboard/giving"); reg = await regular();
check(/^cancelled: .*\$40 a month/.test(reg[0] ?? ""), "the server kept the change across a reload");
await shot("5-cancelled-desk");
check(/Regular gifts 0 running/.test(await text()) && /Given all-time \$100 1 gift/.test(await text()), "the summary counts what was given and the running regular gifts");
// The giving lives inside the dashboard shell: its nav marks it, and the organisation's views are a click away.
check(await p.evaluate(() => document.querySelector("#od-nav [aria-current=page]")?.textContent.trim() === "My giving"), "My giving is the current item in the dashboard nav");
await click(/^Subscriptions/, "#od-nav"); await until(/Expected each month/);
check(/\/dashboard\/subscriptions$/.test(p.url()) && !/Demo organiser/.test(await p.evaluate(() => [...document.querySelectorAll("[data-row]")].map((r) => r.innerText).join(" "))), "the charity's subscriptions keep only running, paused, failed or cancelled tabs; the cancelled demo gift is not under Active");
await click(/^Cancelled$/, "main"); await sleep(300);
check(/Demo organiser \$40 a month/.test(await p.evaluate(() => [...document.querySelectorAll("[data-row]")].map((r) => r.innerText.replace(/\s+/g, " ")).join(" | "))), "the organisation sees the donor's cancelled gift at its new amount");
await p.goBack(); await sleep(600);
check(/\/dashboard\/giving$/.test(p.url()) && /Every gift/.test(await text()), "back returns to My giving");
await go("/dashboard/account");
check(await p.evaluate(() => document.querySelector("input[aria-label=Name]")?.value === "Demo organiser" && document.querySelector("input[aria-label=Email]")?.disabled), "the account view keeps the donor's name and email");

// The receipt.
await go("/dashboard/giving"); await click(/^Receipt$/); await ready(); await until(/Donation receipt/i);
t = await text();
check(/\/dashboard\/receipt\/[0-9a-f-]{36}$/.test(p.url()), "Receipt opens at /dashboard/receipt/<gift id>");
check(/Donation receipt/i.test(t) && /Clearwell/.test(t) && /Received from Demo organiser/.test(t) && /Gift \(regular\) \$100/.test(t) && /Paid by Demo gift/.test(t) && /Reference [0-9a-f-]{36}/.test(t), "the receipt names the charity, the donor, the gift, the method and the reference");
check(await p.evaluate(() => [...document.querySelectorAll("button")].some((b) => /Print or save as PDF/.test(b.textContent))), "the receipt can be printed");
await shot("6-receipt-desk");
const receiptPath = new URL(p.url()).pathname;
await p.emulateMediaType("print"); await p.evaluate(() => window.dispatchEvent(new Event("beforeprint"))); await sleep(200);
check(!(await p.evaluate(() => document.documentElement.classList.contains("dark-mode"))), "the receipt prints on white, whatever the theme");
if (shots) await p.screenshot({ path: `${shots}/donor-7-receipt-print.png`, fullPage: true });
check(!(await p.evaluate(() => [...document.querySelectorAll("button")].some((b) => b.getClientRects().length))), "the printed receipt has no buttons on it");
await p.evaluate(() => window.dispatchEvent(new Event("afterprint"))); await p.emulateMediaType("screen");
await click(/^Your giving$/); await sleep(500);
check(/\/dashboard\/giving$/.test(p.url()), "the receipt links back to the giving tab");
await go("/dashboard/receipt/00000000-0000-4000-8000-00000000dead");
check(/We could not find that receipt/.test(await text()), "a gift that is not yours has no receipt");

// Phone.
await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await go("/dashboard/giving");
check(await overflow() <= 1, `no sideways scroll on the giving tab at 390px (${await overflow()}px)`);
check(await p.evaluate(() => [...document.querySelectorAll("button")].some((b) => b.getClientRects().length && b.textContent.trim() === "Receipt")), "the phone list keeps the receipt link");
await shot("8-giving-phone");
await go(receiptPath);
check(await overflow() <= 1, `no sideways scroll on the receipt at 390px (${await overflow()}px)`);
await shot("9-receipt-phone");

await browser.close();
const u = [...new Set(errors)];
console.log(u.length ? `\n${u.length} problems:\n${u.join("\n")}` : "\ndonor: history, receipt and regular-gift controls work, no console errors");
process.exit(u.length ? 1 : 0);
