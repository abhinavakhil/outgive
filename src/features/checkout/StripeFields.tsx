/**
 * Stripe's own payment fields (the Payment Element), for live payments. The card is typed into Stripe's iframes and never
 * touches our inputs or our server, which keeps the checkout in the lightest PCI scope (SAQ A). CardForm stays for the demo only.
 *
 * Stripe.js is loaded from https://js.stripe.com/v3 when the fields first mount: Stripe requires it to come from their domain
 * (it cannot be bundled), and loading it by hand saves an npm dependency that would only wrap this script tag.
 *
 * The intent is made after the donor presses pay ("deferred intent"): the fields mount with the amount alone, `submit()` checks
 * them, the pay function returns a client secret, and `confirm()` finishes the payment, 3-D Secure included.
 */
import { type Ref, useEffect, useImperativeHandle, useRef, useState } from "react";
import { type Confirmer, type PayError, mapError } from "./payments";

export const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

/** The slice of Stripe.js used here. */
interface StripeElement { mount: (el: HTMLElement) => void; destroy: () => void; on: (event: "change" | "loaderror", cb: (e: { complete?: boolean }) => void) => void }
interface StripeElements { create: (type: "payment", options?: Record<string, unknown>) => StripeElement; update: (options: Record<string, unknown>) => void; submit: () => Promise<{ error?: unknown }> }
interface StripeJs { elements: (options: Record<string, unknown>) => StripeElements; confirmPayment: (options: Record<string, unknown>) => Promise<{ error?: unknown }> }
type StripeFactory = (key: string) => StripeJs;

let loading: Promise<StripeFactory> | null = null;
const loadStripe = () => (loading ??= new Promise<StripeFactory>((resolve, reject) => {
    const have = () => (window as unknown as { Stripe?: StripeFactory }).Stripe;
    if (have()) return resolve(have()!);
    const s = document.createElement("script");
    s.src = "https://js.stripe.com/v3"; s.async = true;
    s.onload = () => (have() ? resolve(have()!) : reject(new Error("Network error loading the card form")));
    s.onerror = () => { loading = null; s.remove(); reject(new Error("Network error loading the card form")); };
    document.head.appendChild(s);
}));

/** Must match the pay function's PM_TYPES (supabase/functions/pay/logic.ts), or Stripe refuses the confirmation. */
const PM_TYPES = { card: ["card"], wallet: ["card"], dd: ["bacs_debit"], bank: ["pay_by_bank"] };

export interface StripeFieldsHandle extends Confirmer {
    /** Checks the fields before the payment starts; an error for the donor, or null when they are complete. Call it first thing in the pay click. */
    submit: () => Promise<PayError | null>;
}
export interface StripeFieldsProps {
    ref?: Ref<StripeFieldsHandle>;
    /** What is charged today, in major units (Order.total), and its currency. */
    total: number; currency: string;
    /** A regular gift (monthly, yearly): the payment method is saved for the next ones. */
    recurring?: boolean;
    method: keyof typeof PM_TYPES;
    /** The charity's connected account (org.stripe_account_id): the charge is made on its behalf, so the fields must say so too. */
    onBehalfOf?: string | null;
    /** True once every field is filled in. */
    onChange?: (complete: boolean) => void;
    /** Stripe Appearance API options, to match the checkout's look. */
    appearance?: Record<string, unknown>;
    publishableKey?: string;
}

export const StripeFields = ({ ref, total, currency, recurring, method, onBehalfOf, onChange, appearance, publishableKey = STRIPE_KEY }: StripeFieldsProps) => {
    const box = useRef<HTMLDivElement>(null);
    const live = useRef<{ stripe: StripeJs; elements: StripeElements } | null>(null);
    const changed = useRef(onChange); changed.current = onChange;
    const [problem, setProblem] = useState("");
    // Minor units, as Stripe counts them; the server does the same sum from the same order.
    const amount = Math.round(total * (/^(JPY|KRW|VND|CLP|ISK|HUF|TWD|UGX|XAF|XOF)$/i.test(currency) ? 1 : 100));
    const options = { mode: recurring ? "subscription" : "payment", amount, currency: currency.toLowerCase() };
    const latest = useRef(options); latest.current = options;

    useEffect(() => {
        let gone = false, el: StripeElement | null = null;
        setProblem("");
        if (!publishableKey) { setProblem("Card payments are not set up yet."); return; }
        loadStripe().then((Stripe) => {
            if (gone || !box.current) return;
            const stripe = Stripe(publishableKey);
            const elements = stripe.elements({ ...latest.current, paymentMethodTypes: PM_TYPES[method], ...(onBehalfOf ? { onBehalfOf } : {}), ...(appearance ? { appearance } : {}) });
            el = elements.create("payment");
            el.on("change", (e) => changed.current?.(!!e.complete));
            el.on("loaderror", () => setProblem(mapError({ code: "network" }).message));
            el.mount(box.current);
            live.current = { stripe, elements };
        }).catch((e) => { if (!gone) setProblem(mapError(e).message); });
        return () => { gone = true; live.current = null; el?.destroy(); changed.current?.(false); };
    }, [publishableKey, method, onBehalfOf]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { live.current?.elements.update(options); }, [options.mode, options.amount, options.currency]); // eslint-disable-line react-hooks/exhaustive-deps

    useImperativeHandle(ref, () => ({
        submit: async () => {
            if (!live.current) return mapError({ message: "The card form isn’t ready yet. Try again in a moment." });
            const { error } = await live.current.elements.submit();
            return error ? mapError(error) : null;
        },
        confirm: async (clientSecret, returnUrl) => {
            if (!live.current) return { error: { message: "The card form isn’t ready yet. Try again in a moment." } };
            // Cards finish in the page (3-D Secure opens in Stripe's own modal); only methods that need the bank's site redirect.
            return live.current.stripe.confirmPayment({ elements: live.current.elements, clientSecret, confirmParams: { return_url: returnUrl }, redirect: "if_required" });
        },
    }), []);

    return (
        <div className="w-full min-w-0">
            <div ref={box} />
            {problem && <p role="alert" className="text-sm">{problem}</p>}
        </div>
    );
};
