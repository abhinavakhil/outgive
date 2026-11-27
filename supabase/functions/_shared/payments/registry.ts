// Every payment provider Outgive can use. To add one (GoCardless for Direct Debit, Mollie, Square...): write a module implementing
// Provider (types.ts), add it to this list, and let charities connect it (a payment_accounts row). To remove one, delete it from the list.
// Per charity, a provider is switched off with payment_accounts.enabled, and a way to pay with orgs.pay_methods.
import type { PayMethod } from "../../pay/logic.ts";
import type { Account, Provider } from "./types.ts";
import { stripeProvider } from "./stripe.ts";
import { paypalProvider } from "./paypal.ts";

export const PROVIDERS: Provider[] = [stripeProvider, paypalProvider];

export const provider = (id: string, list = PROVIDERS) => list.find((p) => p.id === id) ?? null;

export type Route = { provider: Provider; account: Account } | { error: "not_offered" | "not_ready" | "no_recurring" };

/**
 * Which provider takes this gift: the charity's enabled, ready account (lowest priority first) whose provider is configured
 * and can take the method (and repeat it, for a regular gift).
 */
export const route = (accounts: Account[], method: PayMethod, recurring: boolean, list = PROVIDERS): Route => {
    const can = accounts
        .filter((a) => a.enabled)
        .map((a) => ({ account: a, provider: provider(a.provider, list) }))
        .filter((x): x is { account: Account; provider: Provider } => !!x.provider && x.provider.configured() && x.provider.capabilities.methods.includes(method))
        .sort((a, b) => a.account.priority - b.account.priority);
    if (!can.length) return { error: "not_offered" };
    const ready = can.filter((x) => x.account.charges_enabled);
    if (!ready.length) return { error: "not_ready" };
    const fits = recurring ? ready.filter((x) => x.provider.capabilities.recurring) : ready;
    return fits[0] ?? { error: "no_recurring" };
};

/** The ways to pay a charity can offer right now, for the checkout to show. */
export const methodsFor = (accounts: Account[], list = PROVIDERS): PayMethod[] =>
    [...new Set(accounts.filter((a) => a.enabled && a.charges_enabled).flatMap((a) => { const p = provider(a.provider, list); return p?.configured() ? p.capabilities.methods : []; }))];
