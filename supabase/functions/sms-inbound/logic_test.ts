import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";
import { giveReply, keywordProblem, parse, twilioSignature, validSignature } from "./logic.ts";

Deno.test("parses opt-outs, help and keyword gifts", () => {
    assertEquals(parse(" stop "), { kind: "stop" });
    assertEquals(parse("Unsubscribe"), { kind: "stop" });
    assertEquals(parse("START"), { kind: "start" });
    assertEquals(parse("help"), { kind: "help" });
    assertEquals(parse("iftar 50"), { kind: "give", keyword: "IFTAR", amount: 50 });
    assertEquals(parse("IFTAR $1,250.50"), { kind: "give", keyword: "IFTAR", amount: 1250.5 });
    assertEquals(parse("Zakat"), { kind: "give", keyword: "ZAKAT", amount: null });
    assertEquals(parse("hello there friend"), { kind: "unknown" });
    assertEquals(keywordProblem("STOP") !== null, true);
});

Deno.test("reply links prefill amount and fund", () => {
    const k = { keyword: "IFTAR", org_slug: "hope-foundation", org_name: "Hope Foundation", fund: "general", amount_cents: 5000, appeal: "Iftar 1448" };
    assertMatch(giveReply("https://outgive.tech", k, 25), /Give \$25 to Iftar 1448 in one tap: https:\/\/outgive\.tech\/o\/hope-foundation\/checkout\?amount=25&fund=general/);
    assertMatch(giveReply("https://outgive.tech", k, null), /amount=50&/);
    assertMatch(giveReply("https://outgive.tech", k, 50000), /\$1 to \$10,000/);
});

Deno.test("Twilio signature round trip", async () => {
    const p = { From: "+12125550101", Body: "IFTAR 50" };
    const s = await twilioSignature("token", "https://x.supabase.co/functions/v1/sms-inbound", p);
    assert(await validSignature("token", "https://x.supabase.co/functions/v1/sms-inbound", p, s));
    assert(!(await validSignature("other", "https://x.supabase.co/functions/v1/sms-inbound", p, s)));
});
