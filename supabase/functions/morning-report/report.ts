// The morning report after each Ramadan night: a pure builder (no Deno, no database) so it is tested with vitest from
// src/features/engage/revenue/report.test.ts. Inputs are the revenue_* SQL dashboards' results for the night (and the night before).

export interface NightFigures { raised_cents: number; gifts: number; donors: number; pledges: number; pledged_cents: number; pledge_collected_cents: number; match_unlocked_cents: number; match_remaining_cents: number; top_tables: { qr: string; cents: number; gifts: number }[] }
export interface Row { key: string; cents: number; gifts: number }
export interface ReportInput {
    orgName: string; currency: string; night: number;
    tonight: NightFigures; previous: NightFigures | null;
    /** revenue_campaign for the night: new donors and money by fund. */
    newDonors: number; funds: Row[];
    /** revenue_sources for the night. */
    sources: Row[];
    dashboardUrl: string;
}
export interface Report { subject: string; text: string; html: string }

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const buildMorningReport = (r: ReportInput): Report => {
    const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: r.currency, maximumFractionDigits: 0 });
    const $ = (c: number) => fmt.format(c / 100), t = r.tonight, n = (x: number) => x.toLocaleString("en-US");
    const change = r.previous && r.previous.raised_cents > 0 ? Math.round(((t.raised_cents - r.previous.raised_cents) / r.previous.raised_cents) * 100) : null;
    const top = (rows: Row[], k = 3) => rows.filter((x) => x.cents > 0).slice(0, k).map((x) => `${x.key} ${$(x.cents)}`);
    const lines: [string, string][] = [
        ["Raised", `${$(t.raised_cents)} from ${n(t.gifts)} gifts${change === null ? "" : ` (${change >= 0 ? "+" : ""}${change}% on Night ${r.night - 1})`}`],
        ["Donors", `${n(t.donors)}, ${n(r.newDonors)} new`],
        ...(t.pledges ? [["Pledged", `${$(t.pledged_cents)} in ${n(t.pledges)} pledges, ${$(t.pledge_collected_cents)} collected so far`] as [string, string]] : []),
        ...(t.match_unlocked_cents || t.match_remaining_cents ? [["Match", `${$(t.match_unlocked_cents)} unlocked, ${$(t.match_remaining_cents)} left`] as [string, string]] : []),
        ["Top sources", top(r.sources).join(", ") || "None yet"],
        ["Top funds", top(r.funds).join(", ") || "None yet"],
        ...(t.top_tables.length ? [["Top tables", t.top_tables.slice(0, 3).map((x) => `${x.qr} ${$(x.cents)}`).join(", ")] as [string, string]] : []),
    ];
    const subject = `Night ${r.night}: ${$(t.raised_cents)} from ${n(t.gifts)} gifts`;
    const text = [`${r.orgName}, Night ${r.night} of Ramadan`, "", ...lines.map(([k, v]) => `${k}: ${v}`), "", `See every gift: ${r.dashboardUrl}`].join("\n");
    const html = `<!doctype html><html><body style="margin:0;background:#f6f5f4;font-family:ui-sans-serif,system-ui,sans-serif;color:#1f1714">
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;padding:28px">
<div style="font-size:13px;color:#6b6460">${esc(r.orgName)}</div><h1 style="margin:4px 0 20px;font-size:22px">Night ${r.night}: ${esc($(t.raised_cents))}</h1>
<table style="width:100%;border-collapse:collapse;font-size:14px">${lines.map(([k, v]) => `<tr><td style="padding:8px 0;color:#6b6460;vertical-align:top;width:120px">${esc(k)}</td><td style="padding:8px 0">${esc(v)}</td></tr>`).join("")}</table>
<p style="margin:20px 0 0"><a href="${esc(r.dashboardUrl)}" style="color:#1f1714">See every gift</a></p></div></body></html>`;
    return { subject, text, html };
};
