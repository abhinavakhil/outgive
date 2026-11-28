// The morning report: after each Ramadan night, one email per recipient with last night's numbers (revenue_settings.report_to,
// sent from report_hour local time). Run hourly by cron: POST with header x-cron-secret: $CRON_SECRET. revenue_reports_claim()
// picks each org and night once, so a rerun never sends twice. Sends through _shared/notify (console provider until RESEND_API_KEY).
import { admin, fail, json, serve, SITE_URL } from "../_shared/deps.ts";
import { send } from "../_shared/notify/index.ts";
import { buildMorningReport, type NightFigures, type Row } from "./report.ts";

serve(async (req) => {
    const secret = Deno.env.get("CRON_SECRET");
    if (!secret || req.headers.get("x-cron-secret") !== secret) return fail("Not allowed", 403);
    const db = admin();
    const { data: due, error } = await db.rpc("revenue_reports_claim");
    if (error) throw error;
    const out = [];
    for (const { org_id, night } of (due ?? []) as { org_id: string; night: number }[]) {
        const rpc = async <T,>(name: string, args: Record<string, unknown>) => { const r = await db.rpc(name, { org: org_id, ...args }); if (r.error) throw r.error; return r.data as T; };
        try {
            const [{ data: org }, { data: st }, tonight, previous, campaign, sources] = await Promise.all([
                db.from("orgs").select("name, slug, currency").eq("id", org_id).single(),
                db.from("revenue_settings").select("report_to").eq("org_id", org_id).single(),
                rpc<NightFigures>("revenue_tonight", { f: { night } }),
                night > 1 ? rpc<NightFigures>("revenue_tonight", { f: { night: night - 1 } }) : Promise.resolve(null),
                rpc<{ new_donors: number; by_fund: Row[] }>("revenue_campaign", { f: { night } }),
                rpc<Row[]>("revenue_sources", { f: { night } }),
            ]);
            const m = buildMorningReport({
                orgName: org!.name, currency: org!.currency, night, tonight, previous, newDonors: campaign.new_donors, funds: campaign.by_fund, sources,
                dashboardUrl: `${SITE_URL()}/engage/revenue?org=${org!.slug}`,
            });
            let sent = 0, failed = 0;
            for (const to of (st?.report_to ?? []) as string[]) {
                const r = await send({ to, channel: "email", subject: m.subject, body: m.text, html: m.html, orgId: org_id });
                if (r.ok) sent++; else failed++;
            }
            await db.from("revenue_reports").update({ sent, failed, error: null }).eq("org_id", org_id).eq("night", night);
            out.push({ org_id, night, sent, failed });
        } catch (e) {
            await db.from("revenue_reports").update({ error: (e as Error).message.slice(0, 500) }).eq("org_id", org_id).eq("night", night);
            out.push({ org_id, night, error: (e as Error).message });
        }
    }
    return json({ reports: out });
});
