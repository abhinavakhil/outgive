// The charity's Outgive subscription: start one with Stripe Checkout, or manage card, invoices and cancelling in the Stripe Customer Portal.
// Both run on the PLATFORM Stripe account (STRIPE_SECRET_KEY), never a charity's connected account. Admins and owners only.
// A chapter is billed through its parent organisation. billing-webhook writes the result into org_subscriptions.
import { admin, asUser, fail, json, serve, stripe, SITE_URL } from "../_shared/deps.ts";
import { type Interval, type Plan, priceFor, trialEnd } from "./plans.ts";

interface Input { org_id: string; action: "checkout" | "portal"; plan?: Plan; interval?: Interval; origin?: string }

serve(async (req) => {
    const b = (await req.json()) as Input;
    if (!b.org_id || !b.action) return fail("org_id and action are required");
    const me = asUser(req);
    const { data: user } = await me.auth.getUser();
    if (!user.user) return fail("Sign in first", 401);
    const { data: ok } = await me.rpc("has_role", { org: b.org_id, min: "admin" });
    if (!ok) return fail("Only admins and owners can change billing", 403);
    const db = admin(), s = stripe();
    const { data: org } = await db.from("orgs").select("id, slug, name, parent_org_id").eq("id", b.org_id).single();
    if (!org) return fail("Organisation not found", 404);
    if (org.parent_org_id) return fail("Chapters are billed through their parent organisation");
    const { data: sub } = await db.from("org_subscriptions").select("*").eq("org_id", org.id).maybeSingle();
    const origin = (b.origin ?? SITE_URL()).replace(/\/$/, ""), back = `${origin}/engage/billing`;

    if (b.action === "portal") {
        if (!sub?.stripe_customer_id) return fail("There is no billing account yet. Choose a plan first.");
        const p = await s.billingPortal.sessions.create({ customer: sub.stripe_customer_id, return_url: back });
        return json({ url: p.url });
    }
    if (b.action !== "checkout") return fail("Unknown action");
    const price = priceFor(b.plan ?? "free", b.interval ?? "month", (k) => Deno.env.get(k));
    if (!price) return fail("That plan is not on sale yet. Write to hello@outgive.org and we will set it up.");
    // Already paying: plan changes, card and cancelling happen in the portal, so nobody ends up with two subscriptions.
    if (sub?.stripe_customer_id && ["active", "trialing", "past_due", "unpaid", "incomplete", "paused"].includes(sub.status)) {
        const p = await s.billingPortal.sessions.create({ customer: sub.stripe_customer_id, return_url: back });
        return json({ url: p.url });
    }
    let customer = sub?.stripe_customer_id as string | undefined;
    if (!customer) {
        const c = await s.customers.create({ name: org.name, email: user.user.email ?? undefined, metadata: { org_id: org.id, org_slug: org.slug } });
        customer = c.id;
        const { error } = await db.from("org_subscriptions").upsert({ org_id: org.id, stripe_customer_id: customer, updated_at: new Date().toISOString() }, { onConflict: "org_id" });
        if (error) throw error;
    }
    const session = await s.checkout.sessions.create({
        mode: "subscription", customer, client_reference_id: org.id, line_items: [{ price, quantity: 1 }],
        subscription_data: { metadata: { org_id: org.id }, trial_end: trialEnd(sub?.pilot_until ?? null) },
        allow_promotion_codes: true, billing_address_collection: "auto",
        success_url: `${back}?billing=done`, cancel_url: back,
    });
    return json({ url: session.url });
});
