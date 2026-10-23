// Stripe Connect for a charity: create its account, send it to Stripe-hosted onboarding, refresh its status, open its Stripe dashboard.
// Accounts use controller properties (the current replacement for `type: express`): Stripe hosts the dashboard, the platform pays fees and owns losses.
import { admin, asUser, fail, json, serve, stripe, SITE_URL } from "../_shared/deps.ts";

interface Input { org_id: string; action: "onboard" | "status" | "dashboard"; country?: string; return_to?: string; origin?: string }

serve(async (req) => {
    const b = (await req.json()) as Input;
    if (!b.org_id || !b.action) return fail("org_id and action are required");
    const me = asUser(req);
    const { data: user } = await me.auth.getUser();
    if (!user.user) return fail("Sign in first", 401);
    const { data: member } = await me.rpc("is_member", { org: b.org_id });
    if (!member) return fail("Only members of the organisation can do this", 403);
    const db = admin(); const s = stripe();
    const { data: org } = await db.from("orgs").select("*").eq("id", b.org_id).single();
    if (!org) return fail("Organisation not found", 404);
    const origin = (b.origin ?? SITE_URL()).replace(/\/$/, "");
    const back = `${origin}${b.return_to && b.return_to.startsWith("/") ? b.return_to : "/admin"}`;

    if (b.action === "onboard") {
        let acct = org.stripe_account_id as string | null;
        if (!acct) {
            const country = (b.country ?? "GB").toUpperCase();
            if (!/^[A-Z]{2}$/.test(country)) return fail("country must be a two-letter code");
            const a = await s.accounts.create({
                country, email: user.user.email ?? undefined,
                controller: { fees: { payer: "application" }, losses: { payments: "application" }, stripe_dashboard: { type: "express" } },
                capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
                business_profile: { name: org.name, url: org.website || `${SITE_URL()}/o/${org.slug}`, product_description: "Charitable donations and fundraising" },
                metadata: { org_id: org.id, org_slug: org.slug },
            });
            acct = a.id;
            await db.from("orgs").update({ stripe_account_id: acct }).eq("id", org.id);
        }
        const link = await s.accountLinks.create({ account: acct, refresh_url: `${back}?stripe=refresh`, return_url: `${back}?stripe=return`, type: "account_onboarding" });
        return json({ url: link.url });
    }
    if (!org.stripe_account_id) return json({ connected: false });
    if (b.action === "status") {
        const a = await s.accounts.retrieve(org.stripe_account_id);
        await db.from("orgs").update({ stripe_charges_enabled: !!a.charges_enabled, stripe_payouts_enabled: !!a.payouts_enabled }).eq("id", org.id);
        return json({ connected: true, charges_enabled: !!a.charges_enabled, payouts_enabled: !!a.payouts_enabled, details_submitted: !!a.details_submitted, requirements: a.requirements?.currently_due ?? [] });
    }
    if (b.action === "dashboard") { const l = await s.accounts.createLoginLink(org.stripe_account_id); return json({ url: l.url }); }
    return fail("Unknown action");
});
