// Twilio's inbound SMS webhook (the Outgive number's "A message comes in" URL, HTTP POST). Every request is checked against
// X-Twilio-Signature with TWILIO_AUTH_TOKEN over the public URL (SMS_INBOUND_URL, else <SUPABASE_URL>/functions/v1/sms-inbound).
//   STOP words  → sms_opt(stop): pledge reminders paused, SMS suppressed; no reply (Twilio sends the carrier opt-out confirmation itself).
//   START words → sms_opt(start) and our own confirmation.   HELP → who we are, how to opt out.
//   "IFTAR 50"  → the keyword's charity, a one-tap give link with $50 and the fund filled in. No carrier billing.
// Answers with TwiML. verify_jwt is off for this function (supabase/config.toml): Twilio has no Supabase token; the signature is the check.
import { admin, env, SITE_URL } from "../_shared/deps.ts";
import { giveReply, HELP_REPLY, type KeywordRow, parse, START_REPLY, twiml, UNKNOWN_REPLY, validSignature } from "./logic.ts";

const xml = (text?: string, status = 200) => new Response(twiml(text), { status, headers: { "Content-Type": "text/xml" } });

Deno.serve(async (req) => {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
    const params = Object.fromEntries(new URLSearchParams(await req.text())) as Record<string, string>;
    const url = Deno.env.get("SMS_INBOUND_URL") ?? `${env("SUPABASE_URL")}/functions/v1/sms-inbound`;
    if (!(await validSignature(env("TWILIO_AUTH_TOKEN"), url, params, req.headers.get("X-Twilio-Signature")))) return new Response("Bad signature", { status: 403 });

    const db = admin(), from = params.From ?? "", m = parse(params.Body ?? "");
    try {
        if (m.kind === "stop" || m.kind === "start") {
            const { error } = await db.rpc("sms_opt", { raw_phone: from, stop: m.kind === "stop" });
            if (error) console.error("sms_opt", error.message);
            return xml(m.kind === "start" ? START_REPLY : undefined);
        }
        if (m.kind === "help") return xml(HELP_REPLY);
        if (m.kind === "unknown") return xml(UNKNOWN_REPLY);
        const { data, error } = await db.rpc("sms_keyword_find", { kw: m.keyword });
        if (error) throw new Error(error.message);
        const k = (data as KeywordRow[] | null)?.[0];
        return xml(k ? giveReply(SITE_URL(), k, m.amount) : UNKNOWN_REPLY);
    } catch (e) {
        console.error("sms-inbound", (e as Error).message);
        // Twilio retries nothing on a 200; say sorry rather than leave the donor waiting.
        return xml("Outgive: something went wrong on our side. Please try again in a minute.");
    }
});
