// Email and SMS for every feature (pledge recovery, receipts, journeys). One call: send({ to, channel, subject, body }).
// Providers are tried in order and the first one that is set up for the channel sends:
//   email: Resend when RESEND_API_KEY is set, otherwise the console provider. From is "<charity> via Outgive" <NOTIFY_FROM address> when
//          the message names its charity (fromName), with replyTo and headers (unsubscribeHeaders) passed through.
//   sms:   Twilio (twilio.ts) when TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM are set, otherwise console. CONSOLE = NOTHING IS SENT: it logs the message and answers ok with provider "console".
//
// The outbox pattern: a feature keeps its messages in its own table (status pending -> sending -> sent | failed | skipped),
// claims due rows in SQL with `for update skip locked` (see pledge_reminders_claim), then hands them to drain() below,
// which sends each and reports back through `mark`. A row is never sent twice, and a crash leaves it to be reclaimed.

import { twilio } from "./twilio.ts";

export type Channel = "email" | "sms";
export interface Message {
    to: string; channel: Channel; body: string;
    /** Email only. */ subject?: string;
    /** Email only; `body` is the plain-text part. */ html?: string;
    /** For the log. */ orgId?: string;
    /** Email only: the charity sending it. From becomes "<fromName> via Outgive" <NOTIFY_FROM's address> (CAN-SPAM: a truthful sender). */ fromName?: string;
    /** Email only: where replies go, e.g. the charity's contact email (orgs.contact_email). */ replyTo?: string;
    /** Email only: extra headers, e.g. unsubscribeHeaders(). */ headers?: Record<string, string>;
}
export interface Result { ok: boolean; provider: string; id?: string; error?: string }
export interface Provider { id: string; channels: Channel[]; ready: () => boolean; send: (m: Message) => Promise<Result> }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/, PHONE = /^\+[1-9][0-9]{7,14}$/;
const BASE_FROM = () => Deno.env.get("NOTIFY_FROM") ?? Deno.env.get("RECEIPT_FROM") ?? "Outgive <receipts@outgive.org>";
/** The address inside "Name <address>" (or the whole string when there are no brackets). */
export const addressOf = (from: string) => from.match(/<([^>]+)>/)?.[1] ?? from.trim();
/** `"Hope Foundation via Outgive" <notify@outgive.org>` for a charity; NOTIFY_FROM as is without one. Quotes and brackets are dropped from the name. */
export const fromLine = (charity?: string, base = BASE_FROM()) => {
    const name = (charity ?? "").replace(/["<>\r\n]/g, "").trim().slice(0, 80);
    return name ? `"${name} via Outgive" <${addressOf(base)}>` : base;
};
/**
 * RFC 8058 one-click unsubscribe headers. `url` must accept a POST with body "List-Unsubscribe=One-Click" (journey-run ?u=<token>,
 * pledge-recovery ?u=<token>). A mailto is added only when NOTIFY_UNSUBSCRIBE_MAILTO is set, because someone has to act on that inbox.
 */
export const unsubscribeHeaders = (url: string, mailto = Deno.env.get("NOTIFY_UNSUBSCRIBE_MAILTO")): Record<string, string> => ({
    "List-Unsubscribe": [mailto ? `<mailto:${mailto}?subject=unsubscribe>` : "", `<${url}>`].filter(Boolean).join(", "),
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
});

const resend: Provider = {
    id: "resend", channels: ["email"], ready: () => !!Deno.env.get("RESEND_API_KEY"),
    send: async (m) => {
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST", headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: fromLine(m.fromName), to: [m.to], subject: m.subject ?? "", text: m.body, ...(m.html ? { html: m.html } : {}),
                ...(m.replyTo && EMAIL.test(m.replyTo) ? { reply_to: m.replyTo } : {}), ...(m.headers ? { headers: m.headers } : {}) }),
        });
        if (!res.ok) return { ok: false, provider: "resend", error: `${res.status} ${(await res.text()).slice(0, 300)}` };
        return { ok: true, provider: "resend", id: ((await res.json()) as { id?: string }).id };
    },
};

/** Development stand-in: logs, sends nothing. */
export const consoleProvider: Provider = {
    id: "console", channels: ["email", "sms"], ready: () => true,
    send: (m) => {
        const head = m.channel === "email" ? `\nFrom: ${fromLine(m.fromName)}${m.replyTo ? `\nReply-To: ${m.replyTo}` : ""}${Object.entries(m.headers ?? {}).map(([k, v]) => `\n${k}: ${v}`).join("")}` : "";
        console.log(`[notify:console] ${m.channel} to ${m.to}${m.orgId ? ` (org ${m.orgId})` : ""}${m.subject ? ` | ${m.subject}` : ""}${head}\n${m.body}`);
        return Promise.resolve({ ok: true, provider: "console" });
    },
};

export const PROVIDERS: Provider[] = [resend, twilio, consoleProvider];

export const send = async (m: Message, providers = PROVIDERS): Promise<Result> => {
    if (!(m.channel === "email" ? EMAIL : PHONE).test(m.to ?? "")) return { ok: false, provider: "none", error: `no valid ${m.channel === "email" ? "email address" : "phone number"}` };
    const p = providers.find((x) => x.channels.includes(m.channel) && x.ready());
    if (!p) return { ok: false, provider: "none", error: `no ${m.channel} provider` };
    try { return await p.send(m); } catch (e) { return { ok: false, provider: p.id, error: (e as Error).message }; }
};

export type Mark = { status: "sent" | "failed" | "skipped"; provider: string | null; error: string | null; sent_at: string | null };
/**
 * Sends claimed outbox rows one by one. `build` turns a row into a message, or null to skip it (no address, nothing to say).
 * `mark` writes the outcome back to the row. Returns the counts.
 */
export const drain = async <R extends { id: string }>(rows: R[], build: (r: R) => Message | null, mark: (id: string, m: Mark) => Promise<void>, providers = PROVIDERS) => {
    const n = { sent: 0, failed: 0, skipped: 0 };
    for (const r of rows) {
        const m = build(r);
        const out = m ? await send(m, providers) : { ok: false, provider: "none", error: "nothing to send" };
        const status = out.ok ? "sent" : out.provider === "none" ? "skipped" : "failed";
        n[status]++;
        await mark(r.id, { status, provider: out.provider === "none" ? null : out.provider, error: out.error ?? null, sent_at: out.ok ? new Date().toISOString() : null });
    }
    return n;
};
