// Verifies a charity's EIN before payments are switched on, and records the answer on the org (ein, ein_status, ein_checked_at).
// POST {org_id, ein?, refresh?} with the signed-in user's JWT; they must be an admin of the org. Without ein, the org's saved EIN is checked.
// EIN_CHECK_MODE=live asks ProPublica (cached in ein_checks for 30 days); anything else is the sandbox (logic.ts SANDBOX).
import { admin, asUser, fail, json, serve } from "../_shared/deps.ts";
import { CACHE_DAYS, type EinRecord, fromProPublica, parseEin, SANDBOX, verdict } from "./logic.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const lookup = async (ein: string): Promise<{ source: string; rec: EinRecord; raw: unknown }> => {
    if (Deno.env.get("EIN_CHECK_MODE") !== "live") return { source: "sandbox", rec: SANDBOX[ein] ?? fromProPublica(null), raw: {} };
    const res = await fetch(`https://projects.propublica.org/nonprofits/api/v2/organizations/${ein}.json`, { headers: { Accept: "application/json" } });
    if (res.status === 404) return { source: "propublica", rec: fromProPublica(null), raw: {} };
    if (!res.ok) throw new Error(`The IRS lookup is not answering (${res.status}). Try again in a few minutes.`);
    const raw = await res.json() as { organization?: Record<string, unknown> };
    return { source: "propublica", rec: fromProPublica(raw), raw: raw.organization ?? {} };
};

serve(async (req) => {
    const b = (await req.json().catch(() => ({}))) as { org_id?: string; ein?: string; refresh?: boolean };
    if (!UUID.test(b.org_id ?? "")) return fail("org_id must be a uuid");
    const { data: ok } = await asUser(req).rpc("has_role", { org: b.org_id, min: "admin" });
    if (ok !== true) return fail("Only the charity's admins can verify it", 403);

    const db = admin();
    const { data: org } = await db.from("orgs").select("id, ein, legal_name").eq("id", b.org_id).single();
    const ein = parseEin(b.ein ?? org?.ein ?? "");
    if (!org || !ein) return json({ ein: b.ein ?? "", status: "failed", record: null, steps: [{ label: "Format: nine digits", ok: false }], message: "An EIN has nine digits, written 12-3456789." });

    const { data: cached } = await db.from("ein_checks").select("*").eq("ein", ein).maybeSingle();
    let rec: EinRecord;
    if (cached && !b.refresh && Date.now() - new Date(cached.checked_at).getTime() < CACHE_DAYS * 86400_000) rec = { ...cached, status_code: null };
    else {
        const l = await lookup(ein);
        const { data: rev } = await db.from("ein_revocations").select("ein").eq("ein", ein).is("reinstated_on", null).maybeSingle();
        rec = { ...l.rec, revoked: l.rec.revoked || !!rev };
        await db.from("ein_checks").upsert({ ein, source: l.source, found: rec.found, name: rec.name, city: rec.city, state: rec.state, subsection: rec.subsection, deductibility: rec.deductibility, revoked: rec.revoked, raw: l.raw, checked_at: new Date().toISOString() });
    }
    // A charity that has not typed its legal name takes the IRS's.
    const legal = org.legal_name || (rec.found ? rec.name : "");
    const out = verdict(ein, rec, org.legal_name);
    await db.from("orgs").update({ ein, legal_name: legal, ein_status: out.status, ein_checked_at: new Date().toISOString() }).eq("id", org.id);
    return json(out);
});
