import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { ArrowUp, Check, Copy01, Download01, Heart, Share07 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { ShareDialog } from "@/components/outgive/dialogs";
import { BrandMark, Container, SiteHeader, useApp } from "@/components/outgive/shared";
import { fmt } from "@/lib/money";
import { CURRENCIES, PREFIX, type PageType } from "@/data";
import { Confetti } from "@/views/Live";

interface Lookup {
    id: string; name: string; amount_cents: number; currency: string; tip_cents: number; cover_cents: number; status: string; recurring: boolean; claimed_rank: number | null; message: string; cause: string; created_at: string; email_hint: string | null;
    page: { type: PageType; slug: string; title: string; raised_cents: number; goal_cents: number } | null; org: { slug: string; name: string }; supporter: { id: string; name: string } | null;
}

/**
 * After Checkout (or a demo gift): a receipt the donor can keep, what the gift did, where they stand on the board and the one next
 * step that matters. The webhook may land a moment after the redirect, so a pending gift is polled a few times.
 */
export const Thanks = () => {
    const { db, org, brand, go, href, setMe, board, isDemo, toast } = useApp();
    const q = new URLSearchParams(window.location.search);
    const [d, setD] = useState<Lookup | null | undefined>(undefined);
    const [share, setShare] = useState(false);
    const [confetti, setConfetti] = useState(0);
    useEffect(() => {
        let tries = 0; let stop = false;
        const look = async () => {
            const r = await db.rpc<Lookup | null>("thanks_lookup", { session: q.get("session_id"), gift: q.get("donation") }).catch(() => null);
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
                {d === undefined && <div className="flex items-center gap-3 rounded-3xl bg-secondary px-6 py-8 text-sm text-tertiary"><span className="size-4 animate-spin rounded-full border-2 border-brand-solid border-t-transparent" />Confirming your gift…</div>}
                {d === null && <div className="flex flex-col gap-3 rounded-3xl bg-secondary p-8"><h1 className="text-display-xs font-semibold text-primary">We could not find that gift</h1><p className="text-tertiary">If you paid, you will still get a receipt by email. Otherwise go back to the page and try again.</p><Button color="secondary" className="w-fit rounded-full" onPress={() => go({ name: "home" })}>Back to the board</Button></div>}
                {d && d.status !== "succeeded" && <div className="flex flex-col gap-3 rounded-3xl bg-secondary p-8">
                    <h1 className="text-display-xs font-semibold text-primary">{d.status === "pending" ? "Almost there" : "This gift did not go through"}</h1>
                    <p className="text-tertiary">{d.status === "pending" ? "Your payment is being confirmed. This page updates by itself; you can also close it, the receipt arrives by email." : "Nothing was taken. You can try again from the page."}</p>
                    {d.status === "pending" && <span className="size-4 animate-spin rounded-full border-2 border-brand-solid border-t-transparent" />}
                    {d.page && d.status !== "pending" && <Button color="primary" className="w-fit rounded-full" onPress={() => go({ name: "page", org: org?.slug ?? d.org.slug, page: d.page! })}>Back to {d.page.title}</Button>}
                </div>}
                {d && d.status === "succeeded" && <>
                    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-3xl p-7 text-white md:p-9" style={{ background: "linear-gradient(135deg, var(--color-brand-700), var(--color-brand-500) 60%, var(--color-brand-400))" }}>
                        <div aria-hidden="true" className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-white/10 blur-2xl" />
                        <div className="relative flex flex-col gap-4">
                            <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-full bg-white text-brand-600"><Check className="size-5 stroke-[3px]" /></span><span className="text-sm font-medium text-white/80">{d.recurring ? "Monthly gift started" : "Gift received"}</span></div>
                            <h1 className="text-display-sm leading-tight font-semibold md:text-display-md">Thank you{first ? `, ${first}` : ""}.</h1>
                            <p className="max-w-lg text-lg text-white/90">Your {d.recurring ? "monthly " : ""}gift of <b className="text-white">{fmt(d.amount_cents, d.currency)}</b> to <b className="text-white">{title}</b>{d.cause ? <> funds <b className="text-white">{d.cause.toLowerCase()}</b></> : impactN >= 1 ? <> is enough for <b className="text-white">{Math.floor(impactN).toLocaleString("en")} {impactN >= 2 ? brand.impact!.unit : brand.impact!.unit.replace(/s$/, "")}</b></> : null}.</p>
                            {pct !== null && d.page && <div className="flex flex-col gap-2 pt-1"><div className="h-2.5 overflow-hidden rounded-full bg-white/25"><motion.div className="h-full rounded-full bg-white" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 50, damping: 16, delay: 0.3 }} /></div><div className="flex flex-col gap-1 text-sm text-white/85 sm:flex-row sm:justify-between"><span>{title} is now at {pct}% of {fmt(d.page.goal_cents, d.currency)}</span><span>{fmt(d.page.raised_cents, d.currency)} raised</span></div></div>}
                        </div>
                    </motion.section>

                    <div className="grid gap-4 md:grid-cols-2">
                        <section className="flex flex-col gap-4 rounded-3xl bg-primary p-6 ring-1 ring-secondary ring-inset">
                            <div className="flex items-center gap-3"><BrandMark className="size-9 rounded-xl text-sm" /><div className="min-w-0"><div className="text-sm font-semibold text-primary">Receipt from {d.org.name}</div><div className="truncate text-xs text-tertiary">{when}</div></div></div>
                            <dl className="flex flex-col divide-y divide-secondary text-sm">
                                <div className="flex justify-between py-2"><dt className="text-tertiary">Gift{d.recurring ? " (monthly)" : ""}</dt><dd className="font-semibold text-primary tabular-nums">{fmt(d.amount_cents, d.currency)}</dd></div>
                                {d.tip_cents > 0 && <div className="flex justify-between py-2"><dt className="text-tertiary">Tip to Outgive</dt><dd className="text-primary tabular-nums">{fmt(d.tip_cents, d.currency)}</dd></div>}
                                {d.cover_cents > 0 && <div className="flex justify-between py-2"><dt className="text-tertiary">Card fees covered</dt><dd className="text-primary tabular-nums">{fmt(d.cover_cents, d.currency)}</dd></div>}
                                <div className="flex justify-between py-2"><dt className="font-semibold text-primary">{isDemo ? "Would be charged" : "Charged"}</dt><dd className="font-bold text-primary tabular-nums">{fmt(total, d.currency)}</dd></div>
                                <div className="flex justify-between gap-3 py-2"><dt className="text-tertiary">Reference</dt><dd className="min-w-0 truncate font-mono text-xs text-secondary">{d.id}</dd></div>
                            </dl>
                            <p className="text-xs text-tertiary">{isDemo ? "Demo: nothing was charged and no email was sent." : d.email_hint ? `A copy is on its way to ${d.email_hint}.` : "Keep this page as your record."} Paid to {d.org.name} through Stripe; whether a gift is tax-deductible depends on the charity and where you live.</p>
                            <div className="flex flex-wrap gap-2 print:hidden"><Button size="sm" color="secondary" className="rounded-full" iconLeading={Copy01} onPress={copyRef}>Copy reference</Button><Button size="sm" color="secondary" className="rounded-full" iconLeading={Download01} onPress={print}>Save as PDF</Button></div>
                        </section>

                        <section className="flex flex-col gap-4 rounded-3xl bg-secondary p-6 print:hidden">
                            {d.supporter && rank > 0 ? <>
                                <div className="flex items-center gap-4"><span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand-solid text-xl font-bold text-white">#{rank}</span><div><div className="font-semibold text-primary">{d.supporter.name} on the {org?.name ?? d.org.name} board</div><div className="text-sm text-tertiary">{rank === 1 ? "Top of the board. Nobody has given more." : rank === ranked.length ? "On the board. Every gift from here climbs it." : `${ranked.length - rank} supporters are behind you.`}</div></div></div>
                                {above && toClimb > 0 && <div className="flex flex-col gap-2 rounded-2xl bg-primary p-4 ring-1 ring-secondary ring-inset"><div className="text-sm text-secondary"><b className="text-primary">{fmt(Math.round(toClimb * (CURRENCIES[d.currency] ?? 1) * 100), d.currency)}</b> more passes <b className="text-primary">{above.name}</b> for #{rank - 1}.</div><Button size="sm" color="primary" className="w-fit rounded-full" iconLeading={ArrowUp} onPress={() => go({ name: "home" })}>Climb to #{rank - 1}</Button></div>}
                            </> : <div className="flex items-center gap-4"><span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand-solid text-white"><Heart className="size-6" /></span><div><div className="font-semibold text-primary">Every gift counts on the board</div><div className="text-sm text-tertiary">Give with your name next time to hold a rank for {org?.name ?? d.org.name}.</div></div></div>}
                            <div className="mt-auto flex flex-col gap-2 pt-2">
                                <div className="text-sm font-semibold text-primary">Double it: tell three people</div>
                                <div className="flex flex-wrap gap-2">
                                    <a className="rounded-full bg-primary px-3.5 py-2 text-sm font-semibold text-primary ring-1 ring-primary ring-inset hover:bg-tertiary" href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${pageUrl}`)}`} target="_blank" rel="noopener">WhatsApp</a>
                                    <a className="rounded-full bg-primary px-3.5 py-2 text-sm font-semibold text-primary ring-1 ring-primary ring-inset hover:bg-tertiary" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(pageUrl)}`} target="_blank" rel="noopener">X</a>
                                    <Button size="sm" color="primary" className="rounded-full" iconLeading={Share07} onPress={() => setShare(true)}>More ways</Button>
                                </div>
                            </div>
                        </section>
                    </div>

                    <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-primary p-6 ring-1 ring-secondary ring-inset print:hidden">
                        <div className="min-w-0"><div className="font-semibold text-primary">Raise more than you can give</div><p className="text-sm text-tertiary">Start your own page for {d.page?.title ?? d.org.name}. Every gift to it counts toward your rank.</p></div>
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
