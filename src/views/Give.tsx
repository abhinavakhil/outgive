import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Heart } from "@untitledui/icons";
import { DonateDialog, ShareDialog } from "@/components/outgive/dialogs";
import { BrandMark, useApp } from "@/components/outgive/shared";
import { initials } from "@/data";
import type { PageRef } from "@/lib/route";
import type { LiveItem } from "@/lib/types";
import { useCountUp, useLive } from "@/views/Live";
import { cx } from "@/utils/cx";

/**
 * The phone screen behind the QR code on a live screen. One thumb-reach list: pick what to fund (the impact items the presenter set),
 * or give any amount. The total and the feed update live, so the person in the room sees their own gift land within a second.
 */
export const Give = ({ pageRef }: { pageRef?: PageRef }) => {
    const { org, brand, board, money, href, go } = useApp();
    const { bundle, recent, state, totalUsd, goalUsd, items, fundedToday } = useLive(pageRef);
    const [gift, setGift] = useState<{ usd: number; cause?: string } | null>(null);
    const [share, setShare] = useState(false);
    const shown = useCountUp(totalUsd);
    const pct = goalUsd > 0 ? Math.min(100, (totalUsd / goalUsd) * 100) : 0;
    const title = bundle ? bundle.page.title : brand.tagline;
    const supporters = bundle ? bundle.page.donor_count : board.length;
    const anyAmount = bundle?.page.gifts?.[1] ?? 50;
    const feed = useMemo(() => recent.slice(0, 8), [recent]);
    if (!org) return null;
    const pageUrl = `${window.location.origin}${pageRef ? href({ name: "page", org: org.slug, page: pageRef }) : href({ name: "home" })}`;
    return (
        <div className="min-h-dvh bg-primary" style={{ fontFamily: `"${brand.font}", ui-sans-serif, system-ui` }}>
            <header className="relative overflow-hidden px-5 pt-6 pb-8 text-white" style={{ background: "linear-gradient(135deg, var(--color-brand-700), var(--color-brand-500) 60%, var(--color-brand-400))" }}>
                <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-white/10 blur-2xl" />
                <div className="relative mx-auto flex max-w-lg flex-col gap-5">
                    <div className="flex items-center gap-3"><BrandMark className="size-11 rounded-xl text-base" /><div className="min-w-0"><div className="truncate text-lg leading-tight font-semibold">{brand.name}</div><div className="truncate text-sm text-white/80">{title}</div></div><span className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium"><span className="relative inline-flex size-1.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-300 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-emerald-300" /></span>Live</span></div>
                    {state.ask && <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-white/15 px-4 py-3 text-sm font-medium backdrop-blur">{state.ask}{state.ask_usd ? <span className="ml-2 rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-neutral-900">{money(state.ask_usd)}</span> : null}</motion.div>}
                    <div>
                        <div className="text-xs tracking-[0.18em] text-white/70 uppercase">Raised so far</div>
                        <div className="mt-1 text-[2.75rem] leading-none font-bold tracking-tight tabular-nums">{money(Math.round(shown))}</div>
                        <div className="mt-2 text-sm text-white/80">{supporters.toLocaleString("en")} supporters{goalUsd > 0 && <> · {Math.round(pct)}% of {money(goalUsd)}</>}</div>
                        {goalUsd > 0 && <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/20"><motion.div className="h-full rounded-full bg-white" animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 60, damping: 18 }} /></div>}
                    </div>
                </div>
            </header>

            <main className="mx-auto -mt-4 flex max-w-lg flex-col gap-6 px-4 pb-16">
                <section className="flex flex-col gap-3 rounded-3xl bg-primary p-4 shadow-lg ring-1 ring-secondary ring-inset">
                    <div className="px-1"><h1 className="text-lg font-semibold text-primary">{items.length ? "What will you fund?" : "Make your gift"}</h1><p className="text-sm text-tertiary">{items.length ? "Pick one, then pay on your phone. Your name lands on the screen in the room." : "Pay on your phone. Your name lands on the screen in the room."}</p></div>
                    <ul className="flex flex-col gap-2">
                        {items.map((it) => <li key={it.label}><ItemButton item={it} count={fundedToday[it.label] ?? 0} onPress={() => setGift({ usd: it.usd, cause: it.label })} money={money} /></li>)}
                        <li><button type="button" onClick={() => setGift({ usd: anyAmount })} className="flex w-full cursor-pointer items-center gap-4 rounded-2xl bg-secondary px-4 py-4 text-left ring-1 ring-secondary ring-inset outline-focus-ring hover:bg-tertiary focus-visible:outline-2"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-solid text-white"><Heart className="size-5" /></span><span className="min-w-0 flex-1"><span className="block font-semibold text-primary">Give any amount</span><span className="block text-sm text-tertiary">Once or monthly, from {money(1)}</span></span><ArrowRight className="size-5 shrink-0 text-tertiary" /></button></li>
                    </ul>
                </section>

                <section className="flex flex-col gap-3">
                    <h2 className="px-1 text-sm font-semibold tracking-wide text-tertiary uppercase">Just now in the room</h2>
                    <ul className="flex flex-col gap-2">
                        <AnimatePresence initial={false}>{feed.map((g, i) => (
                            <motion.li key={`${g.at}-${g.who}-${i}`} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 rounded-2xl bg-primary px-4 py-3 ring-1 ring-secondary ring-inset">
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-secondary text-xs font-bold text-brand-secondary">{initials(g.who) || "A"}</span>
                                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-primary">{g.who}</span>{(g.cause || g.message) && <span className="block truncate text-xs text-tertiary">{g.cause ? `for ${g.cause.toLowerCase()}` : `“${g.message}”`}</span>}</span>
                                <span className="text-sm font-bold text-primary tabular-nums">{money(g.usd)}</span>
                            </motion.li>
                        ))}</AnimatePresence>
                        {feed.length === 0 && <li className="rounded-2xl bg-secondary px-4 py-5 text-center text-sm text-tertiary">The first gift of the night appears here.</li>}
                    </ul>
                </section>

                <div className="flex flex-col items-center gap-2 pt-2 text-center text-xs text-tertiary">
                    <button type="button" onClick={() => go(pageRef ? { name: "page", org: org.slug, page: pageRef } : { name: "home" })} className="cursor-pointer font-semibold text-brand-secondary hover:underline">{pageRef ? "See the full page" : "See the leaderboard"}</button>
                    {!org.remove_branding && <span>Powered by Outgive</span>}
                </div>
            </main>

            <DonateDialog target={{ org, page: bundle?.page ?? null, title, gifts: bundle?.page.gifts ?? [25, 50, 100, 250], tickets: bundle?.tickets, cause: gift?.cause }} isOpen={gift !== null} initial={gift?.usd ?? anyAmount} onClose={() => setGift(null)} onShare={() => { setGift(null); setShare(true); }} />
            <ShareDialog isOpen={share} onClose={() => setShare(false)} title={title} url={pageUrl} />
        </div>
    );
};

const ItemButton = ({ item, count, onPress, money }: { item: LiveItem; count: number; onPress: () => void; money: (usd: number) => string }) => (
    <button type="button" onClick={onPress} className={cx("group flex w-full cursor-pointer items-center gap-4 rounded-2xl px-4 py-4 text-left ring-1 ring-inset outline-focus-ring transition hover:-translate-y-px focus-visible:outline-2", "bg-primary ring-secondary hover:ring-brand")}>
        <span className="min-w-0 flex-1"><span className="block font-semibold text-primary">{item.label}</span><span className="block text-sm text-tertiary">{count > 0 ? `${count} funded today` : "Be the first tonight"}</span></span>
        <span className="shrink-0 rounded-full bg-brand-solid px-3.5 py-1.5 text-sm font-bold text-white tabular-nums group-hover:bg-brand-solid_hover">{money(item.usd)}</span>
    </button>
);
