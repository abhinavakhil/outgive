import { ArrowRight, Check, Heart, Mail01, SearchLg, Users01 } from "@untitledui/icons";
import { useState } from "react";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/shared/ui";
import { cx } from "@/shared/utils/cx";

/**
 * Dev-only page at /ui/variants: four design directions for the core components, side by side, to pick from.
 * Each direction is one map of Tailwind classes; the winning map becomes the default styles in shared/ui.
 */
type Dir = {
    id: string; name: string; note: string;
    btn: string; primary: string; secondary: string; ghost: string;
    field: string; label: string;
    card: string; cover: string; stat: string; statIcon: string;
    track: string; fill: string; step: string; stepOn: string; stepDone: string;
    badge: string; seg: string; segOn: string; segOff: string;
    check: string; checkOn: string;
};

/** Ink-on-paper inverse that flips with the theme (near-black in light mode, near-white in dark). */
const INV = "bg-fg-primary text-[var(--color-bg-primary)]";

const DIRS: Dir[] = [
    {
        id: "A", name: "Soft", note: "Pill shapes, tinted fills, gentle shadows. Friendly and warm, close to today's look.",
        btn: "h-11 rounded-full px-5 text-sm font-semibold transition active:scale-[0.98]",
        primary: "bg-brand-solid text-white shadow-sm hover:bg-brand-solid_hover",
        secondary: "bg-brand-primary text-brand-secondary hover:bg-brand-secondary",
        ghost: "text-secondary hover:bg-secondary",
        field: "h-11 rounded-full bg-secondary px-4 text-sm text-primary ring-1 ring-transparent placeholder:text-placeholder focus-within:bg-primary focus-within:ring-2 focus-within:ring-brand",
        label: "text-sm font-medium text-secondary",
        card: "rounded-3xl bg-primary p-4 shadow-md ring-1 ring-secondary",
        cover: "rounded-2xl",
        stat: "rounded-3xl bg-brand-primary p-5",
        statIcon: "rounded-full bg-brand-solid text-white",
        track: "h-2.5 rounded-full bg-brand-primary", fill: "rounded-full bg-brand-solid",
        step: "size-8 rounded-full bg-secondary text-tertiary", stepOn: "size-8 rounded-full bg-brand-solid text-white ring-4 ring-brand-primary", stepDone: "size-8 rounded-full bg-brand-secondary text-brand-secondary",
        badge: "rounded-full bg-brand-primary px-2.5 py-1 text-xs font-semibold text-brand-secondary",
        seg: "rounded-full bg-secondary p-1", segOn: "rounded-full bg-primary text-primary shadow-sm", segOff: "rounded-full text-tertiary hover:text-primary",
        check: "size-5 rounded-md ring-1 ring-primary", checkOn: "size-5 rounded-md bg-brand-solid text-white",
    },
    {
        id: "B", name: "Crisp", note: "Small radius, hairline borders, no fills. Calm and precise, like Stripe or Linear.",
        btn: "h-10 rounded-lg px-4 text-sm font-medium transition",
        primary: `${INV} hover:opacity-90`,
        secondary: "bg-primary text-secondary ring-1 ring-primary ring-inset shadow-xs hover:bg-primary_hover",
        ghost: "text-tertiary hover:text-primary hover:bg-primary_hover",
        field: "h-10 rounded-lg bg-primary px-3 text-sm text-primary shadow-xs ring-1 ring-primary ring-inset placeholder:text-placeholder focus-within:ring-2 focus-within:ring-brand",
        label: "text-sm font-medium text-secondary",
        card: "rounded-xl bg-primary p-4 ring-1 ring-secondary",
        cover: "rounded-lg",
        stat: "rounded-xl bg-primary p-5 ring-1 ring-secondary",
        statIcon: "rounded-lg ring-1 ring-secondary text-tertiary",
        track: "h-1.5 rounded-full bg-tertiary", fill: "rounded-full bg-fg-primary",
        step: "size-7 rounded-md ring-1 ring-primary text-tertiary", stepOn: `size-7 rounded-md ${INV}`, stepDone: "size-7 rounded-md bg-secondary text-secondary ring-1 ring-secondary",
        badge: "rounded-md px-2 py-0.5 text-xs font-medium text-secondary ring-1 ring-primary ring-inset",
        seg: "rounded-lg ring-1 ring-primary ring-inset p-0.5", segOn: "rounded-md bg-secondary text-primary", segOff: "rounded-md text-tertiary hover:text-primary",
        check: "size-4 rounded ring-1 ring-primary", checkOn: `size-4 rounded ${INV}`,
    },
    {
        id: "C", name: "Bold", note: "Thick outlines and hard offset shadows. Loud and playful, fits a competitive leaderboard.",
        btn: "h-12 rounded-xl px-5 text-sm font-bold border-2 border-fg-primary shadow-[3px_3px_0_0_var(--color-fg-primary)] transition hover:-translate-y-0.5 hover:shadow-[4px_5px_0_0_var(--color-fg-primary)] active:translate-y-0.5 active:shadow-none",
        primary: "bg-brand-solid text-white",
        secondary: "bg-primary text-primary",
        ghost: "!border-transparent !shadow-none text-primary underline underline-offset-4 decoration-2",
        field: "h-12 rounded-xl border-2 border-fg-primary bg-primary px-4 text-sm font-medium text-primary placeholder:text-placeholder focus-within:shadow-[3px_3px_0_0_var(--color-fg-primary)]",
        label: "text-sm font-bold text-primary",
        card: "rounded-2xl border-2 border-fg-primary bg-primary p-4 shadow-[5px_5px_0_0_var(--color-fg-primary)]",
        cover: "rounded-lg border-2 border-fg-primary",
        stat: "rounded-2xl border-2 border-fg-primary bg-brand-solid p-5 text-white shadow-[5px_5px_0_0_var(--color-fg-primary)]",
        statIcon: "rounded-lg border-2 border-white/80",
        track: "h-4 rounded-full border-2 border-fg-primary bg-primary", fill: "rounded-full bg-brand-solid",
        step: "size-9 rounded-lg border-2 border-fg-primary bg-primary text-primary font-bold", stepOn: "size-9 rounded-lg border-2 border-fg-primary bg-brand-solid text-white font-bold shadow-[2px_2px_0_0_var(--color-fg-primary)]", stepDone: `size-9 rounded-lg border-2 border-fg-primary ${INV}`,
        badge: "rounded-md border-2 border-fg-primary bg-warning-secondary px-2 py-0.5 text-xs font-bold text-primary",
        seg: "rounded-xl border-2 border-fg-primary p-1", segOn: `rounded-lg ${INV}`, segOff: "rounded-lg text-primary",
        check: "size-5 rounded-md border-2 border-fg-primary", checkOn: "size-5 rounded-md border-2 border-fg-primary bg-brand-solid text-white",
    },
    {
        id: "D", name: "Elevated", note: "Gradients, layered depth and a glow on focus. Premium and modern, made for big screens.",
        btn: "h-11 rounded-2xl px-5 text-sm font-semibold transition",
        primary: "bg-gradient-to-b from-brand-500 to-brand-700 text-white shadow-[0_8px_20px_-6px_var(--color-brand-600),inset_0_1px_0_0_rgb(255_255_255/0.25)] hover:brightness-110",
        secondary: "bg-primary text-primary shadow-md ring-1 ring-secondary hover:shadow-lg",
        ghost: "text-brand-secondary hover:bg-brand-primary",
        field: "h-11 rounded-2xl bg-primary px-4 text-sm text-primary shadow-sm ring-1 ring-secondary placeholder:text-placeholder focus-within:ring-brand focus-within:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-brand-500)_18%,transparent)]",
        label: "text-xs font-semibold tracking-wide text-tertiary uppercase",
        card: "rounded-[28px] bg-primary p-3 shadow-xl ring-1 ring-secondary",
        cover: "rounded-[20px]",
        stat: "rounded-[28px] bg-gradient-to-br from-brand-500 to-brand-800 p-5 text-white shadow-xl",
        statIcon: "rounded-xl bg-white/15 backdrop-blur",
        track: "h-3 rounded-full bg-secondary shadow-inner", fill: "rounded-full bg-gradient-to-r from-brand-400 to-brand-700 shadow-[0_0_12px_var(--color-brand-500)]",
        step: "size-8 rounded-xl bg-primary text-tertiary shadow-sm ring-1 ring-secondary", stepOn: "size-8 rounded-xl bg-gradient-to-b from-brand-500 to-brand-700 text-white shadow-lg", stepDone: "size-8 rounded-xl bg-brand-primary text-brand-secondary",
        badge: "rounded-full bg-gradient-to-r from-brand-500 to-brand-700 px-2.5 py-1 text-xs font-semibold text-white shadow-sm",
        seg: "rounded-2xl bg-secondary p-1 shadow-inner", segOn: "rounded-xl bg-primary text-primary shadow-md", segOff: "rounded-xl text-tertiary hover:text-primary",
        check: "size-5 rounded-lg bg-primary shadow-sm ring-1 ring-secondary", checkOn: "size-5 rounded-lg bg-gradient-to-b from-brand-500 to-brand-700 text-white shadow-md",
    },
];

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
    <div className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold tracking-wide text-quaternary uppercase">{title}</h3>
        {children}
    </div>
);

const Preview = ({ d }: { d: Dir }) => {
    const [seg, setSeg] = useState("Week");
    const [on, setOn] = useState(true);
    const pct = 62;
    return (
        <article className="flex min-w-0 flex-col gap-7 rounded-3xl bg-secondary_alt p-5 ring-1 ring-secondary">
            <header>
                <div className="flex items-baseline gap-2"><span className="text-display-xs font-semibold text-brand-secondary">{d.id}</span><h2 className="text-xl font-semibold text-primary">{d.name}</h2></div>
                <p className="mt-1 text-sm text-tertiary">{d.note}</p>
            </header>

            <Section title="Buttons">
                <div className="flex flex-wrap gap-3">
                    <button type="button" className={cx(d.btn, d.primary, "inline-flex cursor-pointer items-center gap-2 outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2")}><Heart className="size-4" />Donate</button>
                    <button type="button" className={cx(d.btn, d.secondary, "cursor-pointer outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2")}>Share</button>
                    <button type="button" className={cx(d.btn, d.ghost, "cursor-pointer outline-focus-ring focus-visible:outline-2")}>Cancel</button>
                </div>
                <button type="button" disabled className={cx(d.btn, d.primary, "w-full cursor-not-allowed opacity-50")}>Disabled</button>
            </Section>

            <Section title="Inputs">
                <label className="flex flex-col gap-1.5"><span className={d.label}>Email</span>
                    <span className={cx(d.field, "flex items-center gap-2")}><Mail01 className="size-4 shrink-0 text-fg-quaternary" /><input className="min-w-0 flex-1 bg-transparent outline-none" placeholder="you@charity.org" /></span>
                </label>
                <label className="flex flex-col gap-1.5"><span className="sr-only">Search</span>
                    <span className={cx(d.field, "flex items-center gap-2")}><SearchLg className="size-4 shrink-0 text-fg-quaternary" /><input type="search" className="min-w-0 flex-1 bg-transparent outline-none" placeholder="Search supporters" /></span>
                </label>
                <label className="flex flex-col gap-1.5"><span className={d.label}>Amount</span>
                    <span className={cx(d.field, "flex items-center gap-2 !ring-error")}><span className="text-tertiary">$</span><input className="min-w-0 flex-1 bg-transparent outline-none" defaultValue="0" /></span>
                    <span className="text-xs text-error-primary">Enter at least $1</span>
                </label>
            </Section>

            <Section title="Toggles">
                <div className={cx("flex w-fit text-sm font-semibold", d.seg)} role="group" aria-label="Period">
                    {["Today", "Week", "All time"].map((s) => <button key={s} type="button" aria-pressed={seg === s} onClick={() => setSeg(s)} className={cx("h-8 cursor-pointer px-3 transition", seg === s ? d.segOn : d.segOff)}>{s}</button>)}
                </div>
                <button type="button" role="checkbox" aria-checked={on} onClick={() => setOn(!on)} className="flex w-fit cursor-pointer items-center gap-2.5 text-sm font-medium text-secondary">
                    <span className={cx("flex items-center justify-center", on ? d.checkOn : d.check)}>{on && <Check className="size-3.5" />}</span>Give monthly
                </button>
            </Section>

            <Section title="Progress">
                <div className="flex flex-col gap-2">
                    <div className="flex justify-between text-sm"><span className="font-semibold text-primary">$18,420 raised</span><span className="text-tertiary">{pct}%</span></div>
                    <div className={cx("overflow-hidden", d.track)}><div className={cx("h-full", d.fill)} style={{ width: `${pct}%` }} /></div>
                </div>
                <ol className="flex items-center gap-2 text-sm" aria-label="Steps">
                    {[1, 2, 3, 4].map((n) => <li key={n} className="flex flex-1 items-center gap-2 last:flex-none"><span className={cx("flex shrink-0 items-center justify-center text-xs font-semibold", n < 2 ? d.stepDone : n === 2 ? d.stepOn : d.step)}>{n < 2 ? <Check className="size-3.5" /> : n}</span>{n < 4 && <span className="h-px flex-1 bg-border-secondary" />}</li>)}
                </ol>
            </Section>

            <Section title="Cards">
                <div className={d.card}>
                    <div className={cx("relative aspect-[16/9] overflow-hidden bg-[radial-gradient(circle_at_30%_20%,var(--color-brand-300),var(--color-brand-600)_70%)]", d.cover)}>
                        <span className={cx("absolute top-3 left-3", d.badge)}>Campaign</span>
                    </div>
                    <div className="flex flex-col gap-3 px-1 pt-4 pb-1">
                        <div><div className="font-semibold text-primary">Clean water for 40 villages</div><div className="text-sm text-tertiary">Clearwell Trust · Kenya</div></div>
                        <div className={cx("overflow-hidden", d.track)}><div className={cx("h-full", d.fill)} style={{ width: `${pct}%` }} /></div>
                        <div className="flex items-center justify-between gap-2"><span className="text-sm"><b className="text-primary">$18,420</b> <span className="text-tertiary">of $30,000</span></span>
                            <button type="button" className={cx(d.btn, d.primary, "!h-9 inline-flex cursor-pointer items-center gap-1 !px-3.5")}>Give<ArrowRight className="size-4" /></button></div>
                    </div>
                </div>
                <div className={d.stat}>
                    <div className="flex items-center justify-between"><span className="text-sm font-medium opacity-80">Supporters</span><span className={cx("flex size-9 items-center justify-center", d.statIcon)}><Users01 className="size-4" /></span></div>
                    <div className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">412</div>
                    <div className="mt-1 text-xs opacity-70">+18 this week</div>
                </div>
            </Section>

            <Section title="Badges">
                <div className="flex flex-wrap gap-2"><span className={d.badge}>Campaign</span><span className={d.badge}>#1 this week</span><span className={d.badge}>Monthly</span></div>
            </Section>
        </article>
    );
};

export const Variants = () => (
    <div className="min-h-dvh bg-primary">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-4 py-10 md:px-8">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div><h1 className="text-display-xs font-semibold text-primary">Pick a direction</h1><p className="mt-1 max-w-2xl text-tertiary">The same components in four styles. Choose one overall, or mix: for example A buttons with D cards. Toggle dark mode to check both themes.</p></div>
                <ThemeToggle />
            </header>
            <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-4">{DIRS.map((d) => <Preview key={d.id} d={d} />)}</div>
        </div>
    </div>
);
