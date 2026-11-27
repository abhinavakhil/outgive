// The payment service's contract. Every provider (Stripe, PayPal, later GoCardless, Mollie...) is one module that implements Provider
// and is listed in registry.ts. The pay function never talks to a provider directly: it picks one with route() and calls start / status.
// Money rule: the charity is always the payee. A charity with no account of its own gets a Stripe account Outgive creates and onboards
// (connect function), so Outgive never holds donors' money (FCA: holding funds for payees needs authorisation).
import type { PayMethod, PayOut, StartInput } from "../../pay/logic.ts";

/** A charity's connection to one provider: a row of payment_accounts. */
export interface Account {
    provider: string;
    /** The provider's id for the charity: a Stripe acct_..., a PayPal merchant id, a GoCardless organisation id. */
    external_id: string;
    /** Can take payments now (onboarding finished, not restricted). */
    charges_enabled: boolean;
    enabled: boolean;
    /** Lower goes first when two providers can take the same method. */
    priority: number;
}

export interface Capabilities {
    methods: PayMethod[];
    recurring: boolean;
    /** Can charge a saved method later without the donor (nightly Ramadan gifts). */
    offSession: boolean;
    platformFee: boolean;
    refunds: boolean;
}

/** One gift attempt, already validated and with its pending donation row made. */
export interface StartCtx {
    input: StartInput;
    donationId: string;
    account: Account;
    org: { id: string; name: string; platform_fee_bps: number };
    /** What the charge says on the donor's statement and receipts. */
    title: string;
    /** gift: credited to the charity. cover: the donor-paid fee. tip: to Outgive. today: charged now. recur: each later charge. */
    amounts: { gift: number; cover: number; tip: number; today: number; recur: number; platformFee: number };
    /** Writes provider references onto the donation row. */
    save: (patch: Record<string, unknown>) => Promise<void>;
    /** The row as it stands, for a retried attempt that already has a provider reference. */
    row: Record<string, unknown>;
}

export interface StatusCtx { donationId: string; row: Record<string, unknown> }

export interface Provider {
    id: string;
    capabilities: Capabilities;
    /** False when the platform's own keys for this provider are not set, so it is skipped everywhere. */
    configured: () => boolean;
    start: (ctx: StartCtx) => Promise<PayOut>;
    /** Asks the provider how the payment ended. "succeeded" here is what marks the donation paid (with the webhook). */
    status: (ctx: StatusCtx) => Promise<PayOut>;
}
