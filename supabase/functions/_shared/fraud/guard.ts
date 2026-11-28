// The pay function's gate, run before any charge is started: the charity must be able to take payments (a US charity needs a verified
// EIN), then the card-testing rules (rules.ts) against this IP's and card's last hour. Every attempt, challenge and block is logged
// in fraud_events; declines are logged by a donations trigger. Returns null to go ahead, or the PayOut to send back instead.
// Challenge: Cloudflare Turnstile. The client renders the widget when it gets error.code "challenge_required" and sends the token
// back as challenge_token. Without TURNSTILE_SECRET a challenge cannot be passed, so it acts as a block.
import { admin } from "../deps.ts";
import type { PayOut, StartInput } from "../../pay/logic.ts";
import { DEFAULT_FRAUD, evaluate, type FraudEvent, type FraudSettings, REASON_TEXT } from "./rules.ts";

const sha256 = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))), (b) => b.toString(16).padStart(2, "0")).join("");
/** The caller's IP, hashed with FRAUD_SALT so the log never holds an address. */
export const ipHash = async (req: Request) => {
    const ip = (req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "").trim();
    return ip ? sha256(`${Deno.env.get("FRAUD_SALT") ?? "outgive"}:${ip}`) : null;
};

const turnstile = async (token: string, req: Request) => {
    const secret = Deno.env.get("TURNSTILE_SECRET"); if (!secret) return false;
    const form = new FormData(); form.set("secret", secret); form.set("response", token);
    const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]; if (ip) form.set("remoteip", ip.trim());
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form }).then((x) => x.json()).catch(() => null) as { success?: boolean } | null;
    return !!r?.success;
};

/** `card_fp` is the card's fingerprint when the caller knows it (a saved card); the in-page checkout does not, and Radar covers that. */
export const guard = async (req: Request, b: StartInput & { challenge_token?: string; card_fp?: string }): Promise<PayOut | null> => {
    const db = admin();
    const pageOrg = b.page_id ? (await db.from("pages").select("org_id").eq("id", b.page_id).maybeSingle()).data?.org_id : null;
    const pledgeOrg = b.pledge_token ? (await db.from("pledges").select("org_id").eq("pay_token", b.pledge_token).maybeSingle()).data?.org_id : null;
    const org = (pageOrg ?? pledgeOrg ?? b.org_id) as string | undefined;
    if (!org) return null; // the pay function answers "not found" itself
    const { data: ready } = await db.rpc("org_payments_ready", { org });
    if (ready === false) return { status: "failed", id: "", error: { code: "not_configured", message: "This charity is still being verified and cannot take gifts yet." } };

    const { data: s } = await db.rpc("fraud_settings_get", { org });
    const settings: FraudSettings = { ...DEFAULT_FRAUD, ...(s ?? {}) };
    const ip = await ipHash(req), card = b.card_fp ?? null, since = new Date(Date.now() - 3600_000).toISOString();
    const or = [ip && `ip_hash.eq.${ip}`, card && `card_fp.eq.${card.replace(/[^A-Za-z0-9_]/g, "")}`].filter(Boolean).join(",");
    const recent = or ? ((await db.from("fraud_events").select("kind, at, attempt_key, ip_hash, card_fp").or(or).gte("at", since).limit(500)).data ?? []) as FraudEvent[] : [];
    const amount = b.amount_cents + (b.extras_cents ?? 0);
    const attempt = { amount_cents: amount, email: b.donor_email, ip_hash: ip, card_fp: card, attempt_key: b.attempt_key, now: new Date() };
    let v = evaluate(settings, attempt, recent);
    if (v.action === "challenge" && b.challenge_token) v = evaluate(settings, attempt, recent, await turnstile(b.challenge_token, req));

    const log = (kind: FraudEvent["kind"], reason: string | null = null) => db.from("fraud_events").insert({ org_id: org, kind, reason, attempt_key: b.attempt_key, ip_hash: ip, card_fp: card, email_domain: b.donor_email?.split("@")[1]?.toLowerCase() ?? null, amount_cents: amount });
    if (v.action === "allow") { await log("attempt"); return null; }
    if (v.action === "challenge") { await log("challenge"); return { status: "failed", id: "", error: { code: "challenge_required", message: "Please confirm you are not a robot, then try again." } }; }
    await log("block", v.reason);
    return { status: "failed", id: "", error: { code: v.reason === "below_minimum" ? "amount_too_small" : "blocked", decline_code: v.reason, message: REASON_TEXT[v.reason] } };
};
