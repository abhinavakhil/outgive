import { assertEquals } from "jsr:@std/assert@1";
import { methodsFor, route } from "./registry.ts";
import type { Account, Provider } from "./types.ts";

const fake = (id: string, methods: Provider["capabilities"]["methods"], recurring = true, configured = true): Provider => ({
    id, configured: () => configured, capabilities: { methods, recurring, offSession: recurring, platformFee: true, refunds: true },
    start: () => Promise.resolve({ status: "succeeded", id: "" }), status: () => Promise.resolve({ status: "succeeded", id: "" }),
});
const LIST = [fake("stripe", ["card", "wallet", "dd"]), fake("paypal", ["paypal"], false), fake("gocardless", ["dd"]), fake("off", ["card"], true, false)];
const acct = (provider: string, p: Partial<Account> = {}): Account => ({ provider, external_id: `${provider}_1`, charges_enabled: true, enabled: true, priority: 0, ...p });
const pick = (r: ReturnType<typeof route>) => ("error" in r ? r.error : r.provider.id);

Deno.test("routes each method to the provider that takes it", () => {
    const a = [acct("stripe"), acct("paypal")];
    assertEquals(pick(route(a, "card", false, LIST)), "stripe");
    assertEquals(pick(route(a, "paypal", false, LIST)), "paypal");
    assertEquals(pick(route(a, "bank", false, LIST)), "not_offered");
});

Deno.test("priority decides between two providers for the same method", () => {
    assertEquals(pick(route([acct("stripe", { priority: 2 }), acct("gocardless", { priority: 1 })], "dd", false, LIST)), "gocardless");
});

Deno.test("skips disabled accounts, unconfigured providers and unfinished onboarding", () => {
    assertEquals(pick(route([acct("stripe", { enabled: false })], "card", false, LIST)), "not_offered");
    assertEquals(pick(route([acct("off")], "card", false, LIST)), "not_offered");
    assertEquals(pick(route([acct("stripe", { charges_enabled: false })], "card", false, LIST)), "not_ready");
});

Deno.test("regular gifts need a provider that can repeat them", () => {
    assertEquals(pick(route([acct("paypal")], "paypal", true, LIST)), "no_recurring");
});

Deno.test("methodsFor lists what a charity can take now", () => {
    assertEquals(methodsFor([acct("stripe"), acct("paypal", { charges_enabled: false })], LIST), ["card", "wallet", "dd"]);
});
