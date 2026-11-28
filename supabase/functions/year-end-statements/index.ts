// Year-end giving statements: one per donor (by email) per charity, listing every paid gift of the year, for their tax return.
// Two callers, like pledge-recovery:
//   cron (every charity with receipt_year_end on): POST with header x-cron-secret: $CRON_SECRET, body {} or {year}; run mid-January
//   a charity admin: POST {org_id, year?, dry_run?} with their JWT
// year defaults to last year. A statement already issued is not issued again; one not yet emailed is emailed now. dry_run counts only.
import { admin, asUser, fail, json, serve } from "../_shared/deps.ts";
import { deliver, issueYearEnd, ORG_COLS, type YearEndGift } from "../_shared/receipts/issue.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
    const b = (await req.json().catch(() => ({}))) as { org_id?: string; year?: number; dry_run?: boolean };
    if (b.org_id !== undefined && !UUID.test(b.org_id)) return fail("org_id must be a uuid");
    const year = b.year ?? new Date().getUTCFullYear() - 1;
    if (!Number.isInteger(year) || year < 2000 || year > new Date().getUTCFullYear()) return fail("year is not valid");
    const secret = Deno.env.get("CRON_SECRET");
    const cron = !!secret && req.headers.get("x-cron-secret") === secret;
    if (!cron) {
        if (!b.org_id) return fail("org_id is required");
        const { data: ok } = await asUser(req).rpc("has_role", { org: b.org_id, min: "admin" });
        if (ok !== true) return fail("Only the charity's admins can send year-end statements", 403);
    }
    const db = admin();
    let q = db.from("orgs").select(ORG_COLS);
    q = b.org_id ? q.eq("id", b.org_id) : q.eq("receipt_year_end", true);
    const { data: orgs, error } = await q;
    if (error) throw error;

    const n = { orgs: 0, donors: 0, issued: 0, sent: 0, unsent: 0 };
    for (const org of orgs ?? []) {
        const { data: donors, error: e } = await db.rpc("year_end_donors", { org: org.id, yr: year });
        if (e) throw e;
        n.orgs++; n.donors += donors?.length ?? 0;
        if (b.dry_run) continue;
        // ponytail: one donor at a time inside one function call (~150 s wall clock); batch by offset if a charity has tens of thousands of donors.
        for (const d of (donors ?? []) as { donor_email: string; donor_name: string; currency: string; gifts: YearEndGift[] }[]) {
            const r = await issueYearEnd(db, org, year, d);
            if (r.fresh) n.issued++;
            if (r.row.sent_at) continue;
            if (await deliver(db, r.row, r.doc)) n.sent++; else n.unsent++;
        }
    }
    return json({ year, ...n });
});
