// Text-to-give and the opt-out words, as pure functions: no Deno, no database. Used by sms-inbound/index.ts and by the
// Campaigns screen (src/features/engage/campaigns), and tested by both deno test and vitest (campaigns/sms.test.ts).

/** Carrier and CTIA opt-out, opt-in and help words. Matched on the whole message, any case. */
export const STOP_WORDS = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "OPTOUT", "REVOKE"];
export const START_WORDS = ["START", "UNSTOP", "YES", "OPTIN"];
export const HELP_WORDS = ["HELP", "INFO"];
const RESERVED = new Set([...STOP_WORDS, ...START_WORDS, ...HELP_WORDS]);

/** A keyword: a letter, then letters or numbers, 3 to 15 long, stored upper case. */
export const KEYWORD = /^[A-Z][A-Z0-9]{2,14}$/;
export const keywordProblem = (k: string): string | null =>
    !KEYWORD.test(k) ? "Use 3 to 15 letters or numbers, starting with a letter." : RESERVED.has(k) ? `${k} is kept for opt-outs and help. Pick another word.` : null;

/** The biggest and smallest gift a text can start, in dollars. */
export const MIN_GIFT = 1, MAX_GIFT = 10000;

export type Parsed =
    | { kind: "stop" | "start" | "help" }
    | { kind: "give"; keyword: string; amount: number | null }
    | { kind: "unknown" };
/** "iftar 50", "IFTAR $50.00", "Iftar" → give; "stop" → stop. The amount is whole dollars and cents; anything else is unknown. */
export const parse = (body: string): Parsed => {
    const t = (body ?? "").trim().toUpperCase().replace(/\s+/g, " ");
    const bare = t.replace(/[^A-Z]/g, "");
    if (STOP_WORDS.includes(bare)) return { kind: "stop" };
    if (START_WORDS.includes(bare)) return { kind: "start" };
    if (HELP_WORDS.includes(bare)) return { kind: "help" };
    const m = t.match(/^([A-Z][A-Z0-9]{2,14})(?:\s+\$?\s?(\d{1,6}(?:,\d{3})*(?:\.\d{1,2})?)\s*(?:USD|DOLLARS?)?)?[.!]?$/);
    if (!m || RESERVED.has(m[1])) return { kind: "unknown" };
    return { kind: "give", keyword: m[1], amount: m[2] ? Number(m[2].replace(/,/g, "")) : null };
};

export type KeywordRow = { keyword: string; org_slug: string; org_name: string; fund: string; amount_cents: number | null; appeal: string };
/** The one-tap give link: the charity's checkout with the amount and fund filled in, tagged as a text gift for revenue tracking. */
export const giveLink = (site: string, k: Pick<KeywordRow, "keyword" | "org_slug" | "fund">, amount: number | null) => {
    const q = new URLSearchParams({ ...(amount ? { amount: String(amount) } : {}), ...(k.fund ? { fund: k.fund } : {}), utm_source: "sms", utm_medium: "text", utm_campaign: k.keyword.toLowerCase() });
    return `${site.replace(/\/$/, "")}/o/${k.org_slug}/checkout?${q}`;
};

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
export const HELP_REPLY = "Outgive text-to-give: text a charity's keyword and an amount, like IFTAR 50, for a link to give. No charge to your phone bill. Msg and data rates may apply. Reply STOP to opt out. Help: help@outgive.org";
export const START_REPLY = "Outgive: you are subscribed again. Msg and data rates may apply. Reply HELP for help, STOP to opt out.";
export const UNKNOWN_REPLY = "Outgive: we did not recognise that keyword. Check the word on the poster and try again, like IFTAR 50. Reply HELP for help.";

/** The reply to a keyword text. The gift is made on the web page; nothing goes on the phone bill. */
export const giveReply = (site: string, k: KeywordRow, asked: number | null): string => {
    const amount = asked ?? (k.amount_cents ? k.amount_cents / 100 : null);
    if (amount !== null && (amount < MIN_GIFT || amount > MAX_GIFT)) return `${k.org_name}: text-to-give takes ${usd(MIN_GIFT)} to ${usd(MAX_GIFT)}. Text ${k.keyword} and an amount, like ${k.keyword} 50.`;
    const what = k.appeal ? ` to ${k.appeal}` : "";
    return `${k.org_name}: thank you. ${amount ? `Give ${usd(amount)}${what}` : `Give${what}`} in one tap: ${giveLink(site, k, amount)} Reply STOP to opt out.`;
};

/** TwiML for a reply, or an empty response (no reply). */
export const twiml = (text?: string) =>
    `<?xml version="1.0" encoding="UTF-8"?><Response>${text ? `<Message>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</Message>` : ""}</Response>`;

/**
 * Twilio's request signature: base64 HMAC-SHA1 of the full webhook URL followed by each POST parameter's name and value,
 * sorted by name, keyed with the account's auth token.
 */
export const twilioSignature = async (authToken: string, url: string, params: Record<string, string>) => {
    const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(authToken), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
    const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
    return btoa(String.fromCharCode(...sig));
};
/** Constant-time check of the X-Twilio-Signature header. */
export const validSignature = async (authToken: string, url: string, params: Record<string, string>, header: string | null) => {
    if (!header) return false;
    const want = await twilioSignature(authToken, url, params);
    if (want.length !== header.length) return false;
    let diff = 0;
    for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ header.charCodeAt(i);
    return diff === 0;
};
