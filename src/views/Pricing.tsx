import { ArrowRight, Check } from "@untitledui/icons";
import { Container, Logo, ThemeToggle, useApp } from "@/components/outgive/shared";
import { CARD_FEE_FIXED, CARD_FEE_PCT, DEFAULT_TIP_PCT } from "@/lib/money";

const INCLUDED = ["Unlimited campaigns, fundraisers, teams, events and in-memory pages", "The live leaderboard in 29 layouts, and 12 page layouts", "Live screens and stream overlays", "Cards, Apple Pay, Google Pay and Link through Stripe", "Monthly giving, offline gifts, matching pledges and tickets", "Email receipts, CSV export, organiser roles", "Your name, logo, colours, font and your own domain"];

/** One plan. The platform is paid by optional donor tips; a charity can switch tips off and pay a platform fee instead. */
export const Pricing = () => {
    const { go } = useApp();
    return (
        <div className="min-h-dvh bg-primary">
            <header className="sticky top-0 z-30 border-b border-secondary bg-primary/90 backdrop-blur"><Container className="flex items-center justify-between gap-3 py-3"><Logo onClick={() => go({ name: "landing" })} /><ThemeToggle /></Container></header>
            <Container className="flex flex-col gap-10 py-14">
                <div className="max-w-2xl"><p className="text-sm font-semibold text-brand-secondary">Pricing</p><h1 className="mt-2 text-display-sm font-semibold tracking-tight text-primary md:text-display-md">Free for charities. Donors keep it running.</h1><p className="mt-3 text-lg text-tertiary">Every gift goes to the charity's own Stripe account. At checkout donors can add a tip to Outgive, {DEFAULT_TIP_PCT}% by default and easy to set to zero. That tip is the whole business model.</p></div>
                <div className="grid gap-5 md:grid-cols-2">
                    <div className="flex flex-col gap-5 rounded-3xl bg-brand-primary p-7"><div><div className="text-sm font-semibold text-brand-secondary">Tips on</div><div className="mt-1 text-display-sm font-semibold text-primary">0%</div><div className="text-sm text-tertiary">platform fee</div></div><ul className="flex flex-col gap-2 text-sm text-secondary">{INCLUDED.map((t) => <li key={t} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-brand-secondary" />{t}</li>)}</ul></div>
                    <div className="flex flex-col gap-5 rounded-3xl p-7 ring-1 ring-secondary ring-inset"><div><div className="text-sm font-semibold text-tertiary">Tips off</div><div className="mt-1 text-display-sm font-semibold text-primary">3%</div><div className="text-sm text-tertiary">platform fee, taken from each gift</div></div><p className="text-sm text-tertiary">Some charities prefer donors never see a tip. Switch tips off in your dashboard and a flat fee applies instead. Everything else is the same.</p></div>
                </div>
                <div className="rounded-3xl p-7 ring-1 ring-secondary ring-inset"><h2 className="text-lg font-semibold text-primary">Card processing</h2><p className="mt-1 max-w-2xl text-sm text-tertiary">Stripe charges the charity's account its standard rate, around {CARD_FEE_PCT}% + {CARD_FEE_FIXED}c per card payment, lower for registered charities in many countries. Donors can tick "cover the fees" so the charity still nets the full gift. Outgive never holds the money.</p></div>
                <button type="button" onClick={() => go({ name: "start" })} className="flex w-fit cursor-pointer items-center gap-2 rounded-full bg-brand-solid px-6 py-3 text-md font-semibold text-white hover:bg-brand-solid_hover">Start your board<ArrowRight className="size-5" /></button>
            </Container>
        </div>
    );
};
