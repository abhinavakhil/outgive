import { type FC, type ReactNode, useEffect, useRef, useState } from "react";
import { Announcement01, Calendar, Clock, Flag01, Heart, Link01, Users01 } from "@untitledui/icons";
import { ARROW, OgLogo, ShareDialog, Svg, TICK, UP, shareTargets, youtubeId } from "@/shared/ui";
import { DonateDialog } from "@/features/donate";
import { Leaderboard } from "@/features/campaign/components/Leaderboard";
import { useApp } from "@/shared/lib/app-context";
import { type Campaign, campaigns } from "@/shared/lib/campaign-store";
import { PREFIX, typeOf, type Donation } from "@/shared/domain/model";
import type { Org } from "@/shared/domain/types";
import { ago, dateOf, initials } from "@/shared/lib/format";
import { cx } from "@/shared/utils/cx";
import { DEMO_SLUG } from "@/shared/lib/route";
import { LEGAL, SITE, setMeta } from "@/shared/lib/seo";

// The homepage's look (features/launch/ComingSoon): royal blue page, white type, pink main button, white cards, Fredoka for amounts.
const ring = "outline-white focus-visible:outline-2 focus-visible:outline-offset-2";
const pink = cx("group inline-flex h-13 cursor-pointer items-center gap-2 rounded-full bg-cta px-6 text-md font-bold whitespace-nowrap text-brand-950 shadow-[0_4px_0_rgb(0_0_0/0.18)] transition hover:-translate-y-0.5 hover:bg-cta-hover active:translate-y-0", ring);
const white = cx("inline-flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-white px-5 text-sm font-semibold whitespace-nowrap text-brand-700 shadow-[0_3px_0_rgb(0_0_0/0.15)] transition hover:-translate-y-0.5", ring);
const h2 = "m-0 text-[26px] leading-tight font-extrabold tracking-[-0.035em] text-white";
/** Classic layout: sections sit straight on the blue, divided by a hairline, no cards. */
/** Share buttons in each network's own colour. */
const arrowBtn = "absolute top-1/2 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/90 text-brand-950 shadow-lg outline-white transition hover:scale-105 hover:bg-white focus-visible:outline-2";
const BRAND: Record<string, string> = { WhatsApp: "#25d366", X: "#0f1419", Facebook: "#1877f2", LinkedIn: "#0a66c2" };

/** A campaign made in the create flow, as donors see it. Reads and writes go through the campaign service. */
export const CampaignView = ({ campaign, onChange }: { campaign: Campaign; onChange: (c: Campaign) => void }) => {
    const { go, href, money, toast } = useApp();
    const [kids, setKids] = useState<Campaign[]>([]);
    const key = `${PREFIX[campaign.type]}/${campaign.slug}`;
    useEffect(() => { campaigns.children(key).then(setKids).catch(() => setKids([])); }, [key]);
    // Titles always start with a capital, even ones saved before that rule. Gifts to the teams and fundraisers raising
    // for this page count toward its total, newest first, as on the big fundraising sites.
    const c = {
        ...campaign,
        title: campaign.title.replace(/^\p{Ll}/u, (ch) => ch.toUpperCase()),
        raised: campaign.raised + kids.reduce((n, x) => n + x.raised, 0),
        donations: [...campaign.donations, ...kids.flatMap((x) => x.donations)].sort((a, b) => b.at - a.at),
    };
    const t = typeOf(c);
    useEffect(() => { setMeta(`${c.title} | ${SITE.name}`, c.lead || `${t.label} raising for ${c.charity || "a good cause"}. Give or share to help it reach ${money(c.goal)}.`); }, [c.title, c.lead, c.charity, c.goal]); // eslint-disable-line react-hooks/exhaustive-deps
    const organiser = c.organiser || c.charity || "The organiser";
    const [gift, setGift] = useState(c.gifts[1] ?? c.gifts[0] ?? 25);
    const [giving, setGiving] = useState<number | null>(null);
    const [shareOpen, setShareOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [shown, setShown] = useState(0);
    const [paused, setPaused] = useState(false);
    const [deck, setDeck] = useState(0);
    const [drag, setDrag] = useState(0);
    const start = useRef<number | null>(null);
    const vid = c.video ? youtubeId(c.video) : "";
    const media: ({ kind: "photo"; src: string } | { kind: "video"; id: string })[] = [...c.photos.map((src) => ({ kind: "photo" as const, src })), ...(vid ? [{ kind: "video" as const, id: vid }] : [])];
    // Photos advance every 4.5s; hovering, focusing or opening the video stops it so nobody loses their place.
    useEffect(() => {
        if (paused || media.length < 2 || media[shown]?.kind === "video" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const id = setTimeout(() => setShown((n) => { const nx = (n + 1) % media.length; return media[nx].kind === "video" ? 0 : nx; }), 4500);
        return () => clearTimeout(id);
    }, [paused, shown, media.length]); // eslint-disable-line react-hooks/exhaustive-deps
    const url = `${window.location.origin}${href({ name: "page", org: DEMO_SLUG, page: { type: c.type, slug: c.slug }, real: true })}`;
    const pct = Math.min(100, Math.round((c.raised / Math.max(1, c.goal)) * 100));
    const people = c.donations.length;
    const words = c.donations.filter((d) => d.message);
    const paras = c.body.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
    const facts: (readonly [string, string, FC<{ className?: string }>])[] = [
        ["Gifts go to", c.charity || "Not added yet", Heart],
        ["Page type", t.label, Announcement01],
        ...(c.details["Team name"] ? [["Team", c.details["Team name"], Users01] as const] : []),
        ...(c.details["In memory of"] ? [["In memory of", c.details["In memory of"], Heart] as const] : []),
        ...(c.details.Target ? [["Target", `${c.details.Target} ${c.details.Unit ?? "km"}`, Flag01] as const] : []),
        ...(c.details.When ? [["When", new Date(c.details.When).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" }), Calendar] as const] : []),
        ["Started", dateOf(c.createdAt), Clock],
    ];
    const daysToGo = c.details.When ? Math.max(0, Math.ceil((new Date(c.details.When).getTime() - Date.now()) / 86400000)) : null;
    // Gifts here are recorded by the campaign service, so the donate form only needs a stand-in charity for its name and settings.
    const org = { id: "local", slug: "local", name: c.charity || "the charity", tips_enabled: false, platform_fee_bps: 0, stripe_charges_enabled: true, remove_branding: false, live: {} } as unknown as Org;
    const give = async (d: Donation) => { try { onChange(await campaigns.donate(c.id, d)); } catch (e) { toast((e as Error).message); } };
    const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); } };
    const targets = shareTargets(url, c.title).filter(([n]) => ["WhatsApp", "Facebook", "X", "LinkedIn"].includes(n));

    const openPage = (x: Campaign) => go({ name: "page", org: DEMO_SLUG, page: { type: x.type, slug: x.slug }, real: true });

    // The donate area is a deck of three cards: the top one is live, the next two peek out below it.
    // Swipe or drag the top card (either way) to bring the next one forward, or pick one from the tabs.
    const shield = <Svg d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" size={14} w={2} />;
    const donateBtn = <button type="button" onClick={() => setGiving(gift)} className={cx(pink, "w-full justify-between pr-2")}>{t.cta === "Donate" ? `Donate ${money(gift)}` : `${t.cta} · ${money(gift)}`}<span className="flex size-9 items-center justify-center rounded-full bg-white text-brand-950"><Svg d={ARROW} /></span></button>;
    const top = [...c.donations].sort((a, b) => b.usd - a.usd)[0];
    const cards: [string, ReactNode][] = [
        ["Progress", <>
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-[13px] font-semibold text-neutral-500">Raised so far</span>
                    <span className="font-bubble text-[44px] leading-none font-bold text-brand-950 tabular-nums">{money(c.raised)}</span>
                    <span className="text-[14px] text-neutral-500">of <b className="font-semibold text-neutral-900 tabular-nums">{money(c.goal)}</b> goal</span>
                </div>
                <Ring pct={pct} />
            </div>
            <div role="progressbar" aria-label="Raised so far" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-2.5 overflow-hidden rounded-full bg-brand-50"><div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-pop-300 transition-[width] duration-700" style={{ width: `${Math.max(pct, c.raised > 0 ? 3 : 0)}%` }} /></div>
            <dl className="m-0 grid grid-cols-3 gap-2 text-center">
                {([[String(people), people === 1 ? "supporter" : "supporters"], [money(Math.max(0, c.goal - c.raised)), "to go"], daysToGo !== null ? [String(daysToGo), daysToGo === 1 ? "day left" : "days left"] : [money(top?.usd ?? 0), "top gift"]] as [string, string][]).map(([v, l]) => (
                    <div key={l} className="flex flex-col rounded-2xl bg-brand-50 px-2 py-2.5"><dt className="order-2 text-xs text-brand-700/70">{l}</dt><dd className="m-0 truncate font-bubble text-lg font-bold text-brand-700 tabular-nums">{v}</dd></div>
                ))}
            </dl>
            <div className="flex flex-col gap-2">
                <span className="text-[13px] font-semibold text-neutral-500">Milestones</span>
                <ol className="m-0 grid list-none grid-cols-4 gap-2 p-0">{[25, 50, 75, 100].map((m) => { const hit = pct >= m; return (
                    <li key={m} className={cx("flex flex-col items-center gap-1 rounded-2xl py-2.5 text-center", hit ? "bg-brand-600 text-white" : "bg-neutral-50 text-neutral-500 ring-1 ring-neutral-200 ring-inset")}>
                        <span className={cx("flex size-5 items-center justify-center rounded-full", hit ? "bg-white text-brand-600" : "border-2 border-neutral-200")}>{hit && <Svg d={TICK} size={11} w={3.5} />}</span>
                        <span className="font-bubble text-sm font-bold tabular-nums">{m}%</span>
                        <span className={cx("text-[11px] tabular-nums", hit ? "text-white/80" : "text-neutral-400")}>{money((c.goal * m) / 100)}</span>
                    </li>
                ); })}</ol>
            </div>
            <div className="mt-auto flex flex-col gap-3">{donateBtn}<p className="m-0 flex items-center justify-center gap-1.5 text-[13px] text-neutral-500">{shield}The full gift goes to {c.charity || "the charity"}</p></div>
        </>],
        ["Give", <>
            <div className="flex flex-col gap-1"><span className="text-[13px] font-semibold text-neutral-500">Choose an amount</span><span className="text-[22px] leading-tight font-extrabold tracking-[-0.03em] text-brand-950">What would you like to give?</span></div>
            <div role="group" aria-label="Gift amount" className={cx("grid gap-2", c.gifts.length % 3 === 0 || c.gifts.length === 5 ? "grid-cols-3" : "grid-cols-2")}>{c.gifts.map((g) => <button key={g} type="button" aria-pressed={gift === g} onClick={() => setGift(g)} className={cx("h-12 cursor-pointer rounded-full text-base font-bold tabular-nums ring-inset transition", ring, gift === g ? "bg-brand-600 text-white shadow-[0_3px_0_rgb(0_0_0/0.15)]" : "bg-white text-neutral-800 ring-1 ring-neutral-200 hover:ring-brand-300")}>{money(g)}</button>)}</div>
            <p className="m-0 rounded-2xl bg-brand-50 px-3.5 py-3 text-sm text-brand-950"><b className="font-semibold tabular-nums">{money(gift)}</b> is {c.goal > 0 ? `${+((gift / c.goal) * 100).toFixed(gift / c.goal < 0.01 ? 2 : 1)}% of the goal` : "a great start"}. Donors can also type their own amount.</p>
            <div className="mt-auto flex flex-col gap-3">{donateBtn}<button type="button" onClick={() => setShareOpen(true)} className={cx(white, "w-full ring-1 ring-neutral-200")}><Svg d={UP} size={14} />Share this page</button></div>
        </>],
        ["Supporters", <>
            <div className="flex items-end justify-between gap-3"><div className="flex flex-col gap-1"><span className="text-[13px] font-semibold text-neutral-500">Supporters</span><span className="font-bubble text-[44px] leading-none font-bold text-brand-950 tabular-nums">{people}</span></div>{top && <span className="rounded-2xl bg-pop-100 px-3 py-2 text-right text-xs text-brand-950"><span className="block text-brand-700/80">Top gift</span><b className="font-bubble text-base font-bold tabular-nums">{money(top.usd)}</b> · {top.name.split(" ")[0]}</span>}</div>
            {people === 0 ? <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-neutral-200 px-4 py-8 text-center"><Sparkle className="size-6 text-pop-400" /><p className="m-0 text-sm text-neutral-600">No gifts yet. Yours will be the first name here.</p></div>
                : <ul className="m-0 flex list-none flex-col gap-3 p-0">{c.donations.slice(0, 5).map((d, i) => (
                    <li key={`${d.at}-${i}`} className="flex items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-pop-100 text-sm font-bold text-brand-700">{(initials(d.name) || "A")[0]}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-neutral-900">{d.name}</span><span className="block text-xs text-neutral-500">{ago(d.at)}{d.monthly && " · Monthly"}</span></span><span className="font-bubble text-[15px] font-bold text-brand-700 tabular-nums">{money(d.usd)}</span></li>
                ))}</ul>}
            <div className="mt-auto">{donateBtn}</div>
        </>],
    ];
    const n = cards.length;
    const flip = (dir: 1 | -1) => setDeck((k) => (k + dir + n) % n);
    const donateCard = (
        <div className="flex flex-col gap-4">
            <div role="tablist" aria-label="Donate card" className="flex items-center gap-1 self-start rounded-full bg-white/12 p-1 ring-1 ring-white/25 backdrop-blur-sm ring-inset">
                {cards.map(([label], i) => <button key={label} type="button" role="tab" aria-selected={deck === i} onClick={() => setDeck(i)} className={cx("h-8 cursor-pointer rounded-full px-3.5 text-[13px] font-semibold transition", ring, deck === i ? "bg-white text-brand-700 shadow-[0_2px_0_rgb(0_0_0/0.12)]" : "text-white/80 hover:text-white")}>{label}</button>)}
            </div>
            {/* All three cards share one grid cell, so the deck is as tall as its tallest card. */}
            <div className="grid pt-1 pb-12 select-none" style={{ touchAction: "pan-y" }}>
                {cards.map(([label, body], i) => {
                    const k = (i - deck + n) % n; // 0 = top of the deck
                    const live = k === 0;
                    const move = live ? `translateX(${drag}px) rotate(${drag / 18}deg)` : k === 1 ? "translate(14px, 22px) rotate(3deg) scale(0.96)" : "translate(-12px, 38px) rotate(-3deg) scale(0.92)";
                    return (
                        <div key={label} role="tabpanel" aria-label={label} aria-hidden={!live} inert={!live}
                            onPointerDown={live ? (e) => { if ((e.target as HTMLElement).closest("button, a, input")) return; start.current = e.clientX; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } : undefined}
                            onPointerMove={live ? (e) => { if (start.current !== null) setDrag(e.clientX - start.current); } : undefined}
                            onPointerUp={live ? () => { if (Math.abs(drag) > 70) flip(drag < 0 ? 1 : -1); start.current = null; setDrag(0); } : undefined}
                            onPointerCancel={() => { start.current = null; setDrag(0); }}
                            className={cx("col-start-1 row-start-1 flex flex-col gap-5 rounded-[28px] p-5 text-neutral-900 shadow-xl shadow-brand-950/25 will-change-transform", start.current !== null && live ? "transition-none" : "transition-[transform,background-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]", live ? "cursor-grab bg-white active:cursor-grabbing" : k === 1 ? "bg-pop-300" : "bg-brand-200")}
                            style={{ transform: move, zIndex: 30 - k }}>
                            <div className={cx("flex flex-1 flex-col gap-5 transition-opacity duration-200", live ? "opacity-100" : "opacity-0")}>{body}</div>
                        </div>
                    );
                })}
            </div>
            <div className="-mt-2 flex items-center justify-between">
                <button type="button" aria-label="Previous card" onClick={() => flip(-1)} className={cx("flex size-9 cursor-pointer items-center justify-center rounded-full bg-white/12 text-white ring-1 ring-white/25 transition ring-inset hover:bg-white/20", ring)}><Svg d="M15 6l-6 6 6 6" size={16} /></button>
                <span className="flex items-center gap-2 text-[13px] text-white/75"><span aria-hidden className="flex gap-1.5">{cards.map((_, i) => <span key={i} className={cx("h-1.5 rounded-full transition-all", deck === i ? "w-5 bg-white" : "w-1.5 bg-white/45")} />)}</span>Swipe the card</span>
                <button type="button" aria-label="Next card" onClick={() => flip(1)} className={cx("flex size-9 cursor-pointer items-center justify-center rounded-full bg-white/12 text-white ring-1 ring-white/25 transition ring-inset hover:bg-white/20", ring)}><Svg d="M9 6l6 6-6 6" size={16} /></button>
            </div>
        </div>
    );

    return (
        <div className="relative min-h-dvh overflow-hidden bg-brand-600 font-body text-white">
            {/* The homepage's dashed orbits and sparkles behind everything. */}
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-72 -left-72 size-[820px] rounded-full border-2 border-dashed border-white/15" />
                <div className="absolute top-[420px] -right-80 size-[760px] rounded-full border-2 border-dashed border-white/10" />
                <Sparkle className="absolute top-32 left-[6%] size-5 animate-pulse text-pop-300" />
                <Sparkle className="absolute top-[28%] right-[5%] size-6 animate-pulse text-white/70 [animation-delay:700ms]" />
            </div>

            <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 md:px-8">
                <button type="button" onClick={() => go({ name: "landing" })} aria-label="Outgive home" className="flex cursor-pointer items-center gap-2 rounded-xl outline-white focus-visible:outline-2 focus-visible:outline-offset-4">
                    <OgLogo size={26} tone="dark" />
                </button>
                <nav className="flex items-center gap-1 text-sm font-medium text-white/85 sm:gap-2">
                    <button type="button" onClick={() => go({ name: "create" })} className="hidden cursor-pointer rounded-full px-3 py-2 transition hover:bg-white/10 hover:text-white sm:block">Start your own page</button>
                    <button type="button" onClick={() => setShareOpen(true)} className={cx(white, "h-10 px-4")}>Share<Svg d={UP} size={14} /></button>
                </nav>
            </header>

            <main className="relative z-10 mx-auto grid w-full max-w-6xl gap-10 px-4 pt-6 pb-16 md:px-8 lg:grid-cols-[minmax(0,1fr)_380px]">
                <div className="flex min-w-0 flex-col gap-8">
                    <div className="flex flex-col items-start gap-5">
                        <span className="inline-flex items-center gap-2 rounded-full bg-white/12 py-1 pr-3.5 pl-1 text-sm font-semibold ring-1 ring-white/25 backdrop-blur-sm ring-inset"><span className="rounded-full bg-pop-300 px-2.5 py-1 text-xs font-bold text-brand-950">{t.label}</span>{c.charity ? `Raising for ${c.charity}` : "Raising for a good cause"}</span>
                        <h1 className="m-0 text-[40px] leading-[0.98] font-extrabold tracking-[-0.045em] text-balance md:text-[64px]">{c.title}</h1>
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
                            <div className="flex items-center gap-3">
                                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-[15px] font-bold text-brand-600 shadow-[0_3px_0_rgb(0_0_0/0.15)]">{initials(organiser) || "?"}</span>
                                <span className="flex flex-col leading-tight"><span className="text-[13px] text-white/70">Organised by</span><span className="text-[16px] font-bold text-white">{organiser}</span></span>
                            </div>
                            <span aria-hidden className="h-8 w-px bg-white/25 max-sm:hidden" />
                            <div className="flex items-center gap-3 text-[15px] text-white/80">
                                {people > 0 && <span aria-hidden className="flex -space-x-2.5">{c.donations.slice(0, 4).map((d, i) => <span key={i} className="flex size-9 items-center justify-center rounded-full bg-pop-300 text-sm font-bold text-brand-950 ring-3 ring-brand-600">{(initials(d.name) || "A")[0]}</span>)}</span>}
                                <span>{people > 0 ? <><b className="font-semibold text-white">{c.donations[0].name === "Anonymous" ? "Someone" : c.donations[0].name.split(" ")[0]}</b>{people > 1 ? ` and ${people - 1} ${people === 2 ? "other" : "others"} have given` : " has given"}</> : "Be the first to give"} · started {ago(c.createdAt)}</span>
                            </div>
                        </div>
                    </div>

                    {media.length > 0 ? (
                        <div className="flex flex-col gap-3" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
                            <div className="relative rounded-[30px] bg-white p-2 shadow-2xl shadow-brand-950/30">
                                <div className="relative aspect-[16/10] overflow-hidden rounded-[24px] bg-brand-950">
                                    {media.map((m, i) => m.kind === "video"
                                        ? (i === shown && <iframe key="video" title={`Video for ${c.title}`} src={`https://www.youtube-nocookie.com/embed/${m.id}?rel=0&playsinline=1`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="absolute inset-0 size-full border-0" />)
                                        : <img key={i} src={m.src} alt={i === 0 ? `Cover photo for ${c.title}` : `Photo ${i + 1} for ${c.title}`} aria-hidden={i !== shown} className={cx("absolute inset-0 size-full object-cover transition-opacity duration-700", i === shown ? "opacity-100" : "opacity-0")} />)}
                                </div>
                                {media.length > 1 && <>
                                    <button type="button" aria-label="Previous" onClick={() => setShown((shown - 1 + media.length) % media.length)} className={cx(arrowBtn, "left-5")}><Svg d="M15 6l-6 6 6 6" size={18} /></button>
                                    <button type="button" aria-label="Next" onClick={() => setShown((shown + 1) % media.length)} className={cx(arrowBtn, "right-5")}><Svg d="M9 6l6 6-6 6" size={18} /></button>
                                    <span aria-hidden className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/30 px-2.5 py-1.5 backdrop-blur">{media.map((_, i) => <span key={i} className={cx("h-1.5 rounded-full transition-all", i === shown ? "w-5 bg-white" : "w-1.5 bg-white/60")} />)}</span>
                                </>}
                            </div>
                            {media.length > 1 && <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${media.length}, minmax(0, 1fr))` }}>{media.map((m, i) => (
                                <button key={i} type="button" aria-label={m.kind === "video" ? "Play video" : `Show photo ${i + 1}`} aria-pressed={shown === i} onClick={() => setShown(i)} className={cx("relative cursor-pointer overflow-hidden rounded-2xl bg-white p-1 transition", ring, shown === i ? "shadow-[0_0_0_3px_var(--color-pop-300)]" : "opacity-75 hover:opacity-100")}>
                                    <img src={m.kind === "video" ? `https://i.ytimg.com/vi/${m.id}/hqdefault.jpg` : m.src} alt="" className="aspect-[16/10] w-full rounded-xl object-cover" />
                                    {m.kind === "video" && <span aria-hidden className="absolute inset-0 flex items-center justify-center"><span className="flex size-10 items-center justify-center rounded-full bg-white/95 text-brand-700 shadow-lg"><svg viewBox="0 0 24 24" className="ml-0.5 size-4.5" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></span></span>}
                                </button>
                            ))}</div>}
                        </div>
                    ) : (
                        <div aria-hidden className="flex aspect-[16/10] items-center justify-center rounded-[30px] bg-white/10 font-bubble text-[120px] font-bold text-white/30 ring-1 ring-white/20 ring-inset">{initials(c.title) || "?"}</div>
                    )}

                    <div className="lg:hidden">{donateCard}</div>

                    <section className="flex flex-col gap-5">
                        <div className="flex items-end gap-3"><h2 className={h2}>The story</h2><span aria-hidden className="font-hand -rotate-3 pb-0.5 text-2xl leading-none text-pop-300">in their own words</span></div>
                        <div className="flex max-w-prose flex-col gap-6 font-segoe text-[19px] leading-[1.65] font-semibold tracking-[-0.01em] text-white/90 md:text-[21px]">
                            {c.lead || paras.length ? <>
                                {c.lead && <p className="m-0"><mark className="mark text-brand-950">{c.lead}</mark></p>}
                                {paras.map((x, i) => <p key={i} className="m-0 whitespace-pre-line">{x}</p>)}
                            </> : <p className="m-0 text-white/70">The story hasn't been written yet.</p>}
                        </div>
                    </section>

                    <section className="flex flex-col gap-5">
                        <h2 className={h2}>Details</h2>
                        <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3">{facts.map(([k, v, Icon]) => (
                            <div key={k} className="flex items-center gap-3.5 rounded-[20px] bg-white/10 p-4 ring-1 ring-white/15 ring-inset">
                                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-[0_3px_0_rgb(0_0_0/0.12)]"><Icon className="size-5" /></span>
                                <div className="flex min-w-0 flex-col gap-0.5"><dt className="text-[13px] font-medium text-white/70">{k}</dt><dd className="m-0 text-[16px] leading-snug font-bold text-white">{v}</dd></div>
                            </div>
                        ))}</dl>
                    </section>

                    <div className="flex flex-col gap-4">
                        <Leaderboard type={c.type} kids={kids} donations={c.donations} open={openPage} start={() => go({ name: "create", parent: key })} give={() => setGiving(gift)} />
                        {c.type !== "fundraiser" && c.type !== "memory" && <div className="flex flex-wrap gap-3">
                            <button type="button" onClick={() => go({ name: "create", parent: key })} className={cx(white, "h-11")}>{c.type === "team" ? "Join the team" : "Start a fundraiser"}</button>
                            {c.type !== "team" && <button type="button" onClick={() => go({ name: "create", parent: key })} className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-white/10 px-5 text-sm font-semibold text-white ring-1 ring-white/25 outline-white transition ring-inset hover:bg-white/20 focus-visible:outline-2">Start a team</button>}
                        </div>}
                    </div>


                    <section className="flex flex-col gap-5 rounded-[28px] bg-white p-6 text-neutral-900 shadow-xl shadow-brand-950/25 md:p-8">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                            <div className="flex flex-col gap-1"><h2 className="m-0 text-[26px] leading-tight font-extrabold tracking-[-0.035em] text-brand-950">Help it travel</h2><p className="m-0 text-[15px] text-neutral-500">Most gifts come from people who saw the link from a friend.</p></div>
                            <span aria-hidden className="font-hand -rotate-2 text-2xl leading-none text-brand-600">one share = more gifts</span>
                        </div>
                        <div className="flex flex-col gap-2 rounded-[22px] bg-neutral-100 p-1.5 sm:flex-row sm:items-center">
                            <span className="flex h-12 min-w-0 flex-1 items-center gap-2.5 px-3.5 text-[15px] font-medium text-neutral-700"><Link01 className="size-4.5 shrink-0 text-brand-600" /><span className="truncate">{url.replace(/^https?:\/\//, "")}</span></span>
                            <button type="button" onClick={copy} className={cx(pink, "h-12 justify-center px-5 text-[15px]")}>{copied ? <><Svg d={TICK} size={16} w={3} />Copied</> : "Copy link"}</button>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">{targets.map(([name, icon, link]) => (
                            <a key={name} href={link} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2.5 rounded-2xl bg-neutral-50 p-2.5 pr-3 text-sm font-semibold text-neutral-800 ring-1 ring-neutral-200 ring-inset outline-brand-600 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md focus-visible:outline-2">
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl text-white [&_svg]:size-4.5" style={{ background: BRAND[name] ?? "#2b59ff" }}>{icon}</span>{name}
                            </a>
                        ))}</div>
                    </section>

                    <section className="flex flex-col gap-5">
                        <h2 className={h2}>Words of support <span className="ml-1 rounded-full bg-white/15 px-2.5 py-1 align-middle text-sm font-bold text-white tabular-nums">{words.length}</span></h2>
                        {words.length === 0 ? (
                            <div className="flex flex-col items-center gap-3 rounded-[28px] border-2 border-dashed border-white/25 px-6 py-9 text-center">
                                <span className="flex size-12 items-center justify-center rounded-2xl bg-pop-300 text-brand-950 shadow-[0_3px_0_rgb(0_0_0/0.15)]"><Heart className="size-6" /></span>
                                <p className="m-0 max-w-sm text-[16px] text-white/85">Messages left with gifts show here, so the first one sets the tone.</p>
                                <button type="button" onClick={() => setGiving(gift)} className={cx(white, "mt-1")}>Leave the first message</button>
                            </div>
                        ) : <ul className="m-0 grid list-none gap-3 p-0">{words.map((d, i) => (
                            <li key={`${d.at}-${i}`} className="flex gap-3.5 rounded-[22px] bg-white/10 p-4 ring-1 ring-white/15 ring-inset"><span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-pop-300 text-sm font-bold text-brand-950">{(initials(d.name) || "A")[0]}</span><div className="min-w-0"><div className="text-[15px] font-semibold text-white">{d.name} <span className="font-normal text-white/65">· gave {money(d.usd)} · {ago(d.at)}</span></div><p className="m-0 mt-1 text-[16px] leading-relaxed text-white/90">{d.message}</p></div></li>
                        ))}</ul>}
                    </section>
                </div>

                <aside className="max-lg:hidden"><div className="sticky top-6">{donateCard}</div></aside>
            </main>

            <section className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-28 md:px-8 lg:pb-16">
                <div className="relative overflow-hidden rounded-[36px] bg-white px-6 py-10 text-center text-brand-950 shadow-2xl shadow-brand-950/30 md:px-12 md:py-14">
                    <Sparkle className="absolute top-8 left-10 size-6 text-pop-300" /><Sparkle className="absolute right-12 bottom-10 size-5 text-brand-300" />
                    <span className="font-hand inline-block -rotate-2 text-2xl text-brand-600">{pct >= 100 ? "goal reached!" : `${money(Math.max(0, c.goal - c.raised))} to go`}</span>
                    <h2 className="m-0 mx-auto mt-2 max-w-2xl text-[32px] leading-[1.02] font-extrabold tracking-[-0.045em] text-balance md:text-[48px]">Make every gift <span className="text-brand-600">count</span>.</h2>
                    <div className="mx-auto mt-6 h-3 max-w-md overflow-hidden rounded-full bg-brand-50"><div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-pop-300" style={{ width: `${Math.max(pct, c.raised > 0 ? 3 : 0)}%` }} /></div>
                    <p className="m-0 mt-2 text-sm text-neutral-500"><b className="font-semibold text-neutral-900 tabular-nums">{money(c.raised)}</b> of {money(c.goal)} · {people} {people === 1 ? "supporter" : "supporters"}</p>
                    <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                        <button type="button" onClick={() => setGiving(gift)} className={pink}>{t.cta === "Donate" ? `Donate ${money(gift)}` : t.cta}<Svg d={ARROW} size={16} /></button>
                        <button type="button" onClick={() => setShareOpen(true)} className={cx(white, "h-13 px-6 ring-1 ring-neutral-200")}>Share with a friend</button>
                    </div>
                </div>
                <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/20 pt-6 text-sm text-white/70">
                    <span>Powered by <b className="font-bubble font-bold text-white">outgive</b> · the full gift goes to {c.charity || "the charity"}</span>
                    <span className="flex items-center gap-4">
                        <button type="button" onClick={() => go({ name: "create" })} className="cursor-pointer font-semibold text-white hover:underline">Start your own page</button>
                        <a href={`mailto:${LEGAL.email}?subject=${encodeURIComponent(`Report: ${c.title}`)}&body=${encodeURIComponent(url)}`} className="hover:text-white hover:underline">Report this page</a>
                    </span>
                </footer>
            </section>

            <div className="fixed inset-x-0 bottom-0 z-30 flex gap-3 bg-brand-700/95 px-4 py-3 ring-1 ring-white/10 backdrop-blur lg:hidden">
                <button type="button" onClick={() => setShareOpen(true)} className={cx(white, "flex-1")}>Share</button>
                <button type="button" onClick={() => setGiving(gift)} className={cx(pink, "flex-[2] justify-center")}>Donate {money(gift)}</button>
            </div>

            <ShareDialog isOpen={shareOpen} onClose={() => setShareOpen(false)} url={url} title={c.title} />
            <DonateDialog target={{ org, page: null, title: c.title, gifts: c.gifts }} isOpen={giving !== null} initial={giving ?? gift} onClose={() => setGiving(null)} onShare={() => setShareOpen(true)} onLocal={give} />
        </div>
    );
};

/** The homepage's funded ring. */
const Ring = ({ pct }: { pct: number }) => (
    <span className="relative flex size-16 shrink-0 items-center justify-center">
        <svg viewBox="0 0 36 36" className="absolute inset-0 size-16 -rotate-90" aria-hidden><circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="4" className="stroke-brand-50" /><circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="4" strokeLinecap="round" pathLength={100} strokeDasharray={`${pct} 100`} className="stroke-brand-600 transition-[stroke-dasharray] duration-700" /></svg>
        <span className="font-bubble text-sm font-bold text-brand-700 tabular-nums">{pct}%</span>
    </span>
);
const Sparkle = ({ className }: { className?: string }) => <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}><path d="M12 0c.6 6.5 5.5 11.4 12 12-6.5.6-11.4 5.5-12 12-.6-6.5-5.5-11.4-12-12C6.5 11.4 11.4 6.5 12 0z" /></svg>;
