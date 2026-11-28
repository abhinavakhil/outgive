// Stripe Billing (platform account) -> org_subscriptions. Its own endpoint and secret (BILLING_WEBHOOK_SECRET), apart from the donation
// webhook, so a charity's subscription and a donor's gift never share a code path. Events: customer.subscription.created / updated /
// deleted, and checkout.session.completed (to pick the subscription up the moment checkout ends). Replays are harmless: each one
// rewrites the row from the subscription's current state.
import { admin, env, fail, json, stripe } from "../_shared/deps.ts";
import { rowOf, type Subscription } from "../billing/plans.ts";

Deno.serve(async (req) => {
    const sig = req.headers.get("stripe-signature"); if (!sig) return fail("Missing signature", 400);
    const body = await req.text(), s = stripe();
    let event: { type: string; data: { object: Record<string, unknown> } };
    try { event = (await s.webhooks.constructEventAsync(body, sig, env("BILLING_WEBHOOK_SECRET"))) as unknown as typeof event; } catch (e) { return fail(`Bad signature: ${(e as Error).message}`, 400); }
    const o = event.data.object;
    let sub: Subscription | null = null;
    if (event.type.startsWith("customer.subscription.")) sub = o as unknown as Subscription;
    else if (event.type === "checkout.session.completed" && o.mode === "subscription" && o.subscription) sub = (await s.subscriptions.retrieve(String(o.subscription))) as unknown as Subscription;
    if (!sub) return json({ received: true, result: "ignored" });

    const db = admin(), row = rowOf(sub, (k) => Deno.env.get(k));
    // The org: the subscription's metadata (set by the billing function), else whoever holds this Stripe customer.
    let org = sub.metadata?.org_id ?? null;
    if (!org) org = (await db.from("org_subscriptions").select("org_id").eq("stripe_customer_id", row.stripe_customer_id).maybeSingle()).data?.org_id ?? null;
    if (!org) { console.log("billing: no org for", sub.id); return json({ received: true, result: "unknown customer" }); }
    // An old subscription ending must not overwrite the one that replaced it.
    const cur = (await db.from("org_subscriptions").select("stripe_subscription_id").eq("org_id", org).maybeSingle()).data?.stripe_subscription_id;
    if (cur && cur !== sub.id && ["canceled", "incomplete_expired"].includes(row.status)) return json({ received: true, result: "old subscription" });
    const { error } = await db.from("org_subscriptions").upsert({ org_id: org, ...row }, { onConflict: "org_id" });
    if (error) { console.error(error); return fail(error.message, 500); }
    console.log(event.type, org, row.plan, row.status);
    return json({ received: true, result: `${row.plan} ${row.status}` });
});
