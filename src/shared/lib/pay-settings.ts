/** An organisation's payment set-up: Stripe Connect, PayPal and which ways to pay its checkout offers. Shared by the organiser admin and the dashboard. */
import { useEffect, useState } from "react";
import { useApp } from "@/shared/lib/app-context";
import { type Org, payConfigOf } from "@/shared/domain/types";

/** A PayPal merchant id (13 letters and digits) or the PayPal account's email. */
export const PAYPAL_ID = /^([A-Z0-9]{13}|[^\s@]+@[^\s@]+\.[^\s@]+)$/i;
export const METHOD_ROWS: [keyof Org["pay_methods"], string, string, "stripe" | "paypal"][] = [
    ["card", "Card", "Debit and credit cards, through Stripe", "stripe"],
    ["wallets", "Apple Pay and Google Pay", "One-tap wallets, through Stripe", "stripe"],
    ["bank", "Pay by bank", "Donors approve in their banking app (one-off gifts)", "stripe"],
    ["dd", "Direct Debit", "Bacs Direct Debit for monthly and yearly gifts, through Stripe", "stripe"],
    ["paypal", "PayPal", "PayPal balance or linked card, paid to your PayPal account", "paypal"],
];
interface StripeStatus { connected: boolean; charges_enabled?: boolean; payouts_enabled?: boolean; details_submitted?: boolean; requirements?: string[] }

/** returnTo: the path Stripe sends the organiser back to after onboarding. */
export const usePaySettings = (org: Org, setOrg: (o: Org) => void, returnTo: string) => {
    const { db, toast, isDemo } = useApp();
    const [country, setCountry] = useState("GB");
    const [busy, setBusy] = useState(false);
    const [st, setSt] = useState<StripeStatus | null>(null);
    const reload = async () => { const o = (await db.rpc<Org[]>("org_by_slug", { s: org.slug }))[0]; if (o) setOrg(o); };
    const stripe = async (action: "onboard" | "status" | "dashboard") => {
        setBusy(true);
        try {
            const r = await db.fn<StripeStatus & { url?: string; demo?: boolean }>("connect", { org_id: org.id, action, country, return_to: returnTo, origin: window.location.origin });
            if (r.url) { window.location.assign(r.url); return; }
            if (action === "status") { setSt(r); await reload(); }
            if (r.demo) { await reload(); toast("Demo: Stripe marked as connected"); }
        } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
    };
    useEffect(() => { if (org.stripe_account_id && !isDemo) stripe("status"); }, [org.id]); // eslint-disable-line react-hooks/exhaustive-deps
    /** Writes org settings (paypal_merchant_id, pay_methods, tips_enabled…) and takes the saved row. */
    const save = async (p: Record<string, unknown>, done?: string) => {
        setBusy(true);
        try { setOrg(await db.rpc<Org>("org_update", { org: org.id, p })); if (done) toast(done); } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
    };
    const connected = { stripe: org.stripe_charges_enabled, paypal: !!org.paypal_merchant_id };
    /** What donors are offered now: connected and switched on. */
    const live = payConfigOf(org);
    /** The switches as saved, whether or not their provider is connected. */
    const pm: Org["pay_methods"] = Object.assign({ card: true, wallets: true, bank: true, dd: true, paypal: true }, org.pay_methods);
    return { country, setCountry, busy, st, stripe, save, connected, live, pm, offered: Object.values(live).filter(Boolean).length };
};
export type PaySettings = ReturnType<typeof usePaySettings>;
