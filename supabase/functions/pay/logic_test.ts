import { assertEquals, assertMatch } from "jsr:@std/assert@1";
import { fromIntent, fromPayPal, type StartInput, totals, validate } from "./logic.ts";

const ok: StartInput = { action: "start", attempt_key: "a".repeat(32), page_id: "p", method: "card", amount_cents: 2500, currency: "gbp" };
const ID = "00000000-0000-4000-8000-000000000001";

Deno.test("pay input validation", () => {
    assertEquals(validate(ok), null);
    assertEquals(validate({ action: "status", id: ID }), null);
    assertMatch(validate({ action: "status", id: "" })!, /id/);
    assertMatch(validate({ ...ok, attempt_key: "short" })!, /attempt_key/);
    assertMatch(validate({ ...ok, page_id: undefined })!, /org_id or page_id/);
    assertMatch(validate({ ...ok, method: "cheque" as "card" })!, /method/);
    assertMatch(validate({ ...ok, amount_cents: 50 })!, /minimum/);
    assertMatch(validate({ ...ok, cover_cents: -1 })!, /cover_cents/);
    assertMatch(validate({ ...ok, amount_cents: 99_999_900, extras_cents: 1 })!, /limit/);
});

Deno.test("totals: extras are charged once, the covered fee every time", () => {
    assertEquals(totals({ amount_cents: 2500, extras_cents: 300, cover_cents: 58 }), { gift: 2800, cover: 58, tip: 0, today: 2858, recur: 2558 });
});

Deno.test("a PaymentIntent maps to the checkout's four states", () => {
    assertEquals(fromIntent({ status: "succeeded" }, "card", ID, false), { status: "succeeded", id: ID });
    // Card processing is a moment; Bacs and pay by bank take days.
    assertEquals(fromIntent({ status: "processing" }, "card", ID, false).delayed, false);
    assertEquals(fromIntent({ status: "processing" }, "dd", ID, false), { status: "processing", id: ID, delayed: true });
    assertEquals(fromIntent({ status: "processing" }, "bank", ID, false).delayed, true);
    assertEquals(fromIntent({ status: "requires_action", client_secret: "pi_1_secret_x" }, "card", ID, false), { status: "requires_action", id: ID, clientSecret: "pi_1_secret_x" });
    assertEquals(fromIntent({ status: "canceled" }, "card", ID, false).status, "failed");
    const declined = { status: "requires_payment_method", client_secret: "s", last_payment_error: { code: "card_declined", decline_code: "insufficient_funds" } };
    // Polling reports the refusal; starting the same attempt again hands the intent back to be confirmed with another card.
    assertEquals(fromIntent(declined, "card", ID, false), { status: "failed", id: ID, error: { code: "card_declined", decline_code: "insufficient_funds" } });
    assertEquals(fromIntent(declined, "card", ID, true), { status: "requires_action", id: ID, clientSecret: "s" });
});

Deno.test("a PayPal order: approve, capture, done", () => {
    assertEquals(fromPayPal({ id: "O", status: "PAYER_ACTION_REQUIRED", links: [{ rel: "payer-action", href: "https://paypal.test/approve" }] }, ID), { status: "requires_action", id: ID, redirectUrl: "https://paypal.test/approve" });
    assertEquals(fromPayPal({ id: "O", status: "APPROVED" }, ID).capture, true);
    assertEquals(fromPayPal({ id: "O", status: "COMPLETED", purchase_units: [{ payments: { captures: [{ status: "COMPLETED" }] } }] }, ID), { status: "succeeded", id: ID });
    assertEquals(fromPayPal({ id: "O", status: "COMPLETED", purchase_units: [{ payments: { captures: [{ status: "PENDING" }] } }] }, ID).status, "processing");
    assertEquals(fromPayPal({ details: [{ issue: "INSTRUMENT_DECLINED" }] }, ID).error?.code, "card_declined");
    assertEquals(fromPayPal({}, ID).status, "failed");
});

Deno.test("a tip is charged today but never repeats", () => {
    assertEquals(totals({ amount_cents: 2500, cover_cents: 50, tip_cents: 250 }), { gift: 2500, cover: 50, tip: 250, today: 2800, recur: 2550 });
});

Deno.test("Gift Aid needs the donor's house and postcode", () => {
    const b = { action: "start", attempt_key: "k".repeat(20), org_id: "o", method: "card", currency: "GBP", amount_cents: 1000, gift_aid: true } as StartInput;
    assertEquals(validate(b), "Gift Aid needs a house name or number and a postcode");
    assertEquals(validate({ ...b, details: { house: "12", postcode: "E1 6AN" } }), null);
});
