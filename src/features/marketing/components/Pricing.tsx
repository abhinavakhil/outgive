/**
 * /pricing, in the Outgive design system on the public site frame: a short hero and the plans, nothing else.
 * One product, two ways to pay for it: tips on (donors can add an optional tip, 0% platform fee) or tips off (a platform fee from each gift).
 * Fundraisers never pay. Anything not decided yet is a [bracketed placeholder].
 */
import { SitePage } from "@/shared/ui";
import { CARD_FEE_FIXED, CARD_FEE_PCT, DEFAULT_TIP_PCT } from "@/shared/lib/money";
import { cx } from "@/shared/utils/cx";
import { TIPS_OFF_FEE_BPS } from "../pricing-calc";

const FEE_PCT = TIPS_OFF_FEE_BPS / 100;
/** Stripe's standard card rate as the checkout estimates it. */
const CARD_RATE = `${CARD_FEE_PCT}% + ${CARD_FEE_FIXED}p`;

/** The two ways a charity can fund Outgive. `rows` is who pays what: the charity, its donors, and Stripe. */
interface Plan { name: string; who: string; price: string; unit: string; rows: [string, string][]; best?: boolean }
const STRIPE_ROW: [string, string] = ["Stripe", `About ${CARD_RATE} card processing (estimate)`];
const PLANS: Plan[] = [
    { name: "Tips on", who: "The default, for most charities and mosques", price: "0%", unit: "platform fee", best: true, rows: [["Charity", "No platform fee, no setup fee, no monthly fee"], ["Donors", `Can add an optional tip, ${DEFAULT_TIP_PCT}% suggested, on top of the gift`], STRIPE_ROW] },
    { name: "Tips off", who: "For charities that prefer donors never see a tip", price: `${FEE_PCT}%`, unit: "platform fee per gift", rows: [["Charity", `${FEE_PCT}% of each gift, with no setup fee and no monthly fee`], ["Donors", "Never see a tip at checkout"], STRIPE_ROW] },
];


const FOREST = { background: "linear-gradient(170deg, #3A4829 0%, #27311B 100%)" };

export const Pricing = () => (
    <SitePage narrow={false}>
        <section className="flex flex-col items-center text-center">
            <span className="og-tag" style={{ background: "#EEF2D6", color: "#4B5530" }}>Tip-funded pricing</span>
            <h1 className="og-h1 mt-6 max-w-[12ch]">Free to start. <span className="og-script">Fair</span> when you grow.</h1>
            <p className="og-lead mx-auto">No setup fee, no monthly fee, and a 0% platform fee when donors can add a tip.</p>
        </section>

        <section id="plans" aria-labelledby="pr-plans" className="mt-16 scroll-mt-6">
            <h2 id="pr-plans" className="sr-only">Plans</h2>
            <div className="grid items-stretch gap-5 md:grid-cols-2">
                {PLANS.map((p) => (
                    <article key={p.name} aria-label={p.name} className={cx("relative flex flex-col overflow-hidden rounded-[28px] p-7 sm:p-9", p.best ? "text-white" : "og-card")} style={p.best ? { ...FOREST, boxShadow: "0 30px 60px -28px rgb(35 44 28 / 0.6)" } : undefined}>
                        <div className="flex min-h-7 flex-wrap items-center justify-between gap-2">
                            <h3 className="text-[22px] leading-tight font-medium tracking-[-0.03em]">{p.name}</h3>
                            {p.best && <span className="og-tag" style={{ background: "#D2DBA0", color: "#191919" }}>Recommended</span>}
                        </div>
                        <p className={cx("mt-1 text-[15px] leading-snug", p.best ? "text-white/70" : "text-[#666]")}>{p.who}</p>
                        <p className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            <span className={cx("text-[88px] leading-[0.85] font-medium tracking-[-0.06em] tabular-nums sm:text-[104px]", p.best && "text-[#D2DBA0]")}>{p.price}</span>
                            <span className={cx("text-[15px]", p.best ? "text-white/75" : "text-[#666]")}>{p.unit}</span>
                        </p>
                        <dl className={cx("mt-7 mb-7 text-[15px] leading-snug", p.best ? "text-white/90" : "text-[#191919]")}>
                            {p.rows.map(([k, v]) => (
                                <div key={k} className={cx("flex gap-4 border-t py-3", p.best ? "border-white/15" : "border-[#EEEEEE]")}>
                                    <dt className={cx("w-[72px] flex-none text-[13px]", p.best ? "text-[#C5CF9A]" : "text-[#666]")}>{k}</dt>
                                    <dd>{v}</dd>
                                </div>
                            ))}
                        </dl>
                        <a href="#demo" className={cx("mt-auto flex min-h-12 items-center justify-center rounded-full px-5 text-[15px] font-medium transition-transform hover:-translate-y-px", p.best ? "bg-[#D2DBA0] text-[#191919]" : "bg-[#191919] text-white")}><span className="sr-only">{p.name}: </span>Book a demo</a>
                    </article>
                ))}
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
                <article aria-label="Fundraisers" className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-[24px] p-6 sm:px-8" style={{ background: "linear-gradient(165deg, #FDEBDF, #FAD8C4)" }}>
                    <p className="text-[56px] leading-none font-medium tracking-[-0.06em] text-[#C24A14] tabular-nums">£0</p>
                    <div className="min-w-[200px] flex-1">
                        <h3 className="text-[20px] leading-tight font-medium tracking-[-0.03em]">Fundraisers never pay</h3>
                        <p className="mt-1 max-w-[40ch] text-[14.5px] leading-snug text-[#7A4A2E]">A fundraising page is free, and every gift goes straight to the charity’s own Stripe account, never through you.</p>
                    </div>
                    <a href="#demo" className="og-btn whitespace-nowrap">Book a demo</a>
                </article>
                <article aria-label="Enterprise" className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-[24px] border border-dashed border-[#D6D6D6] p-6 sm:px-8">
                    <div className="min-w-[180px] flex-1">
                        <h3 className="text-[20px] leading-tight font-medium tracking-[-0.03em]">[Enterprise / large charities]</h3>
                        <p className="mt-1 text-[14.5px] leading-snug text-[#666]">[Enterprise price] · [Enterprise billing terms]</p>
                    </div>
                    <a href="mailto:hello@outgive.tech?subject=Outgive%20for%20large%20charities" className="flex min-h-11 items-center rounded-full bg-[#F4F3F0] px-5 text-[15px] font-medium whitespace-nowrap hover:bg-[#EEEDE9]">Talk to us</a>
                </article>
            </div>
            <p className="mt-6 text-center text-[14px] text-[#666]">Every feature is included either way. Switch between tips on and tips off whenever you like in Payments → Fees.</p>
        </section>



    </SitePage>
);
