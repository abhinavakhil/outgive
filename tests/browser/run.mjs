// Drives the demo in headless Chrome: every route loads, the interactive flows work, and a phone gift lands on the live screen.
// Needs `npm run dev -- --host` running on http://127.0.0.1:5173. Chrome is found from $CHROME or the usual install paths.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const candidates = [process.env.CHROME, `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`, "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean);
const chrome = candidates.find((p) => fs.existsSync(p));
if (!chrome) { console.error("No Chrome found; set CHROME=/path/to/chrome"); process.exit(2); }
const shots = path.resolve("tests/browser/shots"); fs.mkdirSync(shots, { recursive: true });
let failed = false;
for (const script of ["smoke.mjs", "flows.mjs", "live.mjs"]) {
    console.log(`\n== ${script}`);
    const r = spawnSync(process.execPath, [path.resolve("tests/browser", script), chrome, shots], { stdio: "inherit" });
    if (r.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
