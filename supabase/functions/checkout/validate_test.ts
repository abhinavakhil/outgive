import { assertEquals, assertMatch } from "jsr:@std/assert@1";
import { validate } from "./validate.ts";

const ok = { page_id: "p", amount_cents: 2500, currency: "gbp" };
Deno.test("checkout input validation", () => {
    assertEquals(validate(ok), null);
    assertMatch(validate({ amount_cents: 2500, currency: "GBP" })!, /org_id or page_id/);
    assertMatch(validate({ ...ok, amount_cents: 50 })!, /minimum/);
    assertMatch(validate({ ...ok, amount_cents: 25.5 })!, /minimum/);
    assertMatch(validate({ ...ok, currency: "pounds" })!, /currency/);
    assertMatch(validate({ ...ok, tip_pct: 7 })!, /tip_pct/);
    assertMatch(validate({ ...ok, donor_email: "not-an-email" })!, /email/);
    assertMatch(validate({ ...ok, recurring: true, ticket_type_id: "t" })!, /Tickets/);
    assertMatch(validate({ ...ok, message: "x".repeat(501) })!, /too long/);
});
