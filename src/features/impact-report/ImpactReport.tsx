/**
 * A donor's personal impact report, /impact/<token>. Public: the token is the key (no sign-in). Shows the charity, the donor's first
 * name and what their gifts this Ramadan became, using the charity's own costs (impact_units). Never contact details, never Outgive
 * marketing: the page is the charity's. Demo mode, and local dev before the tables exist, show the sample.
 */
import { type ReactNode, useEffect, useState } from "react";
import { impactLines, money, reportByToken, totalOf, type ImpactReportData as Report } from "@/features/engage";
import { useApp } from "@/shared/lib/app-context";
import { SAMPLE_REPORT } from "./fixture";
import "./impact-report.css";

const TINTS = ["lilac", "sage", "peach"] as const;

export const Shell = ({ org, logo, children }: { org: string; logo?: string; children: ReactNode }) => (
    <div className="ir">
        <header className="ir-top">
            {logo ? <img src={logo} alt="" className="ir-logo" /> : <span className="ir-mono" aria-hidden="true">{org.slice(0, 1)}</span>}
            <span className="ir-org">{org}</span>
        </header>
        <main className="ir-main">{children}</main>
    </div>
);

export const ImpactReport = ({ token }: { token: string }) => {
    const { db, isDemo } = useApp();
    const [r, setR] = useState<Report | null | undefined>(undefined);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        let off = false;
        if (isDemo) { setR(SAMPLE_REPORT); return; }
        reportByToken(db, token).then((x) => !off && setR(x ?? null), () => !off && setR(import.meta.env.DEV ? SAMPLE_REPORT : null));
        return () => { off = true; };
    }, [db, isDemo, token]);

    useEffect(() => { if (r) document.title = `${r.first_name ? `${r.first_name}, your` : "Your"} ${r.season} with ${r.org_name}`; }, [r]);

    if (r === undefined) return <div className="ir" aria-busy="true" />;
    if (r === null) return (
        <Shell org="Impact report"><section className="ir-card ir-note"><h1 className="ir-h ir-mid">We could not find this report</h1><p className="ir-sub">The link may be incomplete. Try opening it again from the email the charity sent you.</p></section></Shell>
    );

    const lines = impactLines(r.funds, r.units), total = totalOf(r), counted = lines.filter((l) => l.count > 0), plain = lines.filter((l) => !l.count);
    const give = r.give_url || "/ramadhan/give", monthly = `${give}${give.includes("?") ? "&" : "?"}monthly=1`;
    const share = async () => {
        const url = location.href, title = `What my ${r.season} giving with ${r.org_name} did`;
        try {
            if (navigator.share) { await navigator.share({ title, url }); return; }
            await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2400);
        } catch { /* cancelled, or no clipboard */ }
    };
    const shareBtn = (cls: string) => <button type="button" className={`ir-btn ${cls}`} onClick={share}>{copied ? "Link copied" : "Share my report"}</button>;

    return (
        <Shell org={r.org_name} logo={r.logo_url}>
            <section className="ir-hero">
                <p className="ir-kicker"><span className="ir-moon" aria-hidden="true" />Your {r.season}</p>
                <h1 className="ir-h ir-big">{r.first_name ? `${r.first_name}, your` : "Your"} giving <span className="ir-sc">did this</span></h1>
                <p className="ir-sub">{money(total, r.currency)} across {lines.length} {lines.length === 1 ? "fund" : "funds"} this Ramadan{r.gifts > 1 ? `, in ${r.gifts} gifts` : ""}.</p>
            </section>

            {counted.length > 0 && (
                <ul className="ir-units" aria-label="What your gifts became">
                    {counted.map((l, i) => (
                        <li key={l.fund} className={`ir-unit ${TINTS[i % 3]}`}>
                            <span className="ir-count">{l.count.toLocaleString("en-US")}</span>
                            <span className="ir-label">{l.label}</span>
                            <span className="ir-fund">{l.fund} · {money(l.cents, r.currency)}</span>
                            {l.note && <span className="ir-fnote">{l.note}</span>}
                        </li>
                    ))}
                </ul>
            )}
            {plain.length > 0 && <p className="ir-plain">Also {plain.map((l) => `${money(l.cents, r.currency)} to ${l.fund}`).join(", ")}.</p>}

            <section className="ir-card ir-thanks">
                <p>Thank you. Each of these is a real meal, a real food pack, a real family. We count them by what each one costs us to deliver, so this is what your giving did.</p>
                <p className="ir-sign">With gratitude, the team at {r.org_name}</p>
            </section>

            <section className="ir-card ir-next">
                {r.monthly ? <>
                    <h2 className="ir-h ir-mid">You already give every month</h2>
                    <p className="ir-sub">That keeps families fed all year, not only in Ramadan. If this report made you smile, it might do the same for a friend.</p>
                    <div className="ir-actions">{shareBtn("ink")}</div>
                </> : <>
                    <h2 className="ir-h ir-mid">Keep Ramadan going all year</h2>
                    <p className="ir-sub">A small gift each month means families are fed between Ramadans too. You can change or stop it any time.</p>
                    <div className="ir-actions"><a className="ir-btn green" href={monthly}>Give monthly</a>{shareBtn("white")}</div>
                </>}
            </section>

            <p className="ir-foot">This page is yours: only people with the link can see it, and it shows your first name only. Sent by {r.org_name}.</p>
        </Shell>
    );
};
