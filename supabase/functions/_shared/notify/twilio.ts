// Twilio SMS for notify: ready when TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM are set. TWILIO_FROM is the Outgive
// number in E.164 (+1...) or a Messaging Service SID (MG...), which US A2P 10DLC traffic should use. Without them the console provider
// stays in charge of SMS (logs, sends nothing).
import type { Provider } from "./index.ts";

export const twilio: Provider = {
    id: "twilio", channels: ["sms"],
    ready: () => !!(Deno.env.get("TWILIO_ACCOUNT_SID") && Deno.env.get("TWILIO_AUTH_TOKEN") && Deno.env.get("TWILIO_FROM")),
    send: async (m) => {
        const sid = Deno.env.get("TWILIO_ACCOUNT_SID")!, from = Deno.env.get("TWILIO_FROM")!;
        const form = new URLSearchParams({ To: m.to, Body: m.body, ...(from.startsWith("MG") ? { MessagingServiceSid: from } : { From: from }) });
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
            method: "POST", body: form,
            headers: { Authorization: `Basic ${btoa(`${sid}:${Deno.env.get("TWILIO_AUTH_TOKEN")}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
        });
        const out = (await res.json().catch(() => ({}))) as { sid?: string; code?: number; message?: string };
        // 21610: the number replied STOP. Twilio refuses to send until they reply START.
        if (!res.ok) return { ok: false, provider: "twilio", error: `${res.status} ${out.code ?? ""} ${(out.message ?? "").slice(0, 300)}`.trim() };
        return { ok: true, provider: "twilio", id: out.sid };
    },
};
