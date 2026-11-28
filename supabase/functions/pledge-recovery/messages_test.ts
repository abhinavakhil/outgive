import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";
import { type Due, message } from "./messages.ts";
import { drain, type Provider, send } from "../_shared/notify/index.ts";

const T = "ab".repeat(32);
const r: Due = { id: "1", action: "reminder", channel: "sms", donor_name: "Aisha Khan", donor_email: "aisha@example.com", donor_phone: "+12125550102", event: "Night 27 dinner", amount_cents: 250000, paid_cents: 100000, currency: "USD", due_date: "2027-03-20", pay_token: T, org_name: "Clearwell" };

Deno.test("recovery messages carry the balance and the one-tap link", () => {
    const sms = message(r, "https://outgive.tech")!;
    assertEquals(sms.channel, "sms"); assertEquals(sms.to, "+12125550102");
    assertMatch(sms.body, /\$1,500 .*March 20.*https:\/\/outgive\.tech\/pledge\/abab.*STOP/);
    const split = message({ ...r, action: "split_offer", channel: "email" }, "https://outgive.tech")!;
    assertEquals(split.to, "aisha@example.com"); assert(split.subject);
    assertMatch(split.body, /\$500\. .*\?split=3/s);
});

Deno.test("no message without an address, for a paid pledge, or for a task", () => {
    assertEquals(message({ ...r, donor_phone: null }, "x"), null);
    assertEquals(message({ ...r, paid_cents: 250000 }, "x"), null);
    assertEquals(message({ ...r, channel: "task", action: "call_list" }, "x"), null);
});

Deno.test("notify: picks the first ready provider; drain marks sent, skipped and failed", async () => {
    const sent: string[] = [];
    const ok: Provider = { id: "fake", channels: ["sms"], ready: () => true, send: (m) => { sent.push(m.to); return Promise.resolve({ ok: true, provider: "fake" }); } };
    const bad: Provider = { id: "bad", channels: ["email"], ready: () => true, send: () => Promise.reject(new Error("down")) };
    assertEquals((await send({ to: "nope", channel: "sms", body: "x" }, [ok])).provider, "none");
    const marks: Record<string, string> = {};
    const n = await drain([{ id: "a", ch: "sms" }, { id: "b", ch: "email" }, { id: "c", ch: "none" }],
        (x) => (x.ch === "none" ? null : { to: x.ch === "sms" ? "+12125550100" : "a@b.co", channel: x.ch as "sms" | "email", body: "hi" }),
        (id, m) => { marks[id] = `${m.status}:${m.provider}`; return Promise.resolve(); }, [ok, bad]);
    assertEquals(n, { sent: 1, failed: 1, skipped: 1 });
    assertEquals(marks, { a: "sent:fake", b: "failed:bad", c: "skipped:null" });
    assertEquals(sent, ["+12125550100"]);
});
