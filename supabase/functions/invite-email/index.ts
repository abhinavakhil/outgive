// Emails a pending team invite (org_invites) through the shared sender. Called after member_add saves an invite, and by "Resend".
// Admins of the org only. At most 5 emails per invite, and not twice in one minute, so it cannot be used to spam an address.
import { admin, asUser, fail, json, serve, SITE_URL } from "../_shared/deps.ts";
import { send } from "../_shared/notify/index.ts";

const ROLE: Record<string, string> = { admin: "an admin", editor: "an editor", viewer: "a viewer" };

serve(async (req) => {
    const b = (await req.json()) as { org_id?: string; email?: string; origin?: string };
    if (!b.org_id || !b.email) return fail("org_id and email are required");
    const me = asUser(req);
    const { data: user } = await me.auth.getUser();
    if (!user.user) return fail("Sign in first", 401);
    const { data: ok } = await me.rpc("has_role", { org: b.org_id, min: "admin" });
    if (!ok) return fail("Only admins can invite people", 403);
    const db = admin(), email = b.email.trim().toLowerCase();
    const { data: inv } = await db.from("org_invites").select("*").eq("org_id", b.org_id).eq("email", email).maybeSingle();
    if (!inv) return fail("There is no invite for that email", 404);
    if (inv.emails_sent >= 5) return fail("This invite has been emailed five times. Cancel it and add them again if needed.", 429);
    if (inv.emailed_at && Date.now() - Date.parse(inv.emailed_at) < 60_000) return fail("Sent a moment ago. Try again in a minute.", 429);
    const { data: org } = await db.from("orgs").select("name").eq("id", b.org_id).single();
    const from = user.user.user_metadata?.name || user.user.email || "Your team";
    const link = `${(b.origin ?? SITE_URL()).replace(/\/$/, "")}/ramadhan/login?next=/engage`;
    const r = await send({
        to: email, channel: "email", orgId: b.org_id,
        subject: `${from} invited you to ${org?.name ?? "their charity"} on Outgive`,
        body: `${from} has added you to ${org?.name ?? "their charity"}'s team on Outgive as ${ROLE[inv.role] ?? inv.role}.\n\nSign in with this email address (${email}) to join:\n${link}\n\nNo password is needed: we send you a code. If you were not expecting this, you can ignore this email.`,
    });
    if (!r.ok) return fail(`The email could not be sent: ${r.error ?? "unknown error"}`, 502);
    await db.from("org_invites").update({ emailed_at: new Date().toISOString(), emails_sent: inv.emails_sent + 1 }).eq("org_id", b.org_id).eq("email", email);
    return json({ sent: true, provider: r.provider });
});
