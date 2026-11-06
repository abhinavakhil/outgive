import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { ArrowUp, Check, Copy01, Download01, Heart, Share07 } from "@untitledui/icons";
import { Button, ShareDialog, BrandMark, Container, SiteHeader, Confetti } from "@/shared/ui";
import { useApp } from "@/shared/lib/app-context";
import { fmt } from "@/shared/lib/money";
import { CURRENCIES, PREFIX, type PageType } from "@/shared/domain/model";

interface Lookup {
    id: string; name: string; amount_cents: number; currency: string; tip_cents: number; cover_cents: number; status: string; recurring: boolean; claimed_rank: number | null; message: string; cause: string; created_at: string; email_hint: string | null;
    page: { type: PageType; slug: string; title: string; raised_cents: number; goal_cents: number } | null; org: { slug: string; name: string }; supporter: { id: string; name: string } | null;
}

/**
 * After Checkout (or a demo gift): a receipt the donor can keep, what the gift did, where they stand on the board and the one next
 * step that matters. The webhook may land a moment after the redirect, so a pending gift is polled a few times.
 */
export const Thanks = ({ gref }: { gref?: string }) => {
    const { db, org, brand, go, href, setMe, board, isDemo, toast } = useApp();
    const [d, setD] = useState<Lookup | null | undefined>(undefined);
    const [share, setShare] = useState(false);
    const [confetti, setConfetti] = useState(0);
    useEffect(() => {
        let tries = 0; let stop = false;
        const look = async () => {
            const r = await db.rpc<Lookup | null>("thanks_lookup", { session: gref?.startsWith("cs_") ? gref : null, gift: gref && !gref.startsWith("cs_") ? gref : null }).catch(() => null);
            if (stop) return;
            setD(r);
            if (r?.status === "pending" && tries++ < 10) setTimeout(look, 1500);
            if (r?.supporter?.id && r.status === "succeeded") { setMe(r.supporter.id); setConfetti(Date.now()); }
        };
        look(); return () => { stop = true; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const ranked = useMemo(() => [...board].sort((a, b) => b.total - a.total), [board]);
    const rank = d?.supporter ? ranked.findIndex((s) => s.id === d.supporter!.id) + 1 : 0;
    const above = rank > 1 ? ranked[rank - 2] : null;
    const mine = rank > 0 ? ranked[rank - 1] : null;
    const toClimb = above && mine ? Math.max(1, Math.round(above.total - mine.total + 1)) : 0;
    const usd = d ? d.amount_cents / 100 / (CURRENCIES[d.currency] ?? 1) : 0;
    const impactN = brand.impact && brand.impact.usd > 0 ? usd / brand.impact.usd : 0;
    const total = d ? d.amount_cents + d.tip_cents + d.cover_cents : 0;
    const pageUrl = d?.page ? `${window.location.origin}${href({ name: "page", org: org?.slug ?? d.org.slug, page: d.page })}` : `${window.location.origin}${href({ name: "home" })}`;
    const pct = d?.page && d.page.goal_cents > 0 ? Math.min(100, Math.round((d.page.raised_cents / d.page.goal_cents) * 100)) : null;
    const title = d?.page?.title ?? d?.org.name ?? brand.name;
    const shareText = d ? `I just gave to ${title}${d.cause ? ` (${d.cause.toLowerCase()})` : ""}. Join me:` : "";
    const first = d && d.name !== "Anonymous" ? d.name.split(" ")[0] : "";
    const when = d ? new Date(d.created_at).toLocaleString("en", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

    const copyRef = () => { if (!d) return; navigator.clipboard?.writeText(d.id).then(() => toast("Reference copied")).catch(() => toast(d.id)); };
    const print = () => window.print();

    return (
        <div className="min-h-dvh bg-primary">
            {confetti > Date.now() - 6000 && <Confetti at={confetti} />}
            <Container className="flex max-w-2xl flex-col gap-6 py-5 print:hidden"><SiteHeader /></Container>
            <Container className="flex max-w-2xl flex-col gap-6 pb-16">
                {d === undefined && <div className="flex items-center gap-3 rounded-[28px] bg-tint-1 px-6 py-8 text-sm text-ink-3"><span className="size-4 animate-spin rounded-full border-2 border-ink border-t-transparent" />Confirming your gift…</div>}
                {d === null && <div className="flex flex-col gap-3 rounded-[28px] bg-tint-1 p-8"><h1 className="text-display-xs leading-[0.95] font-extrabold tracking-[-0.045em] text-ink">We could not find that gift</h1><p className="text-ink-3">If you paid, you will still get a receipt by email. Otherwise go back to the page and try again.</p><Button color="secondary" className="w-fit rounded-full" onPress={() => go({ name: "home" })}>Back to the board</Button></div>}
                {d && d.status !== "succeeded" && <div className="flex flex-col gap-3 rounded-[28px] bg-tint-1 p-8">
                    <h1 className="text-display-xs leading-[0.95] font-extrabold tracking-[-0.045em] text-ink">{d.status === "pending" ? "Almost there" : "This gift did not go through"}</h1>
                    <p className="text-ink-3">{d.status === "pending" ? "Your payment is being confirmed. This page updates by itself; you can also close it, the receipt arrives by email." : "Nothing was taken. You can try again from the page."}</p>
                    {d.status === "pending" && <span className="size-4 animate-spin rounded-full border-2 border-ink border-t-transparent" />}
                    {d.page && d.status !== "pending" && <Button color="primary" className="w-fit rounded-full" onPress={() => go({ name: "page", org: org?.slug ?? d.org.slug, page: d.page! })}>Back to {d.page.title}</Button>}
                </div>}
                {d && d.status === "succeeded" && <>
                    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[28px] bg-tint-1 p-7 text-ink md:p-9">
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-full bg-ink text-ink-inverse"><Check className="size-5 stroke-[3px]" /></span><span className="text-sm font-semibold text-ink-3">{d.recurring ? "Monthly gift started" : "Gift received"}</span></div>
                            <h1 className="text-display-sm leading-[0.95] font-extrabold tracking-[-0.045em] md:text-display-md">Thank you{first ? `, ${first}` : ""}.</h1>
                            <p className="max-w-lg text-lg text-ink-2">Your {d.recurring ? "monthly " : ""}gift of <b className="font-bubble font-bold text-ink tabular-nums">{fmt(d.amount_cents, d.currency)}</b> to <b className="font-semibold text-ink">{title}</b>{d.cause ? <> funds <b className="font-semibold text-ink">{d.cause.toLowerCase()}</b></> : impactN >= 1 ? <> is enough for <b className="font-semibold text-ink">{Math.floor(impactN).toLocaleString("en")} {impactN >= 2 ? brand.impact!.unit : brand.impact!.unit.replace(/s$/, "")}</b></> : null}.</p>
                            {pct !== null && d.page && <div className="flex flex-col gap-2 pt-1"><div className="h-1.5 overflow-hidden rounded-full bg-tint-3"><motion.div className="h-full rounded-full bg-ink" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 50, damping: 16, delay: 0.3 }} /></div><div className="flex flex-col gap-1 text-sm text-ink-3 sm:flex-row sm:justify-between"><span>{title} is now at <span className="font-bubble font-bold tabular-nums">{pct}%</span> of <span className="font-bubble font-bold tabular-nums">{fmt(d.page.goal_cents, d.currency)}</span></span><span><span className="font-bubble font-bold tabular-nums">{fmt(d.page.raised_cents, d.currency)}</span> raised</span></div></div>}
                        </div>
                    </motion.section>

                    <div className="grid gap-4 md:grid-cols-2">
                        <section className="flex flex-col gap-4 rounded-[28px] bg-tint-1 p-6">
                            <div className="flex items-center gap-3"><BrandMark className="size-9 rounded-xl text-sm" /><div className="min-w-0"><div className="text-sm font-semibold text-ink">Receipt from {d.org.name}</div><div className="truncate text-xs text-ink-3">{when}</div></div></div>
                            <dl className="flex flex-col divide-y divide-hairline text-sm">
                                <div className="flex justify-between py-2"><dt className="text-ink-3">Gift{d.recurring ? " (monthly)" : ""}</dt><dd className="font-bubble font-bold text-ink tabular-nums">{fmt(d.amount_cents, d.currency)}</dd></div>
                                {d.tip_cents > 0 && <div className="flex justify-between py-2"><dt className="text-ink-3">Tip to Outgive</dt><dd className="font-bubble font-bold text-ink tabular-nums">{fmt(d.tip_cents, d.currency)}</dd></div>}
                                {d.cover_cents > 0 && <div className="flex justify-between py-2"><dt className="text-ink-3">Card fees covered</dt><dd className="font-bubble font-bold text-ink tabular-nums">{fmt(d.cover_cents, d.currency)}</dd></div>}
                                <div className="flex justify-between py-2"><dt className="font-semibold text-ink">{isDemo ? "Would be charged" : "Charged"}</dt><dd className="font-bubble font-bold text-ink tabular-nums">{fmt(total, d.currency)}</dd></div>
                                <div className="flex justify-between gap-3 py-2"><dt className="text-ink-3">Reference</dt><dd className="min-w-0 truncate font-mono text-xs text-ink-2">{d.id}</dd></div>
                            </dl>
                            <p className="text-xs text-ink-3">{isDemo ? "Demo: nothing was charged and no email was sent." : d.email_hint ? `A copy is on its way to ${d.email_hint}.` : "Keep this page as your record."} Paid to {d.org.name} through Stripe; whether a gift is tax-deductible depends on the charity and where you live.</p>
                            <div className="flex flex-wrap gap-2 print:hidden"><Button size="sm" color="secondary" className="rounded-full" iconLeading={Copy01} onPress={copyRef}>Copy reference</Button><Button size="sm" color="secondary" className="rounded-full" iconLeading={Download01} onPress={print}>Save as PDF</Button></div>
                        </section>

                        <section className="flex flex-col gap-4 rounded-[28px] bg-tint-1 p-6 print:hidden">
                            {d.supporter && rank > 0 ? <>
                                <div className="flex items-center gap-4"><span className="flex size-14 shrink-0 items-center justify-center rounded-[18px] bg-ink font-bubble text-xl font-bold text-ink-inverse tabular-nums">#{rank}</span><div><div className="font-semibold text-ink">{d.supporter.name} on the {org?.name ?? d.org.name} board</div><div className="text-sm text-ink-3">{rank === 1 ? "Top of the board. Nobody has given more." : rank === ranked.length ? "On the board. Every gift from here climbs it." : `${ranked.length - rank} supporters are behind you.`}</div></div></div>
                                {above && toClimb > 0 && <div className="flex flex-col gap-2 rounded-[18px] bg-raised p-4 shadow-edge"><div className="text-sm text-ink-2"><b className="font-bubble font-bold text-ink tabular-nums">{fmt(Math.round(toClimb * (CURRENCIES[d.currency] ?? 1) * 100), d.currency)}</b> more passes <b className="font-semibold text-ink">{above.name}</b> for <span className="font-bubble font-bold tabular-nums">#{rank - 1}</span>.</div><Button size="sm" color="primary" className="w-fit rounded-full" iconLeading={ArrowUp} onPress={() => go({ name: "home" })}>Climb to #{rank - 1}</Button></div>}
                            </> : <div className="flex items-center gap-4"><span className="flex size-14 shrink-0 items-center justify-center rounded-[18px] bg-ink text-ink-inverse"><Heart className="size-6" /></span><div><div className="font-semibold text-ink">Every gift counts on the board</div><div className="text-sm text-ink-3">Give with your name next time to hold a rank for {org?.name ?? d.org.name}.</div></div></div>}
                            <div className="mt-auto flex flex-col gap-2 pt-2">
                                <div className="text-sm font-semibold text-ink">Double it: tell three people</div>
                                <div className="flex flex-wrap gap-2">
                                    <a className="inline-flex h-8 items-center rounded-full bg-raised px-3.5 text-sm font-semibold text-ink shadow-edge transition duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-raised-hover" href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${pageUrl}`)}`} target="_blank" rel="noopener">WhatsApp</a>
                                    <a className="inline-flex h-8 items-center rounded-full bg-raised px-3.5 text-sm font-semibold text-ink shadow-edge transition duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-raised-hover" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(pageUrl)}`} target="_blank" rel="noopener">X</a>
                                    <Button size="sm" color="primary" className="rounded-full" iconLeading={Share07} onPress={() => setShare(true)}>More ways</Button>
                                </div>
                            </div>
                        </section>
                    </div>

                    <section className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] bg-tint-1 p-6 print:hidden">
                        <div className="min-w-0"><div className="font-semibold text-ink">Raise more than you can give</div><p className="text-sm text-ink-3">Start your own page for {d.page?.title ?? d.org.name}. Every gift to it counts toward your rank.</p></div>
                        <div className="flex flex-wrap gap-2">
                            <Button color="primary" className="rounded-full" onPress={() => go({ name: "create", parent: d.page ? `${PREFIX[d.page.type]}/${d.page.slug}` : undefined })}>Start fundraising</Button>
                            {d.page ? <Button color="secondary" className="rounded-full" onPress={() => go({ name: "page", org: org?.slug ?? d.org.slug, page: d.page! })}>Back to the page</Button> : <Button color="secondary" className="rounded-full" onPress={() => go({ name: "home" })}>See the board</Button>}
                        </div>
                    </section>
                </>}
                <ShareDialog isOpen={share} onClose={() => setShare(false)} url={pageUrl} title={title} />
            </Container>
        </div>
    );
};
export const pagePath = (p: { type: PageType; slug: string }) => `/${PREFIX[p.type]}/${p.slug}`;
