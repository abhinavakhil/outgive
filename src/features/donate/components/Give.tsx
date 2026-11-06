import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Heart } from "@untitledui/icons";
import { DonateDialog } from "@/features/donate/components/dialogs";
import { ShareDialog, BrandMark } from "@/shared/ui";
import { useApp } from "@/shared/lib/app-context";
import { initials } from "@/shared/lib/format";
import type { PageRef } from "@/shared/lib/route";
import type { LiveItem } from "@/shared/domain/types";
import { useCountUp, useLive } from "@/features/live";
import { cx } from "@/shared/utils/cx";

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
            <header className="px-4 pt-6 pb-6">
                <div className="mx-auto flex max-w-lg flex-col gap-5">
                    <div className="flex items-center gap-3"><BrandMark className="size-11 rounded-xl text-base" /><div className="min-w-0"><div className="truncate text-lg leading-tight font-semibold tracking-tight text-ink">{brand.name}</div><div className="truncate text-sm text-ink-3">{title}</div></div><span className="ml-auto inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-tint-2 px-2.5 text-xs font-semibold text-ink-2"><span className="relative inline-flex size-1.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" /></span>Live</span></div>
                    {state.ask && <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-tint-1 px-4 py-3 text-sm font-medium text-ink">{state.ask}{state.ask_usd ? <span className="ml-2 inline-flex h-6 items-center rounded-full bg-ink px-2.5 font-semibold text-xs font-bold text-ink-inverse tabular-nums">{money(state.ask_usd)}</span> : null}</motion.div>}
                    <div>
                        <div className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Raised so far</div>
                        <div className="mt-1 font-bubble text-[2.75rem] leading-none font-bold text-ink tabular-nums">{money(Math.round(shown))}</div>
                        <div className="mt-2 text-sm text-ink-3"><span className="font-semibold tabular-nums">{supporters.toLocaleString("en")}</span> supporters{goalUsd > 0 && <> · <span className="font-semibold tabular-nums">{Math.round(pct)}%</span> of <span className="font-semibold tabular-nums">{money(goalUsd)}</span></>}</div>
                        {goalUsd > 0 && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-tint-3"><motion.div className="h-full rounded-full bg-ink" animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 60, damping: 18 }} /></div>}
                    </div>
                </div>
            </header>

            <main className="mx-auto flex max-w-lg flex-col gap-6 px-4 pb-16">
                <section className="flex flex-col gap-3 rounded-3xl bg-tint-1 p-4">
                    <div className="px-1"><h1 className="text-lg font-semibold tracking-tight text-ink">{items.length ? "What will you fund?" : "Make your gift"}</h1><p className="text-sm text-ink-3">{items.length ? "Pick one, then pay on your phone. Your name lands on the screen in the room." : "Pay on your phone. Your name lands on the screen in the room."}</p></div>
                    <ul className="flex flex-col gap-2">
                        {items.map((it) => <li key={it.label}><ItemButton item={it} count={fundedToday[it.label] ?? 0} onPress={() => setGift({ usd: it.usd, cause: it.label })} money={money} /></li>)}
                        <li><button type="button" onClick={() => setGift({ usd: anyAmount })} className="flex w-full cursor-pointer items-center gap-4 rounded-2xl bg-raised px-4 py-4 text-left shadow-edge outline-focus-ring transition duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-raised-hover focus-visible:outline-2"><span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-ink-inverse"><Heart className="size-5" /></span><span className="min-w-0 flex-1"><span className="block font-semibold text-ink">Give any amount</span><span className="block text-sm text-ink-3">Once or monthly, from <span className="font-semibold tabular-nums">{money(1)}</span></span></span><ArrowRight className="size-5 shrink-0 text-ink-3" /></button></li>
                    </ul>
                </section>

                <section className="flex flex-col gap-3">
                    <h2 className="px-1 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Just now in the room</h2>
                    <ul className="flex flex-col gap-2">
                        <AnimatePresence initial={false}>{feed.map((g, i) => (
                            <motion.li key={`${g.at}-${g.who}-${i}`} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 rounded-2xl bg-tint-1 px-4 py-3">
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-pop-100 text-xs font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">{initials(g.who) || "A"}</span>
                                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{g.who}</span>{(g.cause || g.message) && <span className="block truncate text-xs text-ink-3">{g.cause ? `for ${g.cause.toLowerCase()}` : `“${g.message}”`}</span>}</span>
                                <span className="font-bubble text-sm font-bold text-ink tabular-nums">{money(g.usd)}</span>
                            </motion.li>
                        ))}</AnimatePresence>
                        {feed.length === 0 && <li className="rounded-2xl bg-tint-1 px-4 py-5 text-center text-sm text-ink-3">The first gift of the night appears here.</li>}
                    </ul>
                </section>

                <div className="flex flex-col items-center gap-2 pt-2 text-center text-xs text-ink-3">
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
    <button type="button" onClick={onPress} className={cx("group flex w-full cursor-pointer items-center gap-4 rounded-2xl px-4 py-4 text-left outline-focus-ring focus-visible:outline-2", "bg-raised shadow-edge transition duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-raised-hover")}>
        <span className="min-w-0 flex-1"><span className="block font-semibold text-ink">{item.label}</span><span className="block text-sm text-ink-3">{count > 0 ? `${count} funded today` : "Be the first tonight"}</span></span>
        <span className="inline-flex h-8 shrink-0 items-center rounded-full bg-ink px-3.5 font-bubble text-sm font-bold text-ink-inverse tabular-nums transition duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-90">{money(item.usd)}</span>
    </button>
);
