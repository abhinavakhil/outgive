/**
 * /ramadhan/give: the Ramadan donate flow, built like a food-delivery basket.
 *   Menu: the charity's campaigns, causes and one-off duties, with ADD and a stepper, quick baskets and a basket bar
 *         (on a wide screen the basket sits beside the menu).
 *   Checkout: one page, like a delivery app's cart. Basket, nights (30, last 10, odd, picked or once), boosts for the last ten
 *         nights and night 27, add-ons, "give with this gift", Gift Aid, fees, a tip, the bill, and a pay bar with the way to pay.
 *         Details and the way to pay open as bottom sheets.
 *   Paying: the checkout's flying coin, lantern and gift; then a tick; then the thank-you with the night-by-night tracker.
 * The basket is shared with the charity page (see store.ts). ?add=water,food&nights=10 also fills it, for links from elsewhere.
 * Every step sends an rg_* analytics event (docs/checkout.md).
 */
import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { HandHeart, ArrowLeft, ArrowRight, CaretDown, CaretRight, CaretUp, Check, CheckCircle, CreditCard, Gift, ListBullets, LockSimple, Minus, MoonStars, NotePencil, Plus, ShareNetwork, ShieldCheck, Sparkle, Star, Tag, UsersThree, X } from "@phosphor-icons/react";
import { track } from "@/shared/lib/analytics";
import { OgLogo } from "@/shared/ui";
import { cx } from "@/shared/utils/cx";
import { FLYERS, type PayResult, StripeFields, type StripeFieldsHandle, payFunction, returnedPayment, settle } from "@/features/checkout";
import { db, isDemo } from "@/shared/lib/db";
import { type Live, useLive, withStats } from "../bio/live";
import { CauseArt, ILLUSTRATION_BG } from "../bio/illustrations";
import { type BioPage, SUPPORTERS, onColour, useBioPage } from "../bio/model";
import { type Item, LEVELS, MATCH, MODES, type Mode, NIGHTS, type Quote, expiryOk, gbp, impactOf, itemCount, levelOf, luhn, menuFrom, quote, receiptPdf, splitOf } from "./model";
import { type Donor, type Give, type Method, clearGive, useGive } from "./store";
import "./give.css";
import "./pile.css";

type Page = "menu" | "amount" | "pay";
type SetGive = ReturnType<typeof useGive>[1];
type Add = (id: string, by: number, where: string) => void;
type Paid = { receipt: string; date: string; name: string; q: Quote; mode: Mode; first: string; giftAid: boolean; method: Method; impact: string; level: number };
const paidFrom = (receipt: string, g: Give, q: Quote, menu: Item[]): Paid => ({ receipt, date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }), name: `${g.donor.first} ${g.donor.last}`.trim(), q, mode: g.mode, first: g.donor.first.trim(), giftAid: g.giftAid, method: g.method, impact: impactOf(q.gifts - q.onceItems, g.qty, menu), level: levelOf(q.nightly) });

/**
 * The pay function's request for this basket. ponytail: the whole Ramadan schedule is charged today as one payment; charging each
 * night needs a saved card and a nightly job (Stripe off-session), add it when the charity wants night-by-night charges.
 */
const payBody = (g: Give, q: Quote, menu: Item[], orgId: string, attemptKey: string) => {
    const d = g.donor, top = menu.filter((i) => g.qty[i.id]).sort((a, b) => b.price * g.qty[b.id] - a.price * g.qty[a.id])[0];
    return {
        attempt_key: attemptKey, org_id: orgId, currency: "GBP", freq: "once",
        method: g.method === "paypal" ? "paypal" : g.method === "card" ? "card" : "wallet",
        amount_cents: Math.round(q.gifts * 100), cover_cents: Math.round(q.fees * 100), tip_cents: Math.round(q.tips * 100),
        donor_name: `${d.first} ${d.last}`.trim(), donor_email: d.email.trim() || undefined, anonymous: d.anon,
        fund: d.giveAs, gift_aid: g.giftAid, dedication: d.behalfOn ? d.behalf.trim() : "", cause: top?.title.slice(0, 80) ?? "Ramadan",
        details: {
            items: g.qty, mode: g.mode, nights: q.nights, note: d.note.trim().slice(0, 500), news: d.news, split: splitOf(g, q, menu),
            ...(g.giftAid ? { house: d.house.trim(), postcode: d.postcode.trim() } : {}),
        },
    };
};

/** Icons are Phosphor (bold by default, fill for marks that should read solid), one family across the flow. */
type PIcon = typeof Check;
const Ico = ({ d: Icon, size = 18, fill }: { d: PIcon; size?: number; fill?: boolean }) => <Icon size={size} weight={fill ? "fill" : "bold"} aria-hidden="true" />;
const I = {
    back: ArrowLeft, next: CaretRight, arrow: ArrowRight, plus: Plus, minus: Minus, check: Check, up: CaretUp, down: CaretDown,
    shield: ShieldCheck, star: Star, lock: LockSimple, gift: Gift, share: ShareNetwork, user: UsersThree, note: NotePencil,
    card: CreditCard, heart: HandHeart, x: X, spark: Sparkle, list: ListBullets, tag: Tag, moon: MoonStars, added: CheckCircle,
};
const METHOD: Record<Method, [string, string]> = { apple: ["Apple Pay", ""], google: ["Google Pay", ""], card: ["Card", "Visa, Mastercard, Amex"], paypal: ["PayPal", ""] };

/** Quick baskets: one tap fills a sensible basket, like a restaurant's combos. */
const BUNDLES: { id: string; title: string; sub: string; qty: Record<string, number>; art: string }[] = [
    { id: "family", title: "Iftar for a family", sub: "4 meals", qty: { food: 4 }, art: "food" },
    { id: "water-iftar", title: "Water and iftar", sub: "Water and a meal", qty: { water: 1, food: 1 }, art: "water" },
    { id: "zakat", title: "Nightly Zakat", sub: "To those eligible", qty: { zakat: 1 }, art: "zakat" },
    { id: "orphan", title: "Care for an orphan", sub: "A day's care", qty: { orphans: 1 }, art: "orphans" },
];

/** Fills the basket from ?add=… once, then drops the query so a reload keeps whatever the donor did next. */
const useStartFromUrl = (menu: Item[], set: SetGive) => {
    useEffect(() => {
        const q = new URLSearchParams(location.search);
        const ids = (q.get("add") ?? "").split(",").filter((id) => menu.some((i) => i.id === id));
        const mode = q.get("nights") as Mode | null;
        const days = (q.get("days") ?? "").split(",").map(Number).filter(Boolean);
        if (ids.length || mode) set((g) => ({ qty: { ...g.qty, ...Object.fromEntries(ids.filter((id) => !g.qty[id]).map((id) => [id, 1])) }, ...(mode && MODES.some(([m]) => m === mode) ? { mode } : {}), ...(days.length ? { picked: days } : {}) }));
        if (q.size) history.replaceState(history.state, "", location.pathname);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
};

export const RamadanGive = () => {
    const { page: local } = useBioPage();
    // With Supabase connected: the page as the charity saved it, and its org for the payment.
    const live = useLive();
    const bio = useMemo(() => (live ? withStats(live.bio ?? local, live.stats).page : local), [live, local]);
    const menu = useMemo(() => menuFrom(bio), [bio]);
    const [g, set] = useGive();
    useStartFromUrl(menu, set);
    // The link opens on step 1, "Add to the pile"; the menu is where causes are changed, reached from there.
    const [page, setPage] = useState<Page>(() => (["menu", "amount", "pay"].includes(history.state?.rg) ? history.state.rg : "amount"));
    const entry = useRef(page);
    const [paid, setPaid] = useState<Paid | null>(null);
    const q = useMemo(() => quote(g, menu, bio.ramadanStart), [g, menu, bio.ramadanStart]);
    const count = itemCount(g.qty);

    useEffect(() => { document.title = `Give to ${bio.name} this Ramadan`; track("rg_open", { items: count }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    // Each screen is a history entry, so the phone's back button walks back through them.
    const go = (p: Page) => { setPage(p); history.pushState({ rg: p }, "", location.pathname); window.scrollTo({ top: 0 }); track("rg_step", { step: p, items: count, total: q.total }); };
    useEffect(() => {
        history.replaceState({ rg: page }, "", location.pathname + location.search);
        const pop = (e: PopStateEvent) => setPage((e.state?.rg as Page) ?? "menu");
        addEventListener("popstate", pop); return () => removeEventListener("popstate", pop);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    // An emptied basket has nothing to check out.
    // Nothing to pay for yet: back to step 1.
    useEffect(() => { if (page === "pay" && !q.total && !paid) setPage("amount"); }, [page, q.total, paid]);
    // Back from PayPal or a bank's page: ask the pay function how it ended. The basket is still here, so the thank-you can show it.
    useEffect(() => {
        const id = isDemo ? null : returnedPayment();
        if (!id) return;
        void db().then((d) => settle(payFunction(d.fn, () => null), id)).then((r) => {
            if (r.status === "succeeded" || r.status === "processing") { track("rg_paid", { method: g.method, total: q.total, returned: 1 }); setPaid(paidFrom(id.slice(0, 8).toUpperCase(), g, q, menu)); clearGive(); }
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const add: Add = (id, by, where) => {
        const n = Math.max(0, Math.min(99, (g.qty[id] ?? 0) + by));
        track(by > 0 ? "rg_item_add" : "rg_item_remove", { item: id, qty: n, where });
        set((x) => { const qty = { ...x.qty, [id]: n }; if (!n) delete qty[id]; return { qty, amount: undefined }; });
    };
    const style = { "--c": bio.theme.colour, "--on-c": onColour(bio.theme.colour) } as CSSProperties;
    const leave = () => (page === entry.current ? (location.href = "/ramadhan") : history.back());

    if (paid) return <div className="rg" style={style}><Done paid={paid} bio={bio} onAgain={() => { setPaid(null); setPage("menu"); history.replaceState({ rg: "menu" }, "", location.pathname); }} /></div>;
    return (
        <div className={cx("rg", `rg-on-${page}`, page === "menu" && "gb")} style={style}>
            {page === "menu" ? (
                <>
                    <header className="gb-top gb-menu-top">
                        <button type="button" className="gb-back" onClick={leave} aria-label="Back"><Ico d={I.back} size={18} /></button>
                        <a href="/" aria-label="Outgive home" className="og-home"><OgLogo size={24} /></a>
                        <span style={{ flex: 1 }} />
                        <span className="gb-dots" aria-label="Choosing causes, before step 1 of 3"><i className="on now" /><i /><i /></span>
                        <span className="gb-secure"><Ico d={I.lock} size={14} fill />Secure</span>
                    </header>
                    <div className="rg-layout">
                        <main className="rg-main" key="menu"><Menu menu={menu} g={g} add={add} set={set} bio={bio} /></main>
                        <aside className="rg-side" aria-label="Your basket"><SideCart menu={menu} g={g} q={q} add={add} set={set} onCheckout={() => go("amount")} /></aside>
                    </div>
                </>
            ) : (
                <div className="gb" key={page}>
                    <header className="gb-top">
                        <button type="button" className="gb-back" onClick={leave} aria-label="Back"><Ico d={I.back} size={18} /></button>
                        <a href="/" aria-label="Outgive home" className="og-home"><OgLogo size={24} /></a>
                        <span style={{ flex: 1 }} />
                        <span className="gb-dots" aria-label={`Step ${page === "amount" ? 1 : 2} of 3`}>{[0, 1, 2].map((i) => <i key={i} className={cx(i <= (page === "amount" ? 0 : 1) && "on", i === (page === "amount" ? 0 : 1) && "now")} />)}</span>
                        <span className="gb-secure"><Ico d={I.lock} size={14} fill />Secure</span>
                    </header>
                    {page === "amount"
                        ? <GiveStep menu={menu} g={g} set={set} q={q} bio={bio} onMenu={() => go("menu")} onNext={() => go("pay")} />
                        : <CompleteStep menu={menu} g={g} set={set} q={q} bio={bio} live={live} onEdit={() => history.back()} onPaid={(p) => { setPaid(p); clearGive(); window.scrollTo({ top: 0 }); }} />}
                </div>
            )}
            {page === "menu" && count > 0 && (
                <div className="rg-dock rg-mobile">
                    <button type="button" onClick={() => go("amount")} className="rg-bar">
                        <span className="rg-bar-l"><small>{count} {count === 1 ? "item" : "items"} added</small><b>{basketLine(q, g)}</b></span>
                        <span className="rg-bar-r">View basket<Ico d={I.next} size={16} /></span>
                    </button>
                </div>
            )}
        </div>
    );
};

const basketLine = (q: Quote, g: Give) => {
    if (g.mode === "once" || !q.basket) return `${gbp(q.basket + q.onceItems)}${g.mode === "once" ? " once" : " today"}`;
    return `${gbp(q.basket)} a night${q.onceItems ? ` + ${gbp(q.onceItems)}` : ""}`;
};
const Tile = ({ art, className }: { art: string; className?: string }) => <span className={cx("rg-tile", className)} style={{ background: ILLUSTRATION_BG[art as keyof typeof ILLUSTRATION_BG] ?? "#F4F3F0" }}><CauseArt name={art} /></span>;
const Stepper = ({ n, name, onAdd, onRemove, small }: { n: number; name: string; onAdd: () => void; onRemove: () => void; small?: boolean }) => n === 0
    ? <button type="button" onClick={onAdd} className={cx("rg-add", small && "sm")} aria-label={`Add ${name}`}>ADD<Ico d={I.plus} size={11} /></button>
    : (
        <span className={cx("rg-step", small && "sm")} role="group" aria-label={`${name}: ${n}`}>
            <button type="button" onClick={onRemove} aria-label={`One less ${name}`}><Ico d={I.minus} size={14} /></button>
            <b key={n} className="rg-pop" aria-live="polite">{n}</b>
            <button type="button" onClick={onAdd} aria-label={`One more ${name}`}><Ico d={I.plus} size={14} /></button>
        </span>
    );
const Line = ({ k, v, strong, green }: { k: ReactNode; v: ReactNode; strong?: boolean; green?: boolean }) => <div className={cx("rg-line", strong && "strong", green && "green")}><span>{k}</span><span>{v}</span></div>;

/* ---------- Menu ---------- */
const SECTIONS: [Item["section"], string, string][] = [["campaigns", "Campaigns", "Our Ramadan appeals"], ["causes", "Causes", "Given on every night you choose"], ["obligations", "Zakat al-Fitr and Fidya", "Charged once, today"]];
const Menu = ({ menu, g, add, set, bio }: { menu: Item[]; g: Give; add: Add; set: SetGive; bio: BioPage }) => {
    const refs = useRef<Record<string, HTMLElement | null>>({});
    const [shut, setShut] = useState<Record<string, boolean>>({});
    const [nav, setNav] = useState(false);
    // A quick basket is "in" while the basket holds at least what it adds; tapping it again takes it back out.
    const isIn = (b: (typeof BUNDLES)[number]) => Object.entries(b.qty).every(([id, n]) => (g.qty[id] ?? 0) >= n);
    const bundle = (b: (typeof BUNDLES)[number]) => {
        const on = isIn(b), by = on ? -1 : 1;
        set((x) => { const qty = { ...x.qty }; for (const [id, n] of Object.entries(b.qty)) { const v = Math.max(0, (qty[id] ?? 0) + by * n); if (v) qty[id] = v; else delete qty[id]; } return { qty }; });
        track("rg_bundle", { id: b.id, on: on ? 0 : 1 });
    };
    const jump = (id: string) => { setNav(false); setShut((x) => ({ ...x, [id]: false })); setTimeout(() => refs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" }), 60); track("rg_menu_jump", { section: id }); };
    const counts = Object.fromEntries(SECTIONS.map(([id]) => [id, menu.filter((i) => i.section === id).length]));
    return (
        <>
            <section className="rg-org">
                <div className="rg-org-top">
                    <div className="min-w-0 flex-1">
                        <p className="rg-org-kind"><Ico d={I.shield} size={13} />Registered charity</p>
                        <h1>{bio.name}</h1>
                        <p className="rg-org-line">{bio.tagline}</p>
                    </div>
                    <span className="rg-org-av" aria-hidden="true">{bio.avatar || bio.name.slice(0, 2)}</span>
                </div>
                <p className="rg-org-meta"><span><b>3,412</b> supporters</span><span>Gift Aid</span><span>Nightly at sunset</span></p>
                <Offers />
            </section>

            <section id="rg-bundles" ref={(el) => { refs.current.bundles = el; }} className="rg-sec" aria-labelledby="rg-h-bundles">
                <div className="rg-sec-head"><h2 id="rg-h-bundles">Quick baskets</h2><small>One tap, given every night</small></div>
                <ul className="rg-bundles">
                    {BUNDLES.map((b) => {
                        const price = Object.entries(b.qty).reduce((n, [id, k]) => n + (menu.find((i) => i.id === id)?.price ?? 0) * k, 0);
                        const on = isIn(b);
                        return (
                            <li key={b.id} className={cx(on && "on")}>
                                <div className="rg-bundle-art"><Tile art={b.art} /><button type="button" aria-pressed={on} onClick={() => bundle(b)} aria-label={`${on ? "Remove" : "Add"} ${b.title}, ${gbp(price)} a night`} className={cx("rg-add", on && "done")}>{on ? <><Ico d={I.added} size={17} fill />ADDED</> : <>ADD<Ico d={I.plus} size={11} /></>}</button></div>
                                <b>{b.title}</b><small>{gbp(price)} a night · {b.sub}</small>
                            </li>
                        );
                    })}
                </ul>
            </section>

            {SECTIONS.map(([id, label, sub]) => (
                <section key={id} id={`rg-${id}`} ref={(el) => { refs.current[id] = el; }} className="rg-sec" aria-labelledby={`rg-h-${id}`}>
                    <button type="button" className="rg-sec-head rg-sec-toggle" aria-expanded={!shut[id]} onClick={() => setShut((x) => ({ ...x, [id]: !x[id] }))}>
                        <h2 id={`rg-h-${id}`}>{label} ({counts[id]})</h2><small>{sub}</small><Ico d={shut[id] ? I.down : I.up} size={18} />
                    </button>
                    {!shut[id] && <ul className="rg-menu">{menu.filter((i) => i.section === id).map((i) => <MenuRow key={i.id} i={i} n={g.qty[i.id] ?? 0} add={add} />)}</ul>}
                </section>
            ))}
            <p className="rg-fine">{bio.name} · {bio.charityNo}<br />Prices are suggested amounts. Every gift is paid straight to the charity.</p>

            <button type="button" className={cx("rg-menubtn", itemCount(g.qty) > 0 && "lift")} onClick={() => { setNav(true); track("rg_sheet", { sheet: "menu" }); }} aria-haspopup="dialog"><Ico d={I.list} size={16} />Menu</button>
            {nav && (
                <Sheet title="Menu" onClose={() => setNav(false)}>
                    <ul className="rg-navlist">
                        <li><button type="button" onClick={() => jump("bundles")}>Quick baskets<span>{BUNDLES.length}</span></button></li>
                        {SECTIONS.map(([id, label]) => <li key={id}><button type="button" onClick={() => jump(id)}>{label}<span>{counts[id]}</span></button></li>)}
                    </ul>
                </Sheet>
            )}
        </>
    );
};

/** The offers, one line at a time like a delivery app's restaurant header, turning every few seconds. */
const OFFERS: [string, string][] = [["Matched £1 for £1", `${MATCH.sponsor} doubles every gift until Eid`], ["+25% with Gift Aid", "UK taxpayers, at no cost to you"], ["100% Zakat policy", "Every penny to those eligible"]];
const Offers = () => {
    const [i, setI] = useState(0);
    useEffect(() => { if (matchMedia("(prefers-reduced-motion: reduce)").matches) return; const t = setInterval(() => setI((x) => (x + 1) % OFFERS.length), 4200); return () => clearInterval(t); }, []);
    return (
        <button type="button" className="rg-offer" onClick={() => setI((i + 1) % OFFERS.length)} aria-label={`Offer ${i + 1} of ${OFFERS.length}: ${OFFERS[i][0]}. Next offer`}>
            <span className="rg-offer-badge" aria-hidden="true"><Ico d={I.tag} size={14} /></span>
            <span key={i} className="rg-offer-text"><b>{OFFERS[i][0]}</b><small>{OFFERS[i][1]}</small></span>
            <span className="rg-offer-n" aria-hidden="true">{i + 1}/{OFFERS.length}<span>{OFFERS.map((_, k) => <i key={k} className={cx(k === i && "on")} />)}</span></span>
        </button>
    );
};
const MenuRow = ({ i, n, add }: { i: Item; n: number; add: Add }) => (
    <li className={cx("rg-row", n > 0 && "in")}>
        <div className="rg-row-text">
            {i.tag && <span className={cx("rg-tag", i.tag === "Most given" && "hot")}>{i.tag === "Most given" && <Ico d={I.star} size={12} fill />}{i.tag}</span>}
            <h3>{i.title}</h3>
            <p className="rg-price">{gbp(i.price)} <span>{i.per}</span></p>
            <p className="rg-note">{i.note}</p>
        </div>
        <div className="rg-row-art">
            <Tile art={i.art} />
            <Stepper n={n} name={i.title} onAdd={() => add(i.id, 1, "menu")} onRemove={() => add(i.id, -1, "menu")} />
            <small className="rg-row-cap">{i.once ? "Given once" : "Given nightly"}</small>
        </div>
    </li>
);

/** Wide screens: the basket beside the menu, like a delivery app on the web. */
const SideCart = ({ menu, g, q, add, set, onCheckout }: { menu: Item[]; g: Give; q: Quote; add: Add; set: SetGive; onCheckout: () => void }) => {
    const items = menu.filter((i) => g.qty[i.id]);
    if (!items.length) return <div className="rg-side-in rg-side-empty"><span className="rg-empty-art" aria-hidden="true"><Ico d={I.gift} size={30} /></span><b>Your basket is empty</b><small>Add causes from the menu. We’ll give them on every night you choose.</small></div>;
    return (
        <div className="rg-side-in">
            <h2>Your basket</h2>
            <ul className="rg-cart">{items.map((i) => <CartLine key={i.id} i={i} n={g.qty[i.id]} add={add} where="side" mode={g.mode} />)}</ul>
            <div className="rg-plan light" role="radiogroup" aria-label="Which nights">{MODES.slice(0, 4).map(([m, l]) => <button key={m} type="button" role="radio" aria-checked={g.mode === m} onClick={() => { set({ mode: m }); track("rg_schedule", { mode: m, where: "side" }); }}>{l}</button>)}</div>
            <Line k={g.mode === "once" ? "Once" : `${gbp(q.basket)} × ${q.nights.length} nights`} v={gbp(q.total)} strong />
            <button type="button" onClick={onCheckout} className="rg-cta">Continue<Ico d={I.arrow} size={18} /></button>
        </div>
    );
};
const CartLine = ({ i, n, add, where, mode }: { i: Item; n: number; add: Add; where: string; mode: Mode }) => (
    <li>
        <Tile art={i.art} className="sm" />
        <span className="min-w-0 flex-1"><b>{i.title}</b><small>{gbp(i.price)} {i.per}{/night/.test(i.per) ? "" : i.once || mode === "once" ? " · once" : " · nightly"}</small></span>
        <Stepper small n={n} name={i.title} onAdd={() => add(i.id, 1, where)} onRemove={() => add(i.id, -1, where)} />
        <strong>{gbp(i.price * n)}</strong>
    </li>
);

const nightDate = (bio: BioPage, n: number) => new Date(Date.parse(bio.ramadanStart) + (n - 1) * 86400000).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const detailsMissing = (g: Give) => {
    const d = g.donor;
    return Object.entries({ first: !d.first.trim(), last: !d.last.trim(), email: !/^\S+@\S+\.\S+$/.test(d.email), house: g.giftAid && !d.house.trim(), postcode: g.giftAid && !/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(d.postcode.trim()) }).filter(([, v]) => v).map(([k]) => k);
};

const Amount = ({ label, value, onChange, onDone }: { label: string; value: number; onChange: (n: number) => void; onDone: () => void }) => (
    <div className="rg-amount-in">
        <label><span>{label}</span><span className="rg-pound">£<input type="number" inputMode="decimal" min={0} max={1000} autoFocus value={value || ""} onChange={(e) => onChange(Math.max(0, Math.min(1000, Math.round(Number(e.target.value) * 100) / 100 || 0)))} onKeyDown={(e) => e.key === "Enter" && onDone()} /></span></label>
        <button type="button" onClick={onDone}>Done</button>
    </div>
);

/** Payment badges: SVG marks in public/pay, drawn at the card-network badge ratio (60 × 38). */
const MARK: Record<Method, string> = { apple: "/pay/apple-pay.svg", google: "/pay/google-pay.svg", card: "/pay/card.svg", paypal: "/pay/paypal.svg" };
const MethodMark = ({ m, small }: { m: Method; small?: boolean }) => <img src={MARK[m]} alt="" aria-hidden="true" width={small ? 32 : 46} height={small ? 20 : 29} className={cx("rg-mark", small && "sm")} />;

const Sheet = ({ title, sub, children, onClose }: { title: string; sub?: string; children: ReactNode; onClose: () => void }) => {
    useEffect(() => {
        const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        addEventListener("keydown", k); document.body.style.overflow = "hidden";
        return () => { removeEventListener("keydown", k); document.body.style.overflow = ""; };
    }, [onClose]);
    return (
        <div className="rg-sheet-wrap" onClick={onClose}>
            <div className="rg-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
                <span className="rg-grab" aria-hidden="true" />
                <div className="rg-sheet-head"><div><h2>{title}</h2>{sub && <p>{sub}</p>}</div><button type="button" className="rg-iconbtn" onClick={onClose} aria-label="Close"><Ico d={I.x} /></button></div>
                {children}
            </div>
        </div>
    );
};
const DetailsForm = ({ g, set, tried }: { g: Give; set: SetGive; tried: boolean }) => {
    const d = g.donor;
    const setD = (p: Partial<Donor>) => set((x) => ({ donor: { ...x.donor, ...p } }));
    const bad = new Set(tried ? detailsMissing(g) : []);
    return (
        <>
            <div className="rg-grid2">
                <Field label="First name" bad={bad.has("first")} value={d.first} onChange={(v) => setD({ first: v })} autoComplete="given-name" />
                <Field label="Last name" bad={bad.has("last")} value={d.last} onChange={(v) => setD({ last: v })} autoComplete="family-name" />
            </div>
            <Field label="Email for your receipts" type="email" bad={bad.has("email")} value={d.email} onChange={(v) => setD({ email: v })} autoComplete="email" />
            {g.giftAid && <>
                <div className="rg-grid2">
                    <Field label="House name or number" bad={bad.has("house")} value={d.house} onChange={(v) => setD({ house: v })} autoComplete="address-line1" />
                    <Field label="Postcode" bad={bad.has("postcode")} value={d.postcode} onChange={(v) => setD({ postcode: v.toUpperCase() })} autoComplete="postal-code" />
                </div>
                <p className="rg-decl">I am a UK taxpayer and understand that if I pay less Income Tax and/or Capital Gains Tax than the Gift Aid claimed on all my donations in that tax year, it is my responsibility to pay any difference.</p>
            </>}
            <label className="rg-check"><input type="checkbox" checked={d.anon} onChange={(e) => setD({ anon: e.target.checked })} /><span>Show my gift as anonymous</span></label>
            <label className="rg-check"><input type="checkbox" checked={d.news} onChange={(e) => setD({ news: e.target.checked })} /><span>Email me Ramadan updates from the charity</span></label>
        </>
    );
};
const CardForm = ({ card, setCard, tried }: { card: { num: string; exp: string; cvc: string }; setCard: (c: { num: string; exp: string; cvc: string }) => void; tried?: boolean }) => (
    <div className="rg-cardf">
        <Field label="Card number" inputMode="numeric" bad={(tried || card.num.replace(/\D/g, "").length >= 16) && !luhn(card.num)} value={card.num} onChange={(v) => setCard({ ...card, num: v.replace(/[^\d ]/g, "").slice(0, 23) })} autoComplete="cc-number" placeholder="1234 1234 1234 1234" />
        <div className="rg-grid2">
            <Field label="Expiry" inputMode="numeric" bad={(tried || card.exp.length === 5) && !expiryOk(card.exp)} value={card.exp} onChange={(v) => setCard({ ...card, exp: v.replace(/[^\d/]/g, "").replace(/^(\d{2})(\d)/, "$1/$2").slice(0, 5) })} autoComplete="cc-exp" placeholder="MM/YY" />
            <Field label="Security code" inputMode="numeric" bad={tried && !/^\d{3,4}$/.test(card.cvc)} value={card.cvc} onChange={(v) => setCard({ ...card, cvc: v.replace(/\D/g, "").slice(0, 4) })} autoComplete="cc-csc" placeholder="123" />
        </div>
    </div>
);
const Field = ({ label, bad, hint, onChange, ...p }: { label: string; bad?: boolean; hint?: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange">) => (
    <label className={cx("rg-field", bad && "bad")}>
        <span>{label}</span>
        <input {...p} onChange={(e) => onChange(e.target.value)} aria-invalid={bad || undefined} />
        {bad ? <small className="err">Please check this</small> : hint && <small>{hint}</small>}
    </label>
);

/** The payment in flight: the checkout's coin, lantern and gift fly across, then a tick bursts out when it goes through. */
const Paying = ({ phase, total, name }: { phase: "paying" | "success"; total: number; name: string }) => (
    <div className="ck rg-paying" role="status" aria-live="polite">
        {phase === "paying" ? (
            <>
                {[["18%", "34vw", "rgba(217,160,240,0),#D9A0F0", "0.55s"], ["31%", "22vw", "rgba(248,229,166,0),#F0CF63", "0.4s"], ["58%", "40vw", "rgba(201,235,216,0),#9AD3B6", "0.65s"], ["69%", "26vw", "rgba(251,214,206,0),#F5A999", "0.45s"]].map(([top, w, gr, dur]) => <span key={top} aria-hidden="true" className="ck-line" style={{ top, width: w, background: `linear-gradient(90deg,${gr})`, animationDuration: dur }} />)}
                {FLYERS.map(([trail, art], i) => <div key={i} aria-hidden="true" className={cx("ck-fly", i === 1 && "ck-fly2", i === 2 && "ck-fly3")}><span className="ck-trail" style={{ background: `linear-gradient(90deg,${trail})` }} />{art}</div>)}
                <div className="rg-paying-text"><strong>Sending {gbp(total)} to {name}</strong><span>Hold tight, this takes a few seconds.</span><div aria-hidden="true" className="rg-dots"><i /><i /><i /></div></div>
            </>
        ) : (
            <div className="rg-success">
                <div className="rg-burst" aria-hidden="true">{Array.from({ length: 16 }, (_, i) => <i key={i} style={{ "--a": `${i * (360 / 16)}deg`, "--d": `${(i % 3) * 40}ms` } as CSSProperties} />)}</div>
                <svg className="rg-tick" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="54" /><path d="M36 62l16 16 32-34" /></svg>
                <strong>Gift confirmed</strong>
                <span>JazakAllahu khayran</span>
            </div>
        )}
    </div>
);

/* ---------- The pile flow ----------
   A port of the "Gamified flow for any appeal (v2)" canvas, Pile flow (Flow2Pile.dc.html), in Outgive's colours (the layout, sizes and type are the design's), with the
   content made for Ramadan: the bundles are nightly amounts, How often picks the nights, "Make it monthly" doubles the last ten,
   and the next quest is the donor's nights. Sizes, colours and the pile's maths follow the design's own renderVals(). */
const GB = { green: "#F0783C", greenInk: "#C24A14", ink: "#191919", muted: "#666666", yellow: "#F0783C", mint: "#EEF2D6", mintSoft: "#FDEBDF", line: "#EEEEEE", quiet: "#F4F3F0", peach: "#FAD8C4" };
const short = (n: number) => `£${n % 1 ? n.toFixed(2) : n.toLocaleString("en-GB")}`;
const money = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** The appeal's colour, as the design gives each kind of appeal its own ground. */
const APPEAL_BG: Record<string, string> = { food: "#FDEBDF", water: "#F1EAFB", orphans: "#EEF2D6", emergency: "#FDEBDF", education: "#F1EAFB", shelter: "#FDEBDF" };
const FUNDS: Give["donor"]["giveAs"][] = ["Sadaqah", "Zakat", "Sadaqah Jariyah", "Lillah"];
const HOW: [Mode, string][] = [["once", "One-off"], ["30", "Every night"], ["10", "Last 10"], ["odd", "Odd nights"], ["fri", "Fridays"]];
/** Arrow keys for a radiogroup of buttons: move to the next or previous option, select it and focus it. Only the checked radio is in the tab order. */
const radioKeys = <T,>(opts: readonly T[], value: T, pick: (v: T) => void) => (e: React.KeyboardEvent<HTMLElement>) => {
    const by = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key], n = opts.length, i = opts.indexOf(value);
    const to = e.key === "Home" ? 0 : e.key === "End" ? n - 1 : by ? (Math.max(i, by > 0 ? -1 : 0) + by + n) % n : -1;
    if (to < 0) return;
    e.preventDefault(); pick(opts[to]); (e.currentTarget.querySelectorAll<HTMLElement>("[role=radio]")[to])?.focus();
};

const useNarrow = () => {
    const [m, setM] = useState(() => matchMedia("(max-width: 979px)").matches);
    useEffect(() => { const q = matchMedia("(max-width: 979px)"); const f = () => setM(q.matches); q.addEventListener("change", f); return () => q.removeEventListener("change", f); }, []);
    return m;
};
/** Tablets (600 to 979px) stack like phones but have room for the desktop scene. */
const useTablet = () => {
    const [t, setT] = useState(() => matchMedia("(min-width: 600px) and (max-width: 979px)").matches);
    useEffect(() => { const q = matchMedia("(min-width: 600px) and (max-width: 979px)"); const f = () => setT(q.matches); q.addEventListener("change", f); return () => q.removeEventListener("change", f); }, []);
    return t;
};
const Coin = ({ size = 22 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill={GB.yellow} stroke={GB.ink} strokeWidth="3" /><circle cx="20" cy="20" r="10" fill="none" stroke={GB.ink} strokeWidth="2" opacity=".45" /></svg>;

/** The appeal the pile is for: the biggest cause in the basket, with the page's totals. */
const appealOf = (bio: BioPage, menu: Item[], g: Give) => {
    const top = menu.filter((i) => g.qty[i.id] && !i.once).sort((a, b) => b.price * g.qty[b.id] - a.price * g.qty[a.id])[0];
    const raised = bio.campaigns.reduce((n, x) => n + x.raised, 0) + bio.causes.reduce((n, x) => n + x.raised, 0);
    const goal = bio.campaigns.reduce((n, x) => n + x.goal, 0) + bio.causes.reduce((n, x) => n + x.goal, 0);
    return { title: top?.title ?? "Where most needed", art: top?.art ?? "zakat", bg: APPEAL_BG[top?.art ?? ""] ?? GB.mint, raised, goal, backers: bio.backers ?? 388, live: bio.backers !== undefined };
};

/** The pile's columns: a bell of peach coins, with the donor's yellow coins on top, as the design draws it. */
const pileCols = (amt: number, m: boolean, scale: "stage" | "card") => {
    const N = scale === "card" ? 9 : m ? 9 : 11, ctr = (N - 1) / 2;
    const CH = scale === "card" ? 7 : m ? 6 : 10, CW = scale === "card" ? 34 : m ? 30 : 50, B = scale === "card" ? 7 : m ? 7 : 12;
    const w = Array.from({ length: N }, (_, i) => Math.exp(-Math.pow((i - ctr) / (N / 4.4), 2)));
    const sw = w.reduce((a, b) => a + b, 0);
    const Y = amt > 0 ? Math.min(scale === "card" ? 24 : m ? 30 : 72, Math.max(3, Math.round(4 * Math.sqrt(amt)))) : 0;
    const stripes = (f: string) => `repeating-linear-gradient(to bottom,${f} 0 ${CH - 2.4}px,${GB.ink} ${CH - 2.4}px ${CH}px)`;
    let peak = 0;
    const cols = w.map((wi, i) => {
        const b = Math.round(2 + B * wi), y = Math.round((Y * wi / sw) * 1.6);
        peak = Math.max(peak, (b + y) * CH);
        return {
            col: { margin: `0 ${scale === "card" ? -5 : m ? -4 : -7}px`, zIndex: (N - Math.abs(i - ctr) * 2) | 0 } as CSSProperties,
            cap: { width: CW, height: scale === "card" ? 12 : m ? 11 : 17, marginBottom: -(scale === "card" ? 6 : m ? 6 : 9), background: y > 0 ? GB.yellow : GB.peach } as CSSProperties,
            you: { width: CW, height: y * CH, background: stripes(GB.yellow) } as CSSProperties,
            base: { width: CW, height: b * CH + 6, borderRadius: `0 0 ${CW / 2}px ${CW / 2}px / 0 0 7px 7px`, background: stripes(GB.peach) } as CSSProperties,
        };
    });
    return { cols, peak };
};
const PileCols = ({ cols }: { cols: ReturnType<typeof pileCols>["cols"] }) => <>{cols.map((c, i) => <span key={i} className="gb-col" style={c.col}><span className="gb-cap" style={c.cap} /><span className="gb-you" style={c.you} /><span className="gb-base" style={c.base} /></span>)}</>;

const SK = ["#F1C9A0", "#C68B5E", "#8D5A3B", "#E8B48A", "#F5D5B8", "#A86F48"];
type Fig = { x: [number, number]; dy: [number, number]; sc: number; name: string; give: number; skin: string; cloth: string; scarf: string | null; you?: boolean };
const Figure = ({ f, m, floorB, youLabel }: { f: Fig; m: boolean; floorB: number; youLabel: string }) => {
    const x = m ? f.x[1] : f.x[0], dy = m ? f.dy[1] : f.dy[0];
    return (
        <div className="gb-fig" style={{ left: `${x}%`, bottom: floorB + dy, transform: `translateX(-50%) scale(${f.sc * (m ? 0.62 : 1.3)})`, gap: f.scarf ? 14 : 8, zIndex: f.you ? 6 : dy > 0 ? 1 : 4 }}>
            <span className={cx("gb-fig-tag", f.you && "you")} style={{ fontSize: m ? 17 : 12 }}>{f.you ? youLabel : `${f.name} · ${short(f.give)}`}</span>
            <span className="gb-fig-body">
                <span className="gb-fig-head" style={{ background: `radial-gradient(circle at 36% 52%,${GB.ink} 0 2.2px,transparent 2.8px),radial-gradient(circle at 64% 52%,${GB.ink} 0 2.2px,transparent 2.8px),${f.skin}`, boxShadow: f.scarf ? `0 0 0 7px ${f.scarf},0 0 0 9.6px ${GB.ink}` : undefined }} />
                <span className="gb-fig-torso" style={{ width: f.you ? 70 : 62, height: f.you ? 62 : 56, marginTop: f.scarf ? 2 : -4, background: f.cloth }} />
                <span className="gb-fig-hand" style={{ background: f.skin, [x < 50 ? "right" : "left"]: -12 } as CSSProperties}><Coin size={18} /></span>
            </span>
        </div>
    );
};

/** Step 1's stage: the appeal chip, the pile counter, the sky line, the pile with everyone around it, and the crowd bar. */
const Stage = ({ m, tablet, amt, perS, bio, menu, g }: { m: boolean; tablet?: boolean; amt: number; perS: string; bio: BioPage; menu: Item[]; g: Give }) => {
    const ap = appealOf(bio, menu, g);
    const { cols, peak } = pileCols(amt, m, "stage");
    const floorB = m ? 54 : 110;
    // The falling coins stay below the sky line: lower on the shorter tablet stage.
    const pileTop = Math.min(floorB + peak + (m ? 26 : 40), m ? 250 : tablet ? 400 : 470);
    const pctB = Math.min(100, (ap.raised / ap.goal) * 100), pctA = Math.min(100, ((ap.raised + amt) / ap.goal) * 100);
    const F = LEVELS.map(([v]) => v);
    const back: Fig[] = [{ x: [30, 31], dy: [96, 52], sc: 0.84, name: "Maryam", give: F[1], skin: SK[3], cloth: "#DCCBF3", scarf: "#D2DBA0" }, { x: [70, 69], dy: [96, 52], sc: 0.84, name: "Idris", give: F[0], skin: SK[1], cloth: "#FDEBDF", scarf: null }];
    const front: Fig[] = [{ x: [8, 11], dy: [14, 8], sc: 0.94, name: "Aisha", give: F[2], skin: SK[0], cloth: "#FAD8C4", scarf: "#2F3A22" }, { x: [20, 25], dy: [-34, -20], sc: 1.08, name: "Yusuf", give: F[1], skin: SK[2], cloth: "#D2DBA0", scarf: null }, { x: [80, 75], dy: [-34, -20], sc: 1.12, name: "You", give: 0, skin: SK[4], cloth: GB.green, scarf: null, you: true }, { x: [92, 89], dy: [14, 8], sc: 0.94, name: "Hana", give: F[3], skin: SK[5], cloth: "#EEF2D6", scarf: "#DCCBF3" }];
    const youLabel = `You · ${amt > 0 ? short(amt) + perS : "?"}`;
    const drop = (dx: number, dy: number, r: number): CSSProperties => ({ left: `calc(50% + ${dx}px)`, bottom: pileTop + dy, transform: `translateX(-50%) rotate(${r}deg)` });
    return (
        <div className={cx("gb-stage", m && "m", tablet && "t")} style={{ background: ap.bg }}>
            <svg className="gb-stage-dots" aria-hidden="true"><defs><pattern id="gbdots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.6" fill={GB.ink} opacity=".08" /></pattern></defs><rect width="100%" height="100%" fill="url(#gbdots)" /></svg>
            <span className="gb-halo" style={{ bottom: floorB - (m ? 150 : 260), width: m ? 380 : 720, height: m ? 380 : 720 }} />
            <div className="gb-apchip" style={m ? { left: 10, top: 10, width: "calc(52% - 18px)", padding: "8px 12px 8px 8px" } : undefined}>
                <span className="gb-apart" style={{ background: ap.bg, width: m ? 40 : 56, height: m ? 40 : 56 }}><CauseArt name={ap.art} /></span>
                <span className="gb-apinfo">
                    {!m && <span className="gb-apcharity">{bio.name}<Ico d={I.added} size={16} fill /></span>}
                    <b style={{ fontSize: m ? 13 : 17 }}>{ap.title}</b>
                    {m ? <span className="gb-apsub">{Math.round(pctA)}% funded</span> : <>
                        <span className="gb-apbar"><span style={{ width: `${pctB}%` }} /><span className="you" style={{ left: `${pctB}%`, width: `${Math.max(0, pctA - pctB)}%`, minWidth: amt > 0 ? 8 : 0 }} /></span>
                        <span className="gb-apsub"><b>£{Math.round(ap.raised).toLocaleString("en-GB")}</b> of £{ap.goal.toLocaleString("en-GB")} · {Math.round(pctA)}%</span>
                    </>}
                </span>
            </div>
            <div className="gb-counter" style={m ? { right: 10, top: 10, padding: "8px 10px" } : undefined}>
                <span>IN THE PILE</span>
                <b style={{ fontSize: m ? 20 : 34 }}>£{Math.round(ap.raised + amt).toLocaleString("en-GB")}</b>
                {amt > 0 && <span className="gb-fromyou"><Coin size={18} />+{Math.round(amt)} from you</span>}
            </div>
            {!m && <div className="gb-sky"><b>You + {ap.backers.toLocaleString("en-GB")} people, one pile</b><span>Watch the orange coins: that is your bundle, every night.</span></div>}
            <span className="gb-floor" style={{ height: floorB }} />
            {back.map((f) => <Figure key={f.name} f={f} m={m} floorB={floorB} youLabel={youLabel} />)}
            <div className="gb-pile" style={{ bottom: floorB - (m ? 10 : 14) }}><PileCols cols={cols} /></div>
            {amt > 0 && <>
                <span key={`a${amt}`} className="gb-drop gb-in" style={drop(-6, 8, -12)}><Coin size={m ? 26 : 40} /></span>
                <span key={`b${amt}`} className="gb-drop gb-in" style={{ ...drop(m ? 26 : 60, m ? 34 : 40, 16), animationDelay: ".08s" }}><Coin size={m ? 20 : 32} /></span>
                <span key={`c${amt}`} className="gb-drop gb-in" style={{ ...drop(m ? -30 : -64, m ? 54 : 70, -4), animationDelay: ".16s" }}><Coin size={m ? 16 : 26} /></span>
            </>}
            {front.map((f) => <Figure key={f.name} f={f} m={m} floorB={floorB} youLabel={youLabel} />)}
            {!m && <div className="gb-crowd"><span className="gb-crowd-av"><i style={{ background: "#FAD8C4" }}>AK</i><i style={{ background: "#DCCBF3" }}>YS</i><i style={{ background: "#D2DBA0" }}>MH</i></span><span><b>{(ap.backers + (amt > 0 ? 1 : 0)).toLocaleString("en-GB")}</b> people around this appeal</span><span style={{ flex: 1 }} />{!ap.live && <span className="gb-today">+12 tonight</span>}</div>}
        </div>
    );
};

const GiveStep = ({ menu, g, set, q, bio, onMenu, onNext }: { menu: Item[]; g: Give; set: SetGive; q: Quote; bio: BioPage; onMenu: () => void; onNext: () => void }) => {
    const m = useNarrow(), tab = useTablet();
    useEffect(() => { if (!q.nightly) set({ amount: 10 }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const amt = q.nightly, A = LEVELS.map(([v]) => v);
    const lvl = levelOf(amt), next = LEVELS[lvl];
    const once = g.mode === "once";
    const perS = once ? "" : "/night";
    const [raw, setRaw] = useState<string | null>(null);
    const pick = (v: number) => { setRaw(null); set({ amount: Math.max(1, Math.min(100000, v)) }); track("rg_bundle_pick", { value: v, level: levelOf(v) }); };
    const stepUp = () => pick(A.find((t) => t > amt) ?? amt + A[3]);
    const stepDown = () => pick(A.slice().reverse().find((t) => t < amt) ?? Math.max(1, amt - A[0]));
    const items = menu.filter((i) => g.qty[i.id] && !i.once);
    const impact = impactOf(q.gifts - q.onceItems, g.qty, menu) || (amt ? `${short(q.gifts - q.onceItems)} where it is needed most` : "Pick an amount to see your impact");
    const nights = q.nights.length;
    const yearTxt = once ? "" : `${short(q.gifts - q.onceItems)} over ${nights} ${nights === 1 ? "night" : "nights"}`;
    const showBehalf = g.donor.giveAs === "Sadaqah" || g.donor.giveAs === "Sadaqah Jariyah";
    const behalfOn = !!g.donor.behalfOn;
    return (
        <div className={cx("gb-give", m && "m")}>
            <Stage m={m && !tab} tablet={m && tab} amt={amt} perS={perS} bio={bio} menu={menu} g={g} />
            <main className="gb-form">
                <div className="gb-titles">
                    <h1 className="gb-h" style={{ fontSize: m ? 30 : 44 }}>Add to the pile</h1>
                    <span>Pick a nightly bundle of coins for {items.length ? <button type="button" className="gb-tx" onClick={onMenu}>{items.map((i) => i.title).join(", ")}</button> : <>where it’s needed most (<button type="button" className="gb-tx" onClick={onMenu}>choose causes</button>)</>}. It lands on the pile with everyone else’s.</span>
                </div>
                <div className="gb-bundles" role="radiogroup" aria-label="Nightly bundle" style={{ gap: m ? 6 : 8 }} onKeyDown={radioKeys(LEVELS.map(([v]) => v), amt, pick)}>
                    {LEVELS.map(([v, name], i) => (
                        <button key={v} type="button" role="radio" aria-checked={amt === v} tabIndex={amt === v || (i === 0 && !LEVELS.some(([x]) => x === amt)) ? 0 : -1} onClick={() => pick(v)} className={cx("gb-bundle", amt === v && "on")}>
                            <span className="gb-bundle-stack" style={{ height: m ? 38 : 50 }}>{Array.from({ length: i + 1 }, (_, k) => <span key={k} style={{ width: m ? 22 : 28, height: m ? 8 : 10, background: amt === v ? GB.yellow : GB.peach }} />)}</span>
                            <b>{short(v)}</b>
                            <span className="gb-bundle-name">{name}</span>
                        </button>
                    ))}
                </div>
                <div className="gb-amount">
                    <button type="button" onClick={stepDown} aria-label="Previous level" className="down"><Ico d={I.minus} size={20} /></button>
                    <label>
                        <span className="gb-h" style={{ fontSize: m ? 60 : 76, color: "#8F8F8F" }}>£</span>
                        <input aria-label="Amount each night" inputMode="numeric" value={raw ?? String(amt)} onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 6); setRaw(v); set({ amount: parseInt(v, 10) || 0 }); }} onBlur={() => setRaw(null)} style={{ fontSize: m ? 60 : 76, width: `${Math.max(1, String(raw ?? amt).length) * 0.62 + 0.2}em` }} />
                        <span className="gb-per">{perS}</span>
                    </label>
                    <button type="button" onClick={stepUp} aria-label="Next level" className="up"><Ico d={I.plus} size={20} /></button>
                </div>
                <div className="gb-becomes" style={{ background: appealOf(bio, menu, g).bg }}>
                    <span className="gb-becomes-art"><CauseArt name={appealOf(bio, menu, g).art} /></span>
                    <span><small>YOUR BUNDLE BECOMES</small><b>{impact}</b><em>Level {Math.max(1, lvl)} · {lvl ? LEVELS[lvl - 1][1] : "Supporter"} · {next ? `${short(next[0] - amt)} to Level ${lvl + 1}` : "top level"}</em></span>
                </div>
                {next && amt > 0 && (
                    <div className="gb-nudge">
                        <span><b>{short(next[0] - amt)} more a night unlocks Level {lvl + 1} · {next[1]}</b><span>{impactOf(next[0] * Math.max(1, nights), g.qty, menu) || "A bigger gift on every night"}</span></span>
                        <button type="button" className="gb-btn neutral sm" onClick={() => { pick(next[0]); track("rg_levelup", { to: lvl + 1 }); }}>Level up to {short(next[0])}</button>
                    </div>
                )}
                <div className="gb-how">
                    <div className="gb-how-head"><b>How often</b><span>{yearTxt}</span></div>
                    <div className="gb-freqs" role="radiogroup" aria-label="How often" style={{ "--n": HOW.length, "--i": HOW.findIndex(([mo]) => mo === g.mode) } as CSSProperties} data-none={HOW.some(([mo]) => mo === g.mode) ? undefined : ""} onKeyDown={radioKeys(HOW.map(([mo]) => mo), g.mode, (mo) => { set({ mode: mo }); track("rg_schedule", { mode: mo }); })}>{HOW.map(([mo, l], i) => <button key={mo} type="button" role="radio" aria-checked={g.mode === mo} tabIndex={g.mode === mo || (i === 0 && !HOW.some(([x]) => x === g.mode)) ? 0 : -1} className={cx(g.mode === mo && "on")} onClick={() => { set({ mode: mo }); track("rg_schedule", { mode: mo }); }}>{l}</button>)}</div>
                </div>
                <div className="gb-giveas"><b>Give as</b><span className="gb-input sel"><select aria-label="Donation type" value={g.donor.giveAs} onChange={(e) => { const v = e.target.value as Give["donor"]["giveAs"]; set((x) => ({ donor: { ...x.donor, giveAs: v, zakat: v === "Zakat" } })); track("rg_give_as", { value: v }); }}>{FUNDS.map((f) => <option key={f}>{f}</option>)}</select></span></div>
                {showBehalf && (
                    <div className={cx("gb-behalf", behalfOn && "on")}>
                        <label><input type="checkbox" className="gb-checkbox" checked={behalfOn} onChange={(e) => { set((x) => ({ donor: { ...x.donor, behalfOn: e.target.checked } })); track("rg_behalf", { open: e.target.checked ? 1 : 0 }); }} /><span><b>Give this {g.donor.giveAs} on behalf of someone</b><span>A parent, a child or a loved one who has passed away</span></span></label>
                        {behalfOn && <div className="gb-behalf-name"><input aria-label="Their name" placeholder="Their name, e.g. Amina Ahmed" value={g.donor.behalf} onChange={(e) => set((x) => ({ donor: { ...x.donor, behalf: e.target.value } }))} /><span>Shown on your receipt and on the pile as "{g.donor.giveAs} for {g.donor.behalf || "their name"}".</span></div>}
                    </div>
                )}
                {!m && <>
                    <button type="button" className="gb-btn primary lg" onClick={onNext} disabled={amt < 1 || !q.total}>Continue with {short(amt)}{perS}<span className="gb-coinpill"><Coin size={18} />+{Math.round(amt)}</span></button>
                    <span className="gb-fine"><Ico d={I.lock} size={14} fill />Secure checkout · Gift Aid on the next step</span>
                </>}
            </main>
            {m && (
                <div className="gb-mbar">
                    <span><b>£{Math.round(amt)}{perS}</b><span>Level {Math.max(1, lvl)} · {lvl ? LEVELS[lvl - 1][1] : "Supporter"}</span></span>
                    <button type="button" className="gb-btn primary" onClick={onNext} disabled={amt < 1 || !q.total}>Continue<span className="gb-coinpill sm"><Coin size={16} />+{Math.round(amt)}</span></button>
                </div>
            )}
        </div>
    );
};

/** A labelled field in the design's style. Top level, so typing never remounts it. */
const GbField = ({ label, type, ac, ph, bad, value, onChange }: { label: string; type?: string; ac: string; ph: string; bad: boolean; value: string; onChange: (v: string) => void }) => (
    <label className={cx("gb-field", bad && "bad")}><span>{label}</span><input aria-label={label} type={type} placeholder={ph} autoComplete={ac} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={bad || undefined} />{bad && <small>Please check this</small>}</label>
);

const PAY: { id: Method; label: string; sub: string; marks: string[]; note: string }[] = [
    { id: "card", label: "Card", sub: "Visa, Mastercard, Amex", marks: ["Visa", "Mastercard", "Amex"], note: "" },
    { id: "apple", label: "Apple Pay", sub: "Fastest on iPhone and Mac", marks: ["Apple Pay"], note: "You will confirm with Face ID or Touch ID after pressing the button below." },
    { id: "google", label: "Google Pay", sub: "Pay with a saved Google card", marks: ["Google Pay"], note: "A Google Pay window opens to confirm. Your card details stay with Google." },
    { id: "paypal", label: "PayPal", sub: "Log in to your PayPal account", marks: ["PayPal"], note: "You will be taken to PayPal to log in and confirm, then brought back here." },
];

const CompleteStep = ({ menu, g, set, q, bio, live, onEdit, onPaid }: { menu: Item[]; g: Give; set: SetGive; q: Quote; bio: BioPage; live: Live | null; onEdit: () => void; onPaid: (p: Paid) => void }) => {
    const m = useNarrow();
    const [phase, setPhase] = useState<"idle" | "paying" | "success">("idle");
    const [error, setError] = useState("");
    const [tried, setTried] = useState(false);
    const [card, setCard] = useState({ num: "", exp: "", cvc: "", name: "" });
    const [customTip, setCustomTip] = useState(false);
    const [msgOn, setMsgOn] = useState(!!g.donor.note);
    const d = g.donor;
    const setD = (p: Partial<Give["donor"]>) => set((x) => ({ donor: { ...x.donor, ...p } }));
    const ap = appealOf(bio, menu, g);
    const amt = q.nightly, lvl = levelOf(amt), once = g.mode === "once" || !q.nights.length;
    const lastTen = !once && q.nights.some((n) => n > 20);
    const perS = once ? "" : "/night";
    const bad = new Set(tried ? detailsMissing(g) : []);
    // Live: Stripe's own fields take the card and check it; the flow's card inputs are the demo's.
    const stripeRef = useRef<StripeFieldsHandle>(null);
    const attempt = useRef<{ sig: string; key: string } | null>(null);
    const cardBad = isDemo && g.method === "card" && (!luhn(card.num) || !expiryOk(card.exp) || !/^\d{3,4}$/.test(card.cvc));
    // The tip is a share of each night's gift, on the design's 0 to 30% scale, or an amount typed in.
    const tp = amt ? Math.round((g.tip / amt) * 100) : 0;
    const onStop = [0, 5, 10, 15, 20, 25, 30].includes(tp) && !customTip;
    const tPos = (Math.min(30, tp) / 30) * 100;
    const setTip = (pct: number) => { setCustomTip(false); set({ tip: Math.round(amt * pct) / 100 }); track("rg_tip", { value: pct, unit: "pct" }); };
    const ga = g.giftAid ? q.giftAid : 0;
    const powerOn = (g.giftAid ? 1 : 0) + (g.boost === "double" ? 1 : 0);
    const impact = impactOf(q.gifts - q.onceItems, g.qty, menu);
    const kCols = pileCols(amt, false, "card");
    const giftSub = `${d.giveAs}${d.behalfOn && d.behalf ? ` for ${d.behalf}` : ""} · ${once ? "One-off" : `${q.nights.length} nights${g.boost === "double" && lastTen ? ", last 10 doubled" : ""}`}${q.onceItems ? ` + ${short(q.onceItems)} today` : ""} · Level ${Math.max(1, lvl)}`;
    const pay = () => {
        const missing = detailsMissing(g);
        if (missing.length || cardBad) { setTried(true); track("rg_pay_invalid", { fields: [...missing, ...(cardBad ? ["card"] : [])].join(",") }); setTimeout(() => document.querySelector(".gb-field.bad input, .gb-card.bad input")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50); return; }
        if (!isDemo) return void payLive();
        setError(""); setPhase("paying");
        track("rg_pay_start", { method: g.method, total: q.total, payments: q.charges.length, mode: g.mode, giftaid: g.giftAid ? 1 : 0 });
        // ponytail: simulated payment. Stripe's decline test card fails; swap in the checkout's payment provider to take real money.
        setTimeout(() => {
            if (g.method === "card" && card.num.replace(/\D/g, "") === "4000000000000002") { setPhase("idle"); setError("Your card was declined. Nothing was taken. Try another card, or Apple Pay."); track("rg_pay_fail", { reason: "declined", method: g.method }); return; }
            setPhase("success");
            track("rg_paid", { method: g.method, total: q.total, gifts: q.gifts, payments: q.charges.length, mode: g.mode, items: itemCount(g.qty), giftaid: g.giftAid ? 1 : 0, tip: q.tips, level: lvl });
            setTimeout(() => onPaid({ ...paidFrom(`RG-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, g, q, menu), impact, level: lvl }), 1900);
        }, 2900);
    };
    /** The real payment, through the pay function. A retry of the same basket reuses the attempt key, so it can never charge twice. */
    const payLive = async () => {
        if (!live) { setError("Payments are not set up for this charity yet."); return; }
        const fail = (r: PayResult) => { setPhase("idle"); setError(r.error?.message ?? r.message ?? "The payment didn’t go through. Try again. You won’t be charged twice."); track("rg_pay_fail", { reason: r.error?.code ?? r.status, method: g.method }); };
        setError("");
        if (g.method !== "paypal") { const bad = await stripeRef.current?.submit(); if (bad) { setError(bad.message); return; } }
        const sig = JSON.stringify([g, q.total]);
        if (attempt.current?.sig !== sig) attempt.current = { sig, key: crypto.randomUUID().replace(/-/g, "") };
        setPhase("paying");
        track("rg_pay_start", { method: g.method, total: q.total, payments: 1, mode: g.mode, giftaid: g.giftAid ? 1 : 0, live: 1 });
        const p = payFunction((await db()).fn, () => stripeRef.current);
        let r = await p.start(payBody(g, q, menu, live.org_id, attempt.current.key));
        if (r.status === "requires_action") r = await p.confirm(r);
        if (r.status === "processing" && !r.delayed) r = await settle(p, r.id);
        if (r.status !== "succeeded" && r.status !== "processing") return fail(r);
        setPhase("success");
        track("rg_paid", { method: g.method, total: q.total, gifts: q.gifts, payments: 1, mode: g.mode, items: itemCount(g.qty), giftaid: g.giftAid ? 1 : 0, tip: q.tips, level: lvl, live: 1 });
        setTimeout(() => onPaid(paidFrom(r.id.slice(0, 8).toUpperCase(), g, q, menu)), 1900);
    };
    const Text = ({ k, label, type, ac, ph }: { k: "email" | "first" | "last" | "house" | "postcode"; label: string; type?: string; ac: string; ph: string }) =>
        <GbField label={label} type={type} ac={ac} ph={ph} bad={bad.has(k)} value={d[k]} onChange={(v) => setD({ [k]: k === "postcode" ? v.toUpperCase() : v })} />;
    const summary = (
        <>
            <div className="gb-lines">
                <div className="gb-line"><span><span>Your gift</span><small>{giftSub}</small></span><b>{money(q.gifts)}</b></div>
                {g.giftAid && <div className="gb-line green"><span>Gift Aid from HMRC</span><b>+{money(ga)}</b></div>}
                <div className="gb-tipcard">
                    <div className="gb-tipcard-head"><b className="gb-h">Support our mission</b><svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10A4.3 4.3 0 0112 7.4a4.3 4.3 0 017.5 3.1c0 5.4-7.5 10-7.5 10z" fill={GB.yellow} stroke={GB.ink} strokeWidth="1.8" strokeLinejoin="round" /></svg><span style={{ flex: 1 }} /><span className="gb-tipnow">{g.tip ? `${money(g.tip)}${perS}` : "No tip"}</span></div>
                    <span className="gb-tipcard-tx">Without tips we can’t keep the lights on. Your support keeps Outgive free for the charities you love. Thank you.</span>
                    <div className="gb-tipslider">
                        <b>0%</b>
                        <div className="gb-track">
                            <div className="gb-segs">{[0, 1, 2, 3, 4, 5].map((k) => { const f = Math.max(0, Math.min(1, (Math.min(30, tp) - k * 5) / 5)); return <span key={k}><span style={{ width: `${f * 100}%` }} /></span>; })}</div>
                            <span className="gb-bubble" style={{ left: `${tPos}%`, transform: `translateX(${tPos < 15 ? -15 : tPos > 85 ? -85 : -50}%)` }}>{tp}% <span>({money(g.tip)})</span></span>
                            <span className="gb-thumb" style={{ left: `calc(${tPos}% - 14px)` }} />
                            {[0, 5, 10, 15, 20, 25, 30].map((t, i) => <button key={t} type="button" aria-label={`Tip ${t}%`} aria-pressed={onStop && tp === t} onClick={() => setTip(t)} style={{ left: `calc(${(i / 6) * 100}% - 20px)` }} />)}
                        </div>
                        <b style={{ width: 32, textAlign: "right" }}>30%</b>
                    </div>
                    <div className="gb-tipcustom"><button type="button" className="gb-tx" onClick={() => setCustomTip(!customTip)}>{customTip ? "Use the slider" : "Enter custom amount"}</button>{customTip && <span className="gb-input sm"><b>£</b><input aria-label="Custom tip amount" inputMode="decimal" value={g.tip || ""} onChange={(e) => set({ tip: Math.max(0, Math.min(1000, Math.round(Number(e.target.value.replace(/[^0-9.]/g, "")) * 100) / 100 || 0)) })} onBlur={() => track("rg_tip", { value: g.tip, unit: "custom" })} /></span>}</div>
                </div>
                <div className="gb-power">
                    <div><b>Gift power</b><b className="green">{money(q.gifts + ga)} to the appeal</b></div>
                    <div className="gb-power-bar"><span className="gift" /><span className={cx("ga", g.giftAid && "on")} /></div>
                    <span>{g.giftAid ? `Your gift plus 25% Gift Aid, paid by HMRC. With the £1 for £1 match, ${bio.name} receives ${money(q.receives)}.` : `Switch on Gift Aid to fill the bar: +${short(Math.round(q.gifts * 25) / 100)} at no cost to you.`}</span>
                </div>
                <div className="gb-rule" />
                <div className="gb-total"><b>{once ? "Total today" : `Total over ${q.charges.length} payments`}</b><b className="gb-h" style={{ fontSize: m ? 28 : 36 }}>{money(q.total)}</b></div>
            </div>
            {error && <p role="alert" className="rg-error">{error}</p>}
            <button type="button" className="gb-btn primary lg" onClick={pay} disabled={phase !== "idle"}>{phase !== "idle" ? "Processing…" : once || !isDemo ? `Donate ${money(q.total)}` : `Donate ${money(q.charges.find((c) => c.night > 0)?.total ?? q.total)}${perS}`}</button>
            <span className="gb-fine"><Ico d={I.lock} size={14} fill />Encrypted by Stripe · 100% of your gift reaches {bio.name} · simulated in this preview</span>
        </>
    );
    return (
        <div className={cx("gb-pay", m && "m")}>
            <div className="gb-pay-form"><div className="gb-pay-in">
                <div className="gb-titles"><h1 className="gb-h" style={{ fontSize: m ? 30 : 44 }}>Complete your gift</h1>{!m && <span>Your coins are waiting at the pile. This takes about a minute.</span>}</div>
                <section className="gb-sec">
                    <h2>Contact</h2>
                    {Text({ k: "email", label: "Email", type: "email", ac: "email", ph: "you@example.com" })}
                    <div className="gb-names" style={{ gridTemplateColumns: m ? "1fr" : "1fr 1fr" }}>{Text({ k: "first", label: "First name", ac: "given-name", ph: "First name" })}{Text({ k: "last", label: "Last name", ac: "family-name", ph: "Last name" })}</div>
                </section>
                <div className="gb-rule" />
                <section className="gb-sec tight">
                    <div className="gb-sec-head"><b>Power-ups</b><span>{powerOn === (lastTen ? 2 : 1) ? `${powerOn} of ${powerOn} on · full power` : `${powerOn} of ${lastTen ? 2 : 1} on`}</span></div>
                    <div className={cx("gb-pu", g.giftAid ? "on" : "ga")}>
                        <div className="gb-pu-row"><span className="gb-pu-badge" style={{ background: GB.yellow }}>+25%</span><span className="gb-pu-tx"><b>Boost it with Gift Aid</b><span>Add <b>{short(Math.round(q.gifts * 25) / 100)}</b> at no cost to you. UK taxpayers only.</span></span><input type="checkbox" className="gb-toggle" checked={g.giftAid} onChange={() => { set({ giftAid: !g.giftAid }); track("rg_addon", { id: "giftAid", on: g.giftAid ? 0 : 1 }); }} aria-label="Add Gift Aid" /></div>
                        {g.giftAid && <div className="gb-pu-more"><span>I am a UK taxpayer and understand that if I pay less Income Tax and/or Capital Gains Tax than the amount of Gift Aid claimed on all my donations in that tax year it is my responsibility to pay any difference.</span><div className="gb-names" style={{ gridTemplateColumns: "1fr 1fr" }}>{Text({ k: "house", label: "House name or number", ac: "address-line1", ph: "12" })}{Text({ k: "postcode", label: "Home postcode", ac: "postal-code", ph: "E1 6AN" })}</div></div>}
                    </div>
                    {lastTen && (
                        <div className={cx("gb-pu", g.boost === "double" ? "on" : "mo")}>
                            <div className="gb-pu-row"><span className="gb-pu-badge" style={{ background: "#F1EAFB" }}>×2</span><span className="gb-pu-tx"><b>{g.boost === "double" ? "Last 10 nights doubled" : "Double the last 10 nights"}</b><span>{g.boost === "double" ? `${short(amt * 2)} on each of nights 21 to 30. Laylat al-Qadr badge unlocked.` : `Give ${short(amt * 2)} on each of nights 21 to 30, to catch Laylat al-Qadr.`}</span></span><input type="checkbox" className="gb-toggle" checked={g.boost === "double"} onChange={() => { set({ boost: g.boost === "double" ? 0 : "double" }); track("rg_boost", { value: g.boost === "double" ? "0" : "double" }); }} aria-label="Double the last 10 nights" /></div>
                        </div>
                    )}
                </section>
                <div className="gb-rule" />
                <section className="gb-sec">
                    <div className="gb-sec-head"><h2>Payment</h2><span className="muted"><Ico d={I.lock} size={14} fill />Secure</span></div>
                    <div className="gb-methods">
                        {PAY.map((pm) => { const on = g.method === pm.id; return (
                            <div key={pm.id} className={cx("gb-method", on && "on")}>
                                <button type="button" aria-pressed={on} onClick={() => { set({ method: pm.id }); track("rg_method", { method: pm.id }); }}>
                                    <span className="gb-method-tile"><Ico d={pm.id === "card" ? I.card : I.lock} size={20} /></span>
                                    <span className="gb-method-tx"><b>{pm.label}</b><span>{pm.sub}</span></span>
                                    <span className="gb-marks">{pm.id === "card" ? pm.marks.map((mk) => <span key={mk}>{mk}</span>) : <MethodMark m={pm.id} />}</span>
                                    <span className="gb-radio" />
                                </button>
                                {on && !isDemo && pm.id !== "paypal" && (
                                    <div className="gb-method-body">
                                        <StripeFields ref={stripeRef} total={q.total} currency="GBP" method={pm.id === "card" ? "card" : "wallet"} onBehalfOf={live?.stripe_account ?? null} />
                                    </div>
                                )}
                                {on && isDemo && pm.id === "card" && (
                                    <div className="gb-method-body">
                                        <div className={cx("gb-card", tried && cardBad && "bad")}>
                                            <span><input aria-label="Card number" placeholder="Card number" inputMode="numeric" autoComplete="cc-number" value={card.num} onChange={(e) => setCard({ ...card, num: e.target.value.replace(/[^\d ]/g, "").slice(0, 23) })} /><Ico d={I.card} size={20} /></span>
                                            <span><input aria-label="Expiry date" placeholder="MM / YY" inputMode="numeric" autoComplete="cc-exp" value={card.exp} onChange={(e) => setCard({ ...card, exp: e.target.value.replace(/[^\d/]/g, "").replace(/^(\d{2})(\d)/, "$1/$2").slice(0, 5) })} /><input aria-label="Security code" placeholder="CVC" inputMode="numeric" autoComplete="cc-csc" value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, "").slice(0, 4) })} /></span>
                                        </div>
                                        <label className="gb-field"><span>Name on card</span><input aria-label="Name on card" placeholder="Name on card" autoComplete="cc-name" value={card.name || `${d.first} ${d.last}`.trim()} onChange={(e) => setCard({ ...card, name: e.target.value })} /></label>
                                    </div>
                                )}
                                {on && pm.note && <div className="gb-method-note"><Ico d={I.lock} size={14} fill /><span>{pm.note}</span></div>}
                            </div>
                        ); })}
                    </div>
                </section>
                <div className="gb-rule" />
                <section className="gb-sec tight">
                    <h2>Extras</h2>
                    <label className="gb-extra"><input type="checkbox" className="gb-checkbox" checked={msgOn} onChange={(e) => { setMsgOn(e.target.checked); if (!e.target.checked) setD({ note: "" }); }} /><span><b>Add a message to the pile</b><span>Shows next to your name for other supporters</span></span></label>
                    {msgOn && <textarea aria-label="Your message" className="gb-msg" placeholder="Say a few words, or a dua for the people this helps" value={d.note} onChange={(e) => setD({ note: e.target.value })} />}
                    <label className="gb-extra"><input type="checkbox" className="gb-checkbox" checked={d.anon} onChange={(e) => setD({ anon: e.target.checked })} /><span><b>Give anonymously</b><span>You appear as "A kind supporter" on the pile</span></span></label>
                    <label className="gb-extra"><input type="checkbox" className="gb-checkbox" checked={d.news} onChange={(e) => setD({ news: e.target.checked })} /><span><b>Email me updates from {bio.name}</b><span>See what your coins paid for. Unsubscribe any time.</span></span></label>
                    <label className="gb-extra"><input type="checkbox" className="gb-checkbox" checked={g.cover} onChange={(e) => { set({ cover: e.target.checked }); track("rg_addon", { id: "cover", on: e.target.checked ? 1 : 0 }); }} /><span><b>Cover the card fees</b><span>So {bio.name} keeps every penny of your gift</span></span></label>
                </section>
                {!m && <span className="gb-terms">By donating you agree to the Outgive terms and privacy policy. Nightly gifts can be paused or cancelled any time from your receipt.</span>}
                {m && <><div className="gb-rule" /><section className="gb-sec"><h2>Summary</h2>{summary}</section></>}
            </div></div>
            {!m && (
                <aside className="gb-panel"><div className="gb-panel-in">
                    <div className="gb-panel-head"><span>YOUR GIFT</span><button type="button" className="gb-tx" onClick={onEdit}>Edit</button></div>
                    <div className="gb-giftcard">
                        <div className="gb-giftcard-stage" style={{ background: ap.bg }}>
                            <span className="gb-giftcard-floor" />
                            <div className="gb-giftcard-pile"><PileCols cols={kCols.cols} /></div>
                            <span className="gb-giftcard-tag" style={{ bottom: 40 + kCols.peak + 8 }}>You · {short(amt)}{perS}</span>
                            <span className="gb-giftcard-chip"><span className="gb-crowd-av sm"><i style={{ background: "#FAD8C4" }} /><i style={{ background: "#DCCBF3" }} /><i style={{ background: "#D2DBA0" }} /></span>{(ap.backers + 1).toLocaleString("en-GB")} on the pile</span>
                        </div>
                        <div className="gb-giftcard-foot">
                            <span><b>{ap.title}</b><span>{bio.name}<Ico d={I.added} size={14} fill /></span></span>
                            <span className="gb-giftcard-r"><span className="gb-coinpill dark"><Coin size={16} />+{Math.round(amt)}</span><em>Level {Math.max(1, lvl)} · {lvl ? LEVELS[lvl - 1][1] : "Supporter"}</em></span>
                        </div>
                    </div>
                    {summary}
                </div></aside>
            )}
            {phase !== "idle" && <Paying phase={phase} total={q.total} name={bio.name} />}
        </div>
    );
};

/* ---------- Thank you: level up ---------- */
const Done = ({ paid, bio, onAgain }: { paid: Paid; bio: BioPage; onAgain: () => void }) => {
    const m = useNarrow();
    const { q, level } = paid;
    const lvl = Math.max(1, level);
    const nights = paid.mode !== "once" ? q.charges.filter((c) => c.night > 0) : [];
    const text = `I’m giving every night this Ramadan with ${bio.name}. Add your coins to the pile: ${location.origin}/ramadhan`;
    const [copied, setCopied] = useState(false);
    useEffect(() => { track("rg_thanks", { payments: q.charges.length, level }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const raised = bio.campaigns.reduce((n, x) => n + x.raised, 0) + bio.causes.reduce((n, x) => n + x.raised, 0);
    const goal = bio.campaigns.reduce((n, x) => n + x.goal, 0) + bio.causes.reduce((n, x) => n + x.goal, 0);
    const pctB = (raised / goal) * 100, pctA = ((raised + q.gifts + q.giftAid) / goal) * 100;
    const pf = (x: number) => `${Math.abs(pctA - pctB) < 1 ? x.toFixed(1) : Math.round(x)}%`;
    const qadr = nights.some((c) => c.night === 27);
    const badges: [string, string, string, boolean, string][] = [["★", `Level ${lvl}`, LEVELS[lvl - 1][1], true, GB.peach], ["1st", "First gift", `to ${bio.name}`, true, GB.mint], ["27", "Night 27", qadr ? "Unlocked" : "Give on night 27", qadr, "#F1EAFB"], ["+25%", "Gift Aid boost", paid.giftAid ? "Unlocked" : "Add Gift Aid", paid.giftAid, "#FDEBDF"]];
    const streak = nights.slice(0, 6);
    const tip = q.tips, method = METHOD[paid.method][0];
    const rows: [string, string][] = [["Donation", money(q.gifts)], ["Gift Aid claimed", paid.giftAid ? money(q.giftAid) : "Not claimed"], ["Given as", nights.length ? `${nights.length} nights` : "One-off"], ["Tip to Outgive", money(tip)], ["Paid with", method], ["Total charged", money(q.total)]];
    // The receipt file is built from the rows the card shows, so the two can never disagree.
    const download = () => {
        const pdf = receiptPdf(`Donation receipt · ${bio.name}`, [`Receipt ${paid.receipt} · ${paid.date}`, ...(paid.name ? [`Donor: ${paid.name}`] : []), ...(bio.charityNo ? [bio.charityNo] : [])], [...rows, ...(nights.length ? [["Schedule", `Nights ${nights.map((c) => c.night).join(", ")}, charged each night at sunset`] as [string, string]] : [])], ["Thank you for your gift. Keep this receipt for your records.", "Sent through Outgive · outgive.tech"]);
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([Uint8Array.from(pdf, (c) => c.charCodeAt(0))], { type: "application/pdf" })); a.download = `receipt-${paid.receipt}.pdf`;
        document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
        track("rg_receipt", { total: q.total });
    };
    return (
        <div className="gb gb-done">
            <div className="gb-done-hero" style={{ background: "#FDEBDF", padding: m ? "22px 16px 60px" : "30px 40px 84px" }}>
                <div className="rg-confetti" aria-hidden="true">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ "--x": `${(i * 37) % 100}%`, "--d": `${(i % 8) * 0.11}s`, "--r": `${(i * 47) % 360}deg` } as CSSProperties} />)}</div>
                <a href="/" aria-label="Outgive home" className="gb-done-logo"><OgLogo size={20} /></a>
                <div className="gb-medal gb-burst" style={{ width: m ? 112 : 138, height: m ? 112 : 138 }}><span><span>LEVEL</span><b className="gb-h" style={{ fontSize: m ? 46 : 58 }}>{lvl}</b></span><em>{LEVELS[lvl - 1][1]}</em></div>
                <h1 className="gb-h" style={{ fontSize: m ? 32 : 52 }}>Level {lvl} unlocked!</h1>
                <p style={{ fontSize: m ? 16 : 18 }}>Jazakallah khair{paid.first ? `, ${paid.first}` : ""}. Your {short(q.gifts)} for {bio.name} is {nights.length ? "scheduled" : "on its way"}.</p>
                {paid.impact && <span className="gb-impactpill" style={{ fontSize: m ? 14 : 16 }}><span><Coin size={24} /></span>{paid.impact}, funded</span>}
            </div>
            <div className="gb-done-body" style={m ? { marginTop: -44, padding: "0 16px 24px" } : undefined}>
                <div className="gb-stats" style={{ gap: m ? 8 : 12 }}>
                    {([["Coins", `+${Math.round(q.gifts)}`, "added to your wallet"], ["Level", LEVELS[lvl - 1][1], `Level ${lvl} of 5`], ["Appeal", pf(pctA), `funded, up from ${pf(pctB)}`]] as const).map(([k, v, sub], i) => (
                        <div key={k} className={cx("gb-stat", i === 0 && "coins")} style={{ padding: m ? 12 : "16px 18px" }}><span>{k}</span><b className="gb-h" style={{ fontSize: m ? 20 : 30 }}>{v}</b><small>{sub}</small>{i === 2 && <span className="gb-stat-bar"><span style={{ width: `${Math.min(100, pctA)}%`, background: `linear-gradient(90deg,${GB.green} ${Math.round((pctB / pctA) * 100)}%,${GB.yellow} 0)` }} /></span>}</div>
                    ))}
                </div>
                <div className="gb-box"><div className="gb-box-head"><b>Badges</b><span>{badges.filter((b) => b[3]).length} of 4 earned</span></div><div className="gb-badges">{badges.map(([glyph, name, sub, on, bg]) => <div key={name}><span className={cx("gb-badge", on && "on")} style={on ? { background: bg } : undefined}>{glyph}</span><b>{name}</b><span>{sub}</span></div>)}</div></div>
                <div className="gb-next" style={{ gridTemplateColumns: m ? "1fr" : "1fr 1fr" }}>
                    <div className="gb-quest"><span>YOUR NIGHTS</span><b>{nights.length ? `${nights.length} nights on the pile` : "Make it every night"}</b><span className="tx">{nights.length ? `Your first coins land on night ${nights[0].night}, ${nightDate(bio, nights[0].night)} at sunset.` : "Give a little on every night of Ramadan and keep your level growing."}</span>
                        {streak.length > 0 && <div className="gb-streak">{streak.map((c, i) => <span key={c.night}><span className={cx(i === 0 ? "first" : c.night === 27 ? "on" : "")}>{i === 0 ? "✓" : c.night === 27 ? "★" : ""}</span><small>{c.night}</small></span>)}</div>}
                    </div>
                    <div className="gb-friend"><span>BRING A FRIEND</span><b>Challenge a friend to match Level {lvl}</b><span className="gb-friend-av"><span><i className="you">You</i><i>+</i><i>+</i></span>You are supporter #{389}</span><span className="tx">Every friend who joins moves {bio.name} closer to its goal.</span>
                        <div className="gb-friend-btns"><a className="gb-btn outline sm" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener" onClick={() => track("rg_share", { channel: "whatsapp" })}>WhatsApp</a><button type="button" className="gb-btn outline sm" onClick={async () => { track("rg_share", { channel: "copy" }); try { await navigator.clipboard.writeText(text); setCopied(true); } catch { /* blocked */ } }}>{copied ? "Copied" : "Copy link"}</button></div>
                    </div>
                </div>
                <div className="gb-box">
                    <div className="gb-rcpt-head"><span className="gb-rcpt-ico"><Ico d={I.note} size={20} /></span><span><b>Your receipt</b><span>Ref {paid.receipt} · emailed to you</span></span><em>PAID</em></div>
                    <div className="gb-rcpt" style={{ gridTemplateColumns: m ? "1fr" : "1fr 1fr" }}>{rows.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
                    <div className="gb-rcpt-btns"><a className="gb-btn neutral" href="/ramadhan">Back to {bio.name}</a><button type="button" className="gb-btn outline" onClick={download}>Download receipt</button><button type="button" className="gb-btn outline" onClick={onAgain}>Give again</button></div>
                </div>
            </div>
        </div>
    );
};
