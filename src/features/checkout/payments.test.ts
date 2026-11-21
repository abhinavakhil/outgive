// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { type PayOrder, type PayResult, STILL_CONFIRMING, createAttempts, demoPayments, hostPayments, livePayments, mapError, methodOf, settle, takePayment } from "./payments";

const order = (over: Partial<PayOrder> = {}): PayOrder => ({
    campaignId: "f/marsh-lane", layout: "hero", currency: "GBP", amount: 25, freq: "once", total: 28.58, recur: 25.58, giftAid: 0, match: 0, receives: 28,
    extras: ["cover", "meal"], method: "card", paidWith: "Card", donor: { first: "Ada", last: "Byron", email: "Ada@example.test", anonymous: false, updates: false }, ...over,
});
const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };
const counter = () => { let n = 0; return () => `key-${++n}`; };
/** A clock that only moves when something sleeps. */
const clock = () => { let t = 0; const slept: number[] = []; return { slept, now: () => t, sleep: async (ms: number) => { slept.push(ms); t += ms; } }; };
const ok: PayResult = { status: "succeeded", id: "p1" };
const fail = (raw: unknown): PayResult => ({ status: "failed", id: "p1", error: mapError(raw) });

describe("attempt keys", () => {
    it("reuses the key while the attempt is open, so a retry cannot charge twice", () => {
        const a = createAttempts(memory(), counter());
        expect(a.keyFor(order())).toBe("key-1");
        expect(a.keyFor(order())).toBe("key-1");
        a.finish(fail({ message: "Failed to fetch" })); // dropped connection: we do not know what happened
        a.finish(fail({ code: "authentication_required" }));
        a.finish({ status: "processing", id: "p1", message: STILL_CONFIRMING }); // timed out waiting: still the same attempt
        a.finish({ status: "requires_action", id: "p1" });
        expect(a.keyFor(order())).toBe("key-1");
    });
    it("starts a new attempt after a definitive failure, a success, or a debit that is on its way", () => {
        const a = createAttempts(memory(), counter());
        expect(a.keyFor(order())).toBe("key-1");
        a.finish(fail({ code: "card_declined" }));
        expect(a.keyFor(order())).toBe("key-2");
        a.finish(ok);
        expect(a.keyFor(order())).toBe("key-3");
        a.finish({ status: "processing", id: "p1", delayed: true });
        expect(a.keyFor(order())).toBe("key-4");
    });
    it("starts a new attempt when the method, the money or the donor changes", () => {
        const a = createAttempts(memory(), counter());
        expect(a.keyFor(order())).toBe("key-1");
        expect(a.keyFor(order({ method: "bank", paidWith: "Pay by bank" }))).toBe("key-2");
        expect(a.keyFor(order({ paidWith: "PayPal" }))).toBe("key-3"); // express button, same selected method
        expect(a.keyFor(order({ total: 30, recur: 30 }))).toBe("key-4");
        expect(a.keyFor(order({ donor: { ...order().donor, email: "someone@else.test" } }))).toBe("key-5");
    });
    it("survives a reload: the open attempt comes back from storage, a finished one does not", () => {
        const store = memory();
        expect(createAttempts(store, counter()).keyFor(order())).toBe("key-1");
        const again = createAttempts(store, () => "other");
        expect(again.keyFor(order())).toBe("key-1");
        again.finish(ok);
        expect(createAttempts(store, () => "fresh").keyFor(order())).toBe("fresh");
    });
    it("works without storage", () => { expect(createAttempts(null, counter()).keyFor(order())).toBe("key-1"); });
});

describe("error mapping", () => {
    it.each([
        [{ type: "card_error", code: "card_declined", decline_code: "generic_decline" }, "card_declined", false, true],
        [{ type: "card_error", code: "card_declined", decline_code: "insufficient_funds" }, "insufficient_funds", false, true],
        [{ type: "card_error", code: "expired_card" }, "expired_card", false, true],
        [{ type: "card_error", code: "incorrect_cvc" }, "card_declined", false, true],
        [{ code: "authentication_required" }, "authentication_required", true, false],
        [{ code: "payment_intent_authentication_failure" }, "authentication_required", true, false],
        [new TypeError("Failed to fetch"), "network", true, false],
        [new Error("Failed to send a request to the Edge Function"), "network", true, false],
        [{ type: "api_connection_error" }, "network", true, false],
        [{ code: "not_configured", message: "PayPal is not set up yet. Choose another way to pay." }, "not_configured", false, true],
        [new Error("boom"), "unknown", true, false],
        [undefined, "unknown", true, false],
    ])("%o → %s", (raw, code, retryable, suggestAlternative) => {
        const e = mapError(raw);
        expect([e.code, e.retryable, e.suggestAlternative]).toEqual([code, retryable, suggestAlternative]);
        expect(e.message.length).toBeGreaterThan(3);
    });
    it("speaks to the donor: its own words for known codes, the server's for the rest", () => {
        expect(mapError({ code: "card_declined", message: "Your card was declined. (req_123)" }).message).toMatch(/nothing was taken/);
        expect(mapError({ code: "not_configured", message: "PayPal is not set up yet." }).message).toBe("PayPal is not set up yet.");
        expect(mapError(new Error("This page is not taking gifts at the moment")).message).toBe("This page is not taking gifts at the moment");
        expect(mapError(new Error("x".repeat(400))).message).toMatch(/didn’t go through/);
    });
    it("a cancelled payment is over: not retryable", () => { expect(mapError({ code: "canceled" })).toMatchObject({ code: "unknown", retryable: false }); });
});

describe("settle (polling)", () => {
    const seq = (...rs: (PayResult | Error)[]) => { let i = 0; return { status: vi.fn(async () => { const r = rs[Math.min(i++, rs.length - 1)]; if (r instanceof Error) throw r; return r; }) }; };
    const busy: PayResult = { status: "processing", id: "p1" };
    it("polls until the server says succeeded", async () => {
        const c = clock(), p = seq(busy, busy, ok);
        expect(await settle(p, "p1", c)).toEqual(ok);
        expect(p.status).toHaveBeenCalledTimes(3);
        expect(c.slept).toEqual([1500, 1500]);
    });
    it("stops on a failure, and on a debit that will take days", async () => {
        expect((await settle(seq(busy, fail({ code: "card_declined" })), "p1", clock())).error?.code).toBe("card_declined");
        const p = seq({ status: "processing", id: "p1", delayed: true });
        expect(await settle(p, "p1", clock())).toMatchObject({ status: "processing", delayed: true });
        expect(p.status).toHaveBeenCalledTimes(1);
    });
    it("keeps polling through a dropped connection", async () => {
        expect(await settle(seq(new TypeError("Failed to fetch"), fail(new TypeError("Failed to fetch")), ok), "p1", clock())).toEqual(ok);
    });
    it("times out as processing with a message, never as a success or a failure", async () => {
        const c = clock(), p = seq(busy);
        expect(await settle(p, "p1", { ...c, interval: 1000, timeout: 5000 })).toEqual({ status: "processing", id: "p1", message: STILL_CONFIRMING });
        expect(p.status).toHaveBeenCalledTimes(6);
        expect(c.now()).toBe(5000);
        expect(await settle(seq(new TypeError("Failed to fetch")), "p1", { ...clock(), timeout: 3000 })).toMatchObject({ status: "processing" });
    });
});

describe("demo provider", () => {
    const run = (o: PayOrder, key = "k1", c = clock(), record = vi.fn()) => { const p = demoPayments({ record, sleep: c.sleep }); const onAuth = vi.fn(() => c.slept.length); return { p, c, record, onAuth, result: takePayment(p, o, key, onAuth, c) }; };
    it("pays with the animation's timing and records the gift once, without the card", async () => {
        const t = run(order({ demoCard: "4242 4242 4242 4242" }));
        expect(await t.result).toEqual({ status: "succeeded", id: "demo_k1" });
        expect(t.c.slept).toEqual([1400, 1450]);
        expect(t.onAuth).toHaveReturnedWith(1); // authorised after the first beat
        expect(t.record).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(t.record.mock.calls[0][0])).not.toMatch(/4242|demoCard/);
        // The same attempt again: paid already, nothing recorded twice.
        expect(await takePayment(t.p, order(), "k1", undefined, t.c)).toEqual({ status: "succeeded", id: "demo_k1" });
        expect(t.record).toHaveBeenCalledTimes(1);
    });
    it("declines Stripe's test cards deterministically", async () => {
        const declined = run(order({ demoCard: "4000000000000002" }));
        expect((await declined.result).error).toMatchObject({ code: "card_declined", retryable: false, suggestAlternative: true });
        expect(declined.c.slept).toEqual([1400]);
        expect(declined.record).not.toHaveBeenCalled();
        expect(declined.onAuth).not.toHaveBeenCalled();
        expect((await run(order({ demoCard: "4000 0000 0000 9995" })).result).error?.code).toBe("insufficient_funds");
    });
    it("asks for authentication on 4000 0025 0000 3155, then pays", async () => {
        const c = clock(), record = vi.fn(), p = demoPayments({ record, sleep: c.sleep }), o = order({ demoCard: "4000002500003155" });
        const first = await p.start(o, "k1");
        expect(first.status).toBe("requires_action");
        expect((await p.status(first.id)).status).toBe("requires_action");
        expect(record).not.toHaveBeenCalled();
        expect(await takePayment(p, o, "k1", undefined, c)).toEqual({ status: "succeeded", id: "demo_k1" });
        expect(record).toHaveBeenCalledTimes(1);
    });
    it("ignores a leftover card number when paying another way", async () => {
        expect((await run(order({ demoCard: "4000000000000002", paidWith: "Apple Pay" })).result).status).toBe("succeeded");
    });
    it("leaves Direct Debit and pay by bank processing, not paid", async () => {
        for (const method of ["dd", "bank"] as const) {
            const t = run(order({ method, paidWith: method }));
            expect(await t.result).toEqual({ status: "processing", id: "demo_k1", delayed: true });
            expect(t.record).not.toHaveBeenCalled();
            expect(t.onAuth).toHaveBeenCalledTimes(1);
        }
    });
});

describe("live provider", () => {
    vi.stubGlobal("window", { location: { href: "https://outgive.test/checkout?campaign=f/x", origin: "https://outgive.test", pathname: "/checkout", search: "?campaign=f/x" } });
    const ID = "00000000-0000-4000-8000-000000000001";
    it("sends the money split and the attempt key, and never the card", async () => {
        const fn = vi.fn(async () => ({ status: "requires_action", id: ID, clientSecret: "pi_1_secret_x" }));
        const p = livePayments(fn as never, { page_id: "page-1" }, () => null);
        expect(await p.start(order({ demoCard: "4000000000000002" }), "attempt-key-0000000001")).toMatchObject({ status: "requires_action", clientSecret: "pi_1_secret_x" });
        const [name, body] = fn.mock.calls[0] as unknown as [string, Record<string, unknown>];
        expect(name).toBe("pay");
        expect(body).toMatchObject({ action: "start", attempt_key: "attempt-key-0000000001", page_id: "page-1", method: "card", freq: "once", currency: "GBP", amount_cents: 2500, extras_cents: 300, cover_cents: 58, donor_name: "Ada Byron", donor_email: "Ada@example.test", return_to: "/checkout?campaign=f/x" });
        expect(JSON.stringify(body)).not.toMatch(/4000|demoCard/);
    });
    it("confirms with Stripe's fields, then trusts only the server's status", async () => {
        const answers: unknown[] = [{ status: "requires_action", id: ID, clientSecret: "pi_1_secret_x" }, { status: "processing", id: ID }, { status: "succeeded", id: ID }];
        const fn = vi.fn(async () => answers.shift());
        const confirm = vi.fn(async () => ({}));
        const onAuth = vi.fn();
        expect(await takePayment(livePayments(fn as never, {}, () => ({ confirm })), order(), "k", onAuth, clock())).toMatchObject({ status: "succeeded", id: ID });
        expect(confirm).toHaveBeenCalledWith("pi_1_secret_x", `https://outgive.test/checkout?campaign=f%2Fx&ck_pay=${ID}`);
        expect(onAuth).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledTimes(3);
    });
    it("a decline at confirmation is a failure with a code; the server is not asked", async () => {
        const fn = vi.fn(async () => ({ status: "requires_action", id: ID, clientSecret: "s" }));
        const r = await takePayment(livePayments(fn as never, {}, () => ({ confirm: async () => ({ error: { type: "card_error", code: "card_declined", decline_code: "insufficient_funds" } }) })), order(), "k");
        expect(r).toMatchObject({ status: "failed", id: ID, error: { code: "insufficient_funds", suggestAlternative: true } });
        expect(fn).toHaveBeenCalledTimes(1);
    });
    it("a server refusal and a dropped connection are results, not exceptions", async () => {
        const refused = livePayments((async () => ({ status: "failed", id: "", error: { code: "not_configured", message: "PayPal is not set up yet. Choose another way to pay." } })) as never, {}, () => null);
        expect((await refused.start(order({ paidWith: "PayPal" }), "k")).error).toMatchObject({ code: "not_configured", retryable: false, suggestAlternative: true });
        const offline = livePayments((async () => { throw new TypeError("Failed to fetch"); }) as never, {}, () => null);
        expect(await offline.start(order(), "k")).toMatchObject({ status: "failed", id: "", error: { code: "network", retryable: true } });
        expect((await offline.status(ID)).error?.code).toBe("network");
    });
    it("sends the donor to PayPal for approval", async () => {
        const redirect = vi.fn();
        const p = livePayments((async () => ({ status: "requires_action", id: ID, redirectUrl: "https://paypal.test/approve" })) as never, {}, () => null, redirect);
        void p.confirm(await p.start(order({ paidWith: "PayPal" }), "k"));
        expect(redirect).toHaveBeenCalledWith("https://paypal.test/approve");
    });
    it("names the method the server knows", () => {
        expect(methodOf({ method: "card", paidWith: "PayPal" })).toBe("paypal");
        expect(methodOf({ method: "apple", paidWith: "Apple Pay" })).toBe("wallet");
        expect(methodOf({ method: "card", paidWith: "Google Pay" })).toBe("wallet");
        expect(methodOf({ method: "dd", paidWith: "Direct Debit" })).toBe("dd");
    });
});

describe("a host's onPay as a provider", () => {
    it("pays once per attempt, and never passes the demo card on", async () => {
        const onPay = vi.fn(async () => {}), p = hostPayments(onPay);
        expect((await takePayment(p, order({ demoCard: "4242424242424242" }), "k1")).status).toBe("succeeded");
        expect((await takePayment(p, order(), "k1")).status).toBe("succeeded"); // the same attempt again
        expect(onPay).toHaveBeenCalledTimes(1);
        expect(onPay.mock.calls[0]).toEqual([order()]);
    });
    it("turns a thrown error into a failure with the host's words, which can be tried again", async () => {
        const p = hostPayments(async () => { throw new Error("Your bank said no."); });
        const r = await takePayment(p, order(), "k1");
        expect(r).toMatchObject({ status: "failed", error: { message: "Your bank said no.", retryable: true } });
    });
});
