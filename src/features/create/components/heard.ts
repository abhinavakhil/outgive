import type { PageType } from "@/shared/domain/model";

const SCALE: Record<string, number> = { k: 1e3, grand: 1e3, thousand: 1e3, lakh: 1e5, lakhs: 1e5, m: 1e6, million: 1e6 };
const MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december";
const NOT_NAMES = new Set(["I", "In", "On", "The", "We", "My", "Our", "It", "She", "He", "They", "This", "That", "And", "But", "So", "Dr", "Mr", "Mrs", "Ms"]);

/** Pulls a draft out of what someone said: title, page type, goal (in the page currency's units), a date, the person's name, the story.
 *  ponytail: keyword + regex heuristics, good for "my son Sam needs 5,000 by June"; swap for an LLM call once there's a server to make it. */
export const heard = (said: string) => {
    const s = said.replace(/\s+/g, " ").trim();
    const amounts = [...s.matchAll(/[£$€₹]?\s?(\d[\d,]*(?:\.\d+)?)\s*(k|grand|thousand|lakhs?|m|million)?\b/gi)]
        .filter((m) => m[0].match(/[£$€₹]/) || m[2] || Number(m[1].replace(/,/g, "")) >= 100)
        .map((m) => Number(m[1].replace(/,/g, "")) * (SCALE[m[2]?.toLowerCase() ?? ""] ?? 1))
        .filter((n) => !(n >= 1900 && n <= 2100 && !/[,.]/.test(String(n)))); // a year, not money
    const when = s.match(new RegExp(`\\b(\\d{1,2}(?:st|nd|rd|th)? (?:of )?(?:${MONTHS})|(?:${MONTHS}) \\d{1,2}(?:st|nd|rd|th)?)\\b`, "i"))?.[0];
    const isName = (w = "") => /^\p{Lu}\p{Ll}+$/u.test(w) && !NOT_NAMES.has(w) && !new RegExp(`^(${MONTHS})$`, "i").test(w);
    // The first capitalised run not starting a sentence ("Priya", "Harbour Runners").
    const name = s.split(/(?<=[.!?])\s+/).map((x) => x.split(" ").map((w) => w.replace(/[^\p{L}'-]/gu, ""))).map((ws) => { const i = ws.findIndex((w, j) => j > 0 && isName(w)); if (i < 0) return ""; let k = i; while (isName(ws[k + 1]) && /^[\p{L}'-]+$/u.test(ws[k])) k++; return ws.slice(i, k + 1).join(" "); }).find(Boolean) || undefined;
    const type: PageType | undefined = /\b(in memory|passed away|died|memorial)\b/i.test(s) ? "memory" : /\b(marathon|run|running|walk|ride|cycle|swim|km|miles|challenge)\b/i.test(s) ? "challenge" : /\b(gala|dinner|concert|event|tickets)\b/i.test(s) ? "event" : /\b(our team|the team|teammates)\b/i.test(s) ? "team" : s ? "fundraiser" : undefined;
    const title = !s ? "" : name ? (type === "memory" ? `In memory of ${name}` : `Help ${name}`) : s.split(/[.!?]/)[0].slice(0, 60).trim();
    return { title, type, goal: amounts.length ? Math.max(...amounts) : 0, when, name, story: s };
};

const ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(" ");
const TENS = "  twenty thirty forty fifty sixty seventy eighty ninety".split(" ");
const small = (n: number): string => n < 20 ? ONES[n] : n < 100 ? TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : "") : `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` ${small(n % 100)}` : ""}`;
/** 250000 → "two lakh fifty thousand" (Indian) or "two hundred fifty thousand". Shown beside the goal so a typo'd zero is obvious. */
export const inWords = (n: number, indian = false): string => {
    n = Math.floor(n);
    if (n <= 0) return "";
    const units: [number, string][] = indian ? [[1e7, "crore"], [1e5, "lakh"], [1e3, "thousand"]] : [[1e9, "billion"], [1e6, "million"], [1e3, "thousand"]];
    for (const [v, name] of units) if (n >= v) return `${inWords(Math.floor(n / v), indian)} ${name}${n % v ? ` ${inWords(n % v, indian)}` : ""}`;
    return small(n);
};
