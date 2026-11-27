// PayPal Checkout: an order paid straight to the charity's PayPal merchant id, captured once the donor approves it. One-off gifts only.
// Needs PAYPAL_CLIENT_ID and PAYPAL_SECRET (PAYPAL_API=https://api-m.sandbox.paypal.com for the sandbox).
// ponytail: no platform fee or tip split on PayPal (that needs PayPal's partner programme); the charity is the payee and gets the whole charge.
import { fromMinor, ZERO_DECIMAL } from "../money.ts";
import { fromPayPal } from "../../pay/logic.ts";
import { SITE_URL } from "../deps.ts";
import type { Provider } from "./types.ts";

const call = async (path: string, body?: unknown, requestId?: string) => {
    const id = Deno.env.get("PAYPAL_CLIENT_ID")!, secret = Deno.env.get("PAYPAL_SECRET")!;
    const base = Deno.env.get("PAYPAL_API") ?? "https://api-m.paypal.com";
    const tok = await (await fetch(`${base}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${btoa(`${id}:${secret}`)}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" })).json();
    const r = await fetch(`${base}${path}`, { method: body === undefined ? "GET" : "POST", headers: { Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json", ...(requestId ? { "PayPal-Request-Id": requestId } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return await r.json();
};

export const paypalProvider: Provider = {
    id: "paypal",
    capabilities: { methods: ["paypal"], recurring: false, offSession: false, platformFee: false, refunds: true },
    configured: () => !!Deno.env.get("PAYPAL_CLIENT_ID") && !!Deno.env.get("PAYPAL_SECRET"),

    start: async ({ input: b, donationId, account, title, amounts: m, save, row }) => {
        const back = new URL(`${(b.origin ?? SITE_URL()).replace(/\/$/, "")}${b.return_to && b.return_to.startsWith("/") ? b.return_to : "/"}`);
        back.searchParams.set("ck_pay", donationId);
        const cur = b.currency.toUpperCase();
        // Idempotent on PayPal-Request-Id, so a retry gets the same order back.
        const o = await call("/v2/checkout/orders", {
            intent: "CAPTURE",
            purchase_units: [{ custom_id: donationId, description: `Gift to ${title}`.slice(0, 127), amount: { currency_code: cur, value: fromMinor(m.today, cur).toFixed(ZERO_DECIMAL.has(cur) ? 0 : 2) }, payee: { merchant_id: account.external_id } }],
            payment_source: { paypal: { experience_context: { return_url: back.toString(), cancel_url: back.toString(), user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING" } } },
        }, b.attempt_key);
        if (o?.id && !row.paypal_order_id) await save({ paypal_order_id: o.id });
        const { capture: _, ...out } = fromPayPal(o ?? {}, donationId);
        return out.status === "requires_action" && !out.redirectUrl ? { status: "failed", id: donationId, error: { code: "unknown", message: "PayPal could not start the payment." } } : out;
    },

    status: async ({ donationId, row }) => {
        const order = row.paypal_order_id as string | null;
        if (!order) return { status: "failed", id: donationId, error: { code: "unknown" } };
        let out = fromPayPal((await call(`/v2/checkout/orders/${order}`)) ?? {}, donationId);
        if (out.capture) out = fromPayPal((await call(`/v2/checkout/orders/${order}/capture`, {}, `${row.attempt_key}:cap`)) ?? {}, donationId);
        // TODO(paypal): no webhook yet, so PayPal gifts get no emailed receipt and a delayed capture (eCheque) is never confirmed here.
        const { capture: _, ...done } = out;
        return done;
    },
};
