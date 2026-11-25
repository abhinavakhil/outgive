import { useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Loading } from "@/shared/ui";
import { flag } from "@/shared/lib/flags";
import { onTrack, sent } from "@/shared/lib/analytics";
import { campaigns } from "@/shared/lib/campaign-store";
import { PREFIX, type PageType } from "@/shared/domain/model";
import { payConfigOf } from "@/shared/domain/types";
import { useApp } from "@/shared/lib/app-context";
import { GiftTicket } from "./GiftTicket";
import { HeroStage } from "./HeroStage";
import { Pledge } from "./Pledge";
import { type CheckoutCampaign, ICONS, SAMPLE, sampleFrom } from "./model";
import { PayAnimation, soft } from "./parts";
import { demoPayments } from "./payments";
import { type CheckoutProps, type Ck, type Layout, useCheckout } from "./useCheckout";
import "./checkout.css";

const FONT = "https://fonts.googleapis.com/css2?family=Urbanist:wght@400;500;600;700;800&display=swap";
const LAYOUTS = { hero: HeroStage, pledge: Pledge, ticket: GiftTicket };

/**
 * The donate checkout, in one of three layouts. Drop it into any app:
 *   <Checkout campaign={myCampaign} onPay={takePayment} />
 * The layout comes from the checkout_layout flag (?checkout_layout=hero|pledge|ticket, or VITE_FF_CHECKOUT_LAYOUT) unless `layout` is given.
 */
export const Checkout = ({ layout, brand = "outgive", ...rest }: Omit<CheckoutProps, "layout"> & { layout?: Layout; brand?: string }) => {
    const chosen = layout ?? flag("checkout_layout");
    // Embedded as a preview (the phone on the home page): it still scrolls, but shows no scrollbars. See .ck-preview in checkout.css.
    useLayoutEffect(() => { if (new URLSearchParams(location.search).has("preview")) document.documentElement.classList.add("ck-preview"); }, []);
    useEffect(() => {
        if (document.querySelector(`link[href="${FONT}"]`)) return;
        const l = document.createElement("link"); l.rel = "stylesheet"; l.href = FONT; document.head.appendChild(l);
    }, []);
    return <Flow key={chosen} {...rest} layout={chosen} brand={brand} />;
};
const Flow = ({ brand, ...p }: CheckoutProps & { brand: string }) => {
    const ck = useCheckout(p);
    const View = LAYOUTS[p.layout];
    const share = p.onShare ?? (async () => { const url = location.href.split("?")[0]; try { if (navigator.share) await navigator.share({ title: p.campaign.title, url }); else await navigator.clipboard.writeText(url); } catch { /* cancelled */ } });
    return (
        <>
            {ck.s.bare && ck.s.step === 4 ? <Returned ck={ck} /> : <View ck={ck} brand={brand} onShare={share} onStart={p.onStartFundraiser} />}
            <div className="ck"><PayAnimation ck={ck} /><Resumed ck={ck} /></div>
            {(import.meta.env.DEV || new URLSearchParams(location.search).has("debug")) && !new URLSearchParams(location.search).has("preview") && <EventPanel />}
        </>
    );
};

/** After an unfinished gift is restored: says so, and offers a clean start. Goes away on the next step. */
const Resumed = ({ ck }: { ck: Ck }) => ck.s.resumed && ck.s.step < 4 && !ck.busy ? (
    <div role="status" className="fixed inset-x-3 top-3 z-40 mx-auto flex max-w-[540px] items-center gap-x-2 rounded-[18px] bg-(--ck-ink) py-2 pr-1.5 pl-4 text-[14px] leading-snug font-bold text-white shadow-[0_14px_30px_rgba(26,20,64,0.3)] sm:text-[14.5px] print:hidden">
        <span className="min-w-0 flex-1">Welcome back{ck.s.first.trim() ? `, ${ck.s.first.trim()}` : ""}. We kept your gift of {ck.f(ck.s.amount)} so you can finish it.</span>
        <button type="button" onClick={ck.restart} className="min-h-11 flex-none rounded-xl border-0 bg-white/15 px-3 text-[14px] font-extrabold whitespace-nowrap text-white">Start again</button>
        <button type="button" onClick={() => ck.set({ resumed: "" })} aria-label="Dismiss" className="min-h-11 min-w-11 flex-none rounded-xl border-0 bg-transparent text-[22px] leading-none text-white">×</button>
    </div>
) : null;

/**
 * Back from PayPal or a bank's page in a browser that no longer knows what was chosen: the result alone, with no amounts,
 * because none can be shown truthfully.
 */
const Returned = ({ ck }: { ck: Ck }) => (
    <div className="ck flex min-h-dvh items-center justify-center bg-[#F3EFFC] p-4">
        <div aria-live="polite" className="ck-fade flex w-full max-w-[480px] flex-col items-center gap-4 rounded-[32px] bg-white p-7 text-center shadow-[0_0_0_10px_rgba(255,255,255,0.55),0_30px_60px_rgba(110,80,200,0.18)]">
            <span className={ck.pending ? "rounded-lg bg-[#F8E5A6] px-2 py-1 text-[12px] font-extrabold text-(--ck-gold-ink)" : "rounded-lg bg-(--ck-mint) px-2 py-1 text-[12px] font-extrabold text-(--ck-green-ink)"}>{ck.pending ? "Waiting for your bank" : "Confirmed"}</span>
            <h1 className="m-0 text-[38px] leading-none font-bold tracking-[-1.6px] text-balance">{ck.pending ? "Your gift is on its way." : "Thank you."}</h1>
            <p className="m-0 text-[17px] leading-normal text-(--ck-ink-2)">{ck.pending ? "Your bank is confirming the payment. We’ll email your receipt when it goes through. You don’t need to pay again." : `Your payment to ${ck.c.charity} went through.`}</p>
            <button type="button" onClick={ck.restart} className={soft}>Give again</button>
        </div>
    </div>
);

/** Dev only (or ?debug): the events this visit has sent, newest first, plus a layout switcher. */
const EventPanel = () => {
    const n = useSyncExternalStore(onTrack, () => sent.length);
    const [open, setOpen] = useState(false);
    const swap = (l: string) => { const u = new URL(location.href); u.searchParams.set("checkout_layout", l); location.href = u.toString(); };
    return (
        <div className="fixed bottom-3 left-3 z-[60] max-w-[calc(100vw-24px)] font-mono text-[11px] text-white print:hidden">
            {open ? (
                <div className="w-[340px] max-w-full rounded-xl bg-[#1a1440]/95 p-3 shadow-xl">
                    <div className="mb-2 flex items-center gap-1.5">
                        <strong className="mr-auto">Analytics · {n}</strong>
                        {Object.keys(LAYOUTS).map((l) => <button key={l} type="button" onClick={() => swap(l)} className="cursor-pointer rounded bg-white/15 px-1.5 py-0.5 hover:bg-white/30">{l}</button>)}
                        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="cursor-pointer px-1">×</button>
                    </div>
                    <ol className="m-0 max-h-56 list-none overflow-auto p-0">
                        {[...sent].reverse().map((e, i) => <li key={i} className="border-t border-white/10 py-1"><span className="text-[#D9A0F0]">{e.event}</span> {e.data ? Object.entries(e.data).map(([k, v]) => `${k}=${v}`).join(" ") : ""}</li>)}
                    </ol>
                </div>
            ) : <button type="button" onClick={() => setOpen(true)} className="cursor-pointer rounded-full bg-[#1a1440]/90 px-3 py-1.5 shadow-lg">events · {n}</button>}
        </div>
    );
};

/** A campaign from the create flow, shaped for the checkout. Amounts in that store are USD. */
const fromStore = (c: Awaited<ReturnType<typeof campaigns.get>>): CheckoutCampaign | null => c && ({
    id: `${PREFIX[c.type]}/${c.slug}`, title: c.title, charity: c.charity || c.organiser || "the charity", beneficiary: c.charity || "the charity",
    raised: c.raised, goal: c.goal || Math.max(1000, c.raised * 2), currency: "USD", locale: "en-US",
    presets: c.gifts.length >= 2 ? c.gifts.slice(0, 4) : [10, 25, 50, 100], giftAid: false, match: null,
    extras: [{ id: "cover", name: "Cover the card fee", desc: "The charity keeps your full gift", price: "fee", tone: "violet", icon: ICONS.card }, { id: "tribute", name: "Dedicate this gift", desc: "In honour or in memory, with an e-card", price: 0, tone: "gold", icon: ICONS.heart, tribute: true }],
    impact: [[0, "the work this campaign funds"]],
});

/** The sample's related-cause add-on. A placeholder, like the rest of the sample, for the charity to replace. */
const SAMPLE_ADDON = { id: "related", name: "[Related cause]", amount: 5 };

/**
 * /checkout: the sample campaign from the designs, or ?campaign=f/my-page for one made in the create flow
 * (its gifts are recorded in the campaign service).
 */
export const CheckoutScreen = () => {
    const key = new URLSearchParams(location.search).get("campaign");
    const [state, setState] = useState<{ c: CheckoutCampaign; storeId?: string } | "loading" | "missing">(key ? "loading" : { c: sampleFrom(location.search) });
    useEffect(() => {
        if (!key) return;
        const [p, slug] = key.split("/");
        const type = (Object.keys(PREFIX) as PageType[]).find((t) => PREFIX[t] === p);
        if (!type || !slug) { setState("missing"); return; }
        campaigns.get(type, slug).then((raw) => { const c = fromStore(raw); setState(c && raw ? { c, storeId: raw.id } : "missing"); }).catch(() => setState("missing"));
    }, [key]);
    useEffect(() => { document.title = typeof state === "object" ? `Give to ${state.c.title}` : "Give"; }, [state]);
    // ponytail: no real charge on /checkout; a paid gift to a create-flow campaign is recorded in the campaign service.
    const sid = typeof state === "object" ? state.storeId : undefined;
    const payments = useMemo(() => sid ? demoPayments({
        record: (o) => campaigns.donate(sid, { name: o.donor.anonymous ? "Anonymous" : `${o.donor.first} ${o.donor.last}`.trim(), usd: o.amount + (o.total - o.recur), message: "", at: Date.now(), monthly: o.freq === "monthly" || undefined, dedication: o.tribute?.name || undefined }),
    }) : undefined, [sid]);
    if (state === "loading") return <Loading full />;
    if (state === "missing") return <div className="flex min-h-dvh flex-col items-center justify-center gap-2 p-6 text-center"><strong className="text-lg">That campaign isn't here.</strong><a className="text-brand-secondary underline" href="/checkout">Try the sample checkout</a></div>;
    const { c, storeId } = state;
    return (
        <Checkout
            campaign={c}
            payments={payments}
            addOn={storeId ? undefined : SAMPLE_ADDON}
            onStartFundraiser={() => { location.href = storeId ? `/create?for=${encodeURIComponent(c.id)}` : "/create"; }}
        />
    );
};

/** /demo/checkout, /o/<org>/checkout: the sample campaign under this organisation, offering only the ways to pay it has connected and switched on. */
export const OrgCheckout = () => {
    const { org } = useApp();
    if (!org) return null;
    const campaign: CheckoutCampaign = { ...SAMPLE, id: `org/${org.slug}`, charity: org.name, payments: payConfigOf(org) };
    // Real payments need the charity's Stripe account; the checkout also wants a real backend and VITE_STRIPE_PUBLISHABLE_KEY, and simulates otherwise.
    const live = org.stripe_account_id && org.stripe_charges_enabled ? { org_id: org.id, stripeAccount: org.stripe_account_id } : undefined;
    return <Checkout campaign={campaign} brand={org.name.toLowerCase()} live={live} />;
};
