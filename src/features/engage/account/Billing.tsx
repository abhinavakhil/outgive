/**
 * Billing (/engage/billing): the charity's Outgive plan. Subscribing opens Stripe Checkout; card, invoices, plan changes and cancelling
 * open the Stripe Customer Portal. Both are on Outgive's own Stripe account, apart from donations. Admins and owners change it.
 */
import { useState } from "react";
import { ArrowUpRight, Check } from "@phosphor-icons/react";
import { cx } from "@/shared/utils/cx";
import { Card, Empty, StatStrip, Tag } from "../ui/primitives";
import { useWorkspace } from "../shell/workspace";
import { type Billing as B, type Feature, type Interval, PLANS, type Plan, pilotDaysLeft, statusLabel, upgradeFor } from "./model";
import { useBilling } from "./data";
import "./account.css";

const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
const WHAT: Record<Feature, string> = { appeals_unlimited: "More than one appeal", pledge_recovery: "Pledge recovery", analytics: "Revenue analytics", chapters: "Chapters" };

/** A soft upgrade prompt for any screen: says what the feature needs, links to billing, and never blocks anything. Renders nothing when allowed. */
export const UpgradeNote = ({ plan, feature }: { plan: Plan; feature: Feature }) => {
    const need = upgradeFor(plan, feature);
    if (!need) return null;
    return (
        <aside className="eg-ac-upgrade" aria-label="Upgrade">
            <p><b>{WHAT[feature]} is on the {PLANS[need].name} plan.</b> {PLANS[need].name} is {usd(PLANS[need].month)} a month, flat. Donations keep working on every plan.</p>
            <a className="eg-btn black sm" href="/engage/billing">See plans</a>
        </aside>
    );
};

export const Billing = () => {
    const ws = useWorkspace();
    const { billing, state, error, open, today } = useBilling();
    const [interval, setInterval] = useState<Interval>("month");
    if (state === "loading") return <div className="eg-skeleton tall" aria-busy="true"><span className="eg-sr">Loading billing</span></div>;
    if (state === "error" || !billing) return <Card title="Billing"><Empty>Billing could not be loaded: {error}</Empty></Card>;
    const admin = ws.role === "owner" || ws.role === "admin";

    return (
        <div className="eg-ac">
            <header className="eg-ac-head">
                <div>
                    <h1>Billing</h1>
                    <p className="eg-muted">Outgive is a flat subscription. We take no percentage of any gift, Zakat or otherwise: donors pay your charity's own Stripe account, and the only deduction is the card processor's fee.</p>
                </div>
            </header>
            {billing.billed_by_parent
                ? <Card title="Your plan"><Empty>This is a chapter, so it is covered by its parent organisation's {PLANS[billing.plan].name} plan. The parent's admins manage billing.</Empty></Card>
                : !admin
                ? <Card title="Your plan"><p className="eg-muted">{ws.org.name} is on the <b>{PLANS[billing.plan].name}</b> plan. Only admins and owners can see invoices or change the plan.</p></Card>
                : <Body b={billing} today={today} interval={interval} setInterval={setInterval} open={open} />}
        </div>
    );
};

const Body = ({ b, today, interval, setInterval, open }: { b: B; today: string; interval: Interval; setInterval: (i: Interval) => void; open: ReturnType<typeof useBilling>["open"] }) => {
    const ws = useWorkspace();
    const pilot = pilotDaysLeft(b, today), st = statusLabel(b, today);
    const paying = ["active", "trialing", "past_due", "unpaid"].includes(b.status ?? "");
    const current: Plan = paying ? b.subscribed_plan ?? "free" : "free";
    return (
        <>
            <Card title="Your plan" action={<Tag tone={st.tone}>{st.text}</Tag>}>
                <div className="eg-ac-plan">
                    <div>
                        <p className="eg-ac-big">{PLANS[b.plan].name}</p>
                        {pilot !== null && <p className="eg-muted">Founding pilot: free until {day(b.pilot_until!)} ({pilot} {pilot === 1 ? "day" : "days"} left). After that, {PLANS[b.post_pilot_plan ?? "free"].name}{b.post_pilot_plan && b.post_pilot_plan !== "free" ? ` at ${usd(PLANS[b.post_pilot_plan].month)} a month` : ""}, as agreed in writing.{b.pilot_terms ? ` (${b.pilot_terms})` : ""}</p>}
                        {paying && b.current_period_end && <p className="eg-muted">{b.cancel_at_period_end ? "Ends" : b.status === "trialing" ? "First charge" : "Renews"} on {day(b.current_period_end)}, billed {b.interval === "year" ? "yearly" : "monthly"}.</p>}
                        {(b.status === "past_due" || b.status === "unpaid") && <p className="eg-ac-warn" role="status">The last payment did not go through. Update the card to keep {PLANS[b.subscribed_plan ?? "standard"].name}. Your donation pages keep working either way.</p>}
                    </div>
                    {b.has_customer && <button type="button" className="eg-btn white" onClick={() => open("portal")}>Card, invoices and cancelling<ArrowUpRight size={16} weight="bold" aria-hidden="true" /></button>}
                </div>
                <StatStrip items={[
                    { label: "Appeals", value: b.plan === "free" ? `${b.appeals} of 1` : b.appeals, note: b.plan === "free" ? "Free includes one" : "Unlimited" },
                    { label: "Chapters", value: b.chapters, note: b.plan === "multi" ? "Included" : "Multi-chapter plan" },
                    { label: "Outgive's share of gifts", value: "0%", note: "Flat price instead" },
                    { label: "Commitment", value: b.interval === "year" ? "Yearly" : "Monthly", note: "Cancel any time" },
                ]} />
            </Card>

            <section className="eg-card" aria-labelledby="eg-ac-plans">
                <header className="eg-card-head">
                    <h2 className="eg-card-title" id="eg-ac-plans">Plans</h2>
                    <div className="eg-ac-seg" role="radiogroup" aria-label="Billing period">
                        {(["month", "year"] as const).map((i) => <button key={i} type="button" role="radio" aria-checked={interval === i} className={cx(interval === i && "on")} onClick={() => setInterval(i)}>{i === "month" ? "Monthly" : "Yearly, 2 months free"}</button>)}
                    </div>
                </header>
                <ul className="eg-ac-plans">
                    {(Object.keys(PLANS) as Plan[]).map((p) => {
                        const x = PLANS[p], here = p === current;
                        return (
                            <li key={p} className={cx(here && "here", p === "standard" && "pick")}>
                                <h3>{x.name}{here && <Tag tone="sage">Current</Tag>}</h3>
                                <p className="eg-ac-price"><b>{usd(interval === "month" ? x.month : x.year)}</b><span>{interval === "month" ? "a month" : "a year"}</span></p>
                                <p className="eg-muted">{x.blurb}</p>
                                <ul>{x.points.map((t) => <li key={t}><Check size={14} weight="bold" aria-hidden="true" />{t}</li>)}</ul>
                                {here ? <button type="button" className="eg-btn white sm" disabled>Current plan</button>
                                    : p === "free" ? <button type="button" className="eg-btn white sm" onClick={() => open("portal")} disabled={!b.has_customer}>{b.has_customer ? "Cancel in the portal" : "Free"}</button>
                                    : <button type="button" className={cx("eg-btn sm", p === "standard" ? "black" : "sage")} onClick={() => open(paying ? "portal" : "checkout", p, interval)}>{paying ? `Switch to ${x.name}` : pilot !== null ? `Add a card for ${x.name}` : `Choose ${x.name}`}</button>}
                            </li>
                        );
                    })}
                </ul>
                <p className="eg-muted eg-ac-fine">{pilot !== null ? `On a founding pilot nothing is charged before ${day(b.pilot_until!)}. Add a card now and the first charge is the day after. ` : ""}Payment is by Stripe. Cancel any time in the portal; the plan runs to the end of the period you paid for. Prices are in US dollars.</p>
            </section>

            <Card title="How Outgive is paid">
                <ul className="eg-ac-never">
                    <li><b>Only this subscription.</b> The plan price is what Outgive charges {ws.org.name}. There is no setup fee and no per-gift fee.</li>
                    <li><b>No cut of Zakat or Sadaqah.</b> Gifts go to {ws.org.name}'s own Stripe account, and Outgive takes no percentage of them.</li>
                    <li><b>Donations are never blocked.</b> If a payment for your plan fails, your give pages keep taking gifts.</li>
                </ul>
            </Card>
            {ws.sample && <p className="eg-muted eg-ac-fine">Sample billing. In the demo, Stripe Checkout and the portal do not open and nothing is charged.</p>}
        </>
    );
};
