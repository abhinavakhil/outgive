/**
 * /zakat-calculator: the public zakat calculator (US, USD), and /zakat-calculator/embed?charity=<slug>&give=<url>, the same calculator
 * for a charity's own site in an iframe. "Give $X as Zakat" opens the charity's checkout with ?amount=<dollars>&fund=zakat (see giveLink).
 * Gold and silver start at sample prices and are swapped for spot prices from gold-api.com (free, no key) when it answers.
 */
import { useEffect, useId, useRef, useState } from "react";
import { SitePage } from "@/shared/ui";
import { SITE } from "@/shared/lib/seo";
import { type Basis, NISAB_GRAMS, cleanSlug, giveLink, parseAmount, perGram, safeUrl, usd, zakat } from "./model";
import "./zakat.css";

/** Used until the live price arrives, or if it never does. */
const SAMPLE = { gold: "117.35", silver: "1.39", date: "28 November 2026" };
const DISCLAIMER = "Outgive is not a zakat authority: each charity states its own zakat policy, and donors should follow their scholar.";

type Key = "cash" | "investments" | "gold" | "silver" | "business" | "owed" | "debts";
const FIELDS: [Key, string, string, "$" | "g"][] = [
    ["cash", "Cash and bank", "Current and savings accounts, and cash at home.", "$"],
    ["investments", "Shares and investments", "Market value of shares, funds and crypto held to sell.", "$"],
    ["gold", "Gold", "Weight of pure gold. 18k is 75% gold, 22k is about 92%.", "g"],
    ["silver", "Silver", "Weight of pure silver.", "g"],
    ["business", "Business stock", "Goods for sale, at what they would sell for.", "$"],
    ["owed", "Money owed to you", "Loans you expect to be repaid.", "$"],
];
const EMPTY: Record<Key, string> = { cash: "", investments: "", gold: "", silver: "", business: "", owed: "", debts: "" };

const Field = ({ label, hint, unit, value, onChange }: { label: string; hint?: string; unit: "$" | "g"; value: string; onChange: (v: string) => void }) => {
    const id = useId();
    return (
        <div className="zk-field">
            <label htmlFor={id}>{label}</label>
            <div className="zk-in">
                {unit === "$" && <span aria-hidden="true">$</span>}
                <input id={id} inputMode="decimal" autoComplete="off" placeholder="0" value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={hint ? `${id}-h` : undefined} />
                {unit === "g" && <span aria-hidden="true">g</span>}
            </div>
            {hint && <p id={`${id}-h`} className="zk-hint">{hint}</p>}
        </div>
    );
};

/** Spot prices per gram, or null if the service is down or slow. */
const livePrices = async (): Promise<{ gold: number; silver: number; at: string } | null> => {
    try {
        const get = (s: string) => fetch(`https://api.gold-api.com/price/${s}`, { signal: AbortSignal.timeout(6000) }).then((r) => (r.ok ? r.json() : Promise.reject()));
        const [g, s] = await Promise.all([get("XAU"), get("XAG")]);
        const gold = perGram(g.price), silver = perGram(s.price);
        return gold && silver ? { gold, silver, at: g.updatedAt } : null;
    } catch { return null; }
};

export const Calculator = ({ give, embed }: { give: string; embed?: boolean }) => {
    const [v, setV] = useState(EMPTY);
    const [gp, setGp] = useState(SAMPLE.gold);
    const [sp, setSp] = useState(SAMPLE.silver);
    const [basis, setBasis] = useState<Basis>("silver");
    const [note, setNote] = useState(`Sample prices as of ${SAMPLE.date}. Edit them to today's price.`);
    const edited = useRef(false);
    useEffect(() => {
        livePrices().then((p) => {
            if (!p || edited.current) return;
            setGp(String(p.gold)); setSp(String(p.silver));
            setNote(`Spot prices from gold-api.com as of ${new Date(p.at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}. Edit them if your dealer or scholar uses another price.`);
        });
    }, []);
    const price = (set: (s: string) => void) => (s: string) => { edited.current = true; set(s); };

    const r = zakat({ cash: parseAmount(v.cash), investments: parseAmount(v.investments), gold: parseAmount(v.gold), silver: parseAmount(v.silver), business: parseAmount(v.business), owed: parseAmount(v.owed), debts: parseAmount(v.debts), goldPrice: parseAmount(gp), silverPrice: parseAmount(sp), basis });
    const nisabOf = (b: Basis) => NISAB_GRAMS[b] * parseAmount(b === "gold" ? gp : sp);
    const status = r.assets === 0 ? "Add what you own to see your zakat." : r.above ? `2.5% of ${usd(r.net)} in net zakatable wealth.` : `Below the nisab of ${usd(r.nisab)}, so no zakat is due.`;

    return (
        <div className={`zk-calc${embed ? " zk-calc-embed" : ""}`}>
            <form className="zk-form" onSubmit={(e) => e.preventDefault()} aria-label="Zakat calculator">
                <fieldset>
                    <legend>What you own</legend>
                    <div className="zk-grid">{FIELDS.map(([k, l, h, u]) => <Field key={k} label={l} hint={h} unit={u} value={v[k]} onChange={(s) => setV({ ...v, [k]: s })} />)}</div>
                </fieldset>
                <fieldset>
                    <legend>What you owe now</legend>
                    <Field label="Debts due now" hint="Bills, rent and installments due now. Not the whole of a long-term loan." unit="$" value={v.debts} onChange={(s) => setV({ ...v, debts: s })} />
                </fieldset>
                <fieldset>
                    <legend>Prices and nisab</legend>
                    <div className="zk-grid">
                        <Field label="Gold price per gram" unit="$" value={gp} onChange={price(setGp)} />
                        <Field label="Silver price per gram" unit="$" value={sp} onChange={price(setSp)} />
                    </div>
                    <p className="zk-hint zk-note">{note}</p>
                    <div className="zk-basis">
                        <span id="zk-basis-l" className="zk-lbl">Measure the nisab by</span>
                        <div className="zk-seg" role="group" aria-labelledby="zk-basis-l">
                            {(["silver", "gold"] as const).map((b) => (
                                <button key={b} type="button" aria-pressed={basis === b} onClick={() => setBasis(b)}>
                                    <b>{b === "silver" ? "Silver" : "Gold"}, {NISAB_GRAMS[b]} g</b><span>{usd(Math.round(nisabOf(b) * 100) / 100)}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </fieldset>
            </form>

            <section className="zk-result" aria-labelledby="zk-due-l">
                <p id="zk-due-l" className="zk-lbl"><i aria-hidden="true" />Zakat due</p>
                <p className="zk-due">{usd(r.due)}</p>
                <p className="zk-status" role="status" aria-live="polite">{status}</p>
                {r.assets > 0 && (
                    <dl className="zk-lines">
                        {r.lines.map(([l, n]) => <div key={l}><dt>{l}</dt><dd>{usd(n)}</dd></div>)}
                        <div className="zk-sum"><dt>Total</dt><dd>{usd(r.assets)}</dd></div>
                        {r.debts > 0 && <div><dt>Less debts due now</dt><dd>−{usd(r.debts)}</dd></div>}
                        <div className="zk-sum"><dt>Net zakatable wealth</dt><dd>{usd(r.net)}</dd></div>
                        <div><dt>Nisab ({basis}, {NISAB_GRAMS[basis]} g)</dt><dd>{usd(r.nisab)}</dd></div>
                    </dl>
                )}
                {r.due > 0 && <a className="zk-btn zk-green" href={giveLink(give, r.due)} target={embed ? "_blank" : undefined} rel={embed ? "noopener" : undefined}>Give {usd(r.due)} as Zakat</a>}
                <p className="zk-hint">This assumes you have held this wealth for a full lunar year (hawl). Nothing you type leaves your browser.</p>
                <p className="zk-hint">{DISCLAIMER}</p>
            </section>
        </div>
    );
};

/** Questions and answers for the page and its FAQPage JSON-LD. Plain text, so the same strings serve both. */
export const ZAKAT_FAQ: [string, string][] = [
    ["What is the nisab?", "The nisab is the least wealth on which zakat is due. The hadith sets it at 200 dirhams of silver or 20 dinars (mithqal) of gold (Sunan Abi Dawud 1573). In modern weights these are usually given as about 595 g of silver and 85 g of gold, though some scholars use slightly different conversions, such as 612 g and 87.5 g."],
    ["Should I use the silver or the gold nisab?", "Scholars differ. Silver gives a much lower threshold, so more people pay and more reaches the poor, and many recommend it for cash savings for that reason. Others hold that gold better reflects the value of the nisab today. This calculator lets you choose; ask your scholar which to follow."],
    ["What is the hawl?", "The hawl is one lunar year, about 354 days. Zakat on savings, gold, silver and trade goods is due once your wealth has stayed at or above the nisab for a full lunar year (Sunan Abi Dawud 1573). Many people pick a fixed date, such as a day in Ramadan, and count everything they hold on that day."],
    ["What counts as zakatable wealth?", "Cash and bank balances, gold and silver, shares and investments, business stock for sale, and money owed to you that you expect to be repaid. Your home, car, clothes, furniture and the tools you work with are not counted. For shares held long term, some scholars count only the company's zakatable assets rather than the full market value."],
    ["Can I take debts off?", "Debts you must pay now, such as bills, rent and installments that are due, are usually deducted. For long-term loans like a mortgage, many scholars deduct only the payments due in the coming year, not the whole balance. Enter what your scholar advises in Debts due now."],
    ["How much zakat do I pay?", "2.5%, one fortieth, of your net zakatable wealth, if it is at or above the nisab. Crops, livestock and some minerals follow different rules and are not covered here."],
    ["Is Outgive a zakat authority?", DISCLAIMER],
];
const SOURCES: [string, string?][] = [
    ["Sunan Abi Dawud 1573: the nisab of silver and gold, and the year", "https://sunnah.com/abudawud:1573"],
    ["Qur'an 9:60: who may receive zakat", "https://quran.com/9/60"],
    ["Yusuf al-Qaradawi, Fiqh al-Zakah, vol. 1: the nisab in modern weights"],
];

const origin = () => (typeof window === "undefined" ? SITE.url : window.location.origin);

/** The iframe snippet a charity pastes, with a tiny listener that sizes the frame to the calculator. */
const snippet = (o: string, charity: string, give: string) => {
    const q = new URLSearchParams({ charity: cleanSlug(charity) ?? "your-charity" });
    const g = safeUrl(give);
    if (g) q.set("give", g.toString());
    const src = `${o}/zakat-calculator/embed?${q}`;
    return `<iframe src="${src.replace(/&/g, "&amp;")}" title="Zakat calculator" loading="lazy" style="width:100%;max-width:720px;height:1100px;border:0"></iframe>
<script>addEventListener("message",function(e){if(e.origin!=="${o}"||!e.data||e.data.type!=="outgive:zakat:height")return;document.querySelectorAll("iframe").forEach(function(f){if(f.contentWindow===e.source)f.style.height=e.data.height+"px"})})</script>`;
};

const EmbedCode = () => {
    const [charity, setCharity] = useState("");
    const [give, setGive] = useState("");
    const [copied, setCopied] = useState(false);
    const code = snippet(origin(), charity.trim().toLowerCase(), give.trim());
    const copy = async () => {
        try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* clipboard blocked: the code is selectable */ }
    };
    const cid = useId(), gid = useId();
    return (
        <div className="zk-embed og-card">
            <div className="zk-grid">
                <div className="zk-field"><label htmlFor={cid}>Your charity's Outgive name</label><div className="zk-in"><input id={cid} autoComplete="off" placeholder="your-charity" value={charity} onChange={(e) => setCharity(e.target.value)} /></div></div>
                <div className="zk-field"><label htmlFor={gid}>Your donate page (optional)</label><div className="zk-in"><input id={gid} type="url" inputMode="url" autoComplete="off" placeholder="https://" value={give} onChange={(e) => setGive(e.target.value)} /></div></div>
            </div>
            <p className="zk-hint">The Give button opens this page with <code>?amount=</code> and <code>fund=zakat</code> added. Leave it empty to use your Outgive checkout.</p>
            <pre className="zk-code" tabIndex={0} aria-label="Embed code"><code>{code}</code></pre>
            <div className="zk-copy"><button type="button" className="zk-btn zk-ink" onClick={copy}>Copy embed code</button><span role="status" aria-live="polite">{copied ? "Copied" : ""}</span></div>
        </div>
    );
};

export const ZakatPage = () => (
    <SitePage narrow={false}>
        <div className="zk">
            <header className="zk-hero">
                <p className="zk-eyebrow">Zakat calculator · US dollars</p>
                <h1 className="og-h1">Work out the zakat you owe.</h1>
                <p className="og-lead">Add up what you own, take off debts due now, and see whether you are above the nisab and how much zakat to give. Free, and nothing you type leaves your browser.</p>
            </header>
            <Calculator give={`${SITE.url}/checkout`} />

            <section className="zk-sec" aria-labelledby="zk-faq">
                <h2 id="zk-faq" className="zk-h2">Questions about zakat</h2>
                <div className="zk-faq">{ZAKAT_FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
                <h3 className="zk-h3">Sources</h3>
                <ul className="zk-src">{SOURCES.map(([l, h]) => <li key={l}>{h ? <a className="og-link" href={h} rel="noopener">{l}</a> : l}</li>)}</ul>
            </section>

            <section className="zk-sec" aria-labelledby="zk-embed">
                <h2 id="zk-embed" className="zk-h2">For charities: put it on your site</h2>
                <p className="zk-sub">Donors work out their zakat on your page, and the Give button opens your checkout with the amount filled and the gift marked as Zakat.</p>
                <EmbedCode />
            </section>
        </div>
    </SitePage>
);

/** /zakat-calculator/embed: the calculator alone, for an iframe. Tells the parent page its height as it changes. */
export const ZakatEmbed = () => {
    const q = new URLSearchParams(window.location.search);
    const charity = cleanSlug(q.get("charity"));
    const give = safeUrl(q.get("give"))?.toString() ?? `${window.location.origin}${charity ? `/o/${charity}` : ""}/checkout`;
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el || window.parent === window) return;
        const post = () => window.parent.postMessage({ type: "outgive:zakat:height", height: Math.ceil(el.getBoundingClientRect().height) }, "*");
        const ro = new ResizeObserver(post); ro.observe(el); post();
        return () => ro.disconnect();
    }, []);
    return (
        <div ref={ref} className="zk zk-frame">
            <Calculator give={give} embed />
            <p className="zk-by"><a href={`${SITE.url}/zakat-calculator`} target="_blank" rel="noopener">Zakat calculator by Outgive</a></p>
        </div>
    );
};
