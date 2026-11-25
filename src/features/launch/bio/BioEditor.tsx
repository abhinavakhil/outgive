/**
 * /ramadhan/edit: the organiser's editor for the charity's Ramadan page.
 * Two tabs. Page: the profile, then every section in page order; each opens in place to edit, with show/hide and move.
 * Design: colour, look, corners, font, causes layout. Right: the live page in a phone. Changes save as you type.
 * Insights live on their own dashboard (/ramadhan?insights), so the editor doesn't load the charts.
 */
import { type ReactNode, useState } from "react";
import { Input, TextArea } from "@/shared/ui";
import { cx } from "@/shared/utils/cx";
import { donateHref } from "../components/Ramadan";
import { BioView } from "./BioView";
import { BLOCK_NAMES, type BioPage, type BlockId, COLOURS, type Theme, money, uid, useBioPage } from "./model";
import { CauseArt, ILLUSTRATIONS, ILLUSTRATION_BG, ILLUSTRATION_NAMES } from "./illustrations";
import "./bio-editor.css";

type Set = <K extends keyof BioPage>(k: K, v: BioPage[K]) => void;
type ListKey = "campaigns" | "causes" | "links" | "journey";
const num = (s: string) => Math.max(0, Number(s.replace(/[^\d.]/g, "")) || 0);
const Ico = ({ d, size = 18 }: { d: string; size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
const I = {
    chev: "M9 6l6 6-6 6", up: "M12 19V5M6 11l6-6 6 6", down: "M12 5v14M6 13l6 6 6-6", plus: "M12 5v14M5 12h14", trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
    eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z", eyeOff: "M3 3l18 18M10.6 5.1A10 10 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3 3.9M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 005.4-1.6",
    out: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5", chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
};
const ART_BG = ["#DCCBF3", "#E3EABF", "#FDEBDF", "#FAD8C4"];

export const BioEditor = () => {
    const { page, update, reset } = useBioPage();
    const [tab, setTab] = useState<"page" | "design">("page");
    const set: Set = (k, v) => update((p) => ({ ...p, [k]: v }));
    const theme = <K extends keyof Theme>(k: K, v: Theme[K]) => update((p) => ({ ...p, theme: { ...p.theme, [k]: v } }));
    return (
        <div className="be">
            <header className="be-top">
                <a href="/" className="be-brand">outgive</a>
                <span className="be-sep" aria-hidden="true" />
                <span className="be-name">{page.name}</span>
                <span className="be-saved"><i />Saved</span>
                <nav className="be-actions">
                    <a href="/ramadhan?insights" className="be-btn ghost"><Ico d={I.chart} size={16} />Insights</a>
                    <a href="/ramadhan" target="_blank" rel="noopener" className="be-btn">View page<Ico d={I.out} size={15} /></a>
                </nav>
            </header>
            <div className="be-body">
                <aside className="be-panel">
                    <div role="tablist" aria-label="Editor" className="be-tabs">
                        {(["page", "design"] as const).map((k) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{k === "page" ? "Page" : "Design"}</button>)}
                    </div>
                    <div className="be-scroll">{tab === "page" ? <PageTab page={page} set={set} /> : <DesignTab t={page.theme} theme={theme} reset={reset} />}</div>
                </aside>
                <section aria-label="Preview" className="be-stage">
                    <div className="be-phone"><div className="be-screen"><BioView page={page} giveHref={(s) => donateHref("hero", s)} /></div></div>
                </section>
            </div>
        </div>
    );
};

/* ---------- Page tab ---------- */

/** A row that opens in place (native <details>); `tools` sit on the right and don't toggle it. */
const Fold = ({ title, meta, lead, tools, open, className, children }: { title: ReactNode; meta?: ReactNode; lead?: ReactNode; tools?: ReactNode; open?: boolean; className?: string; children: ReactNode }) => (
    <details className={cx("be-fold", className)} open={open}>
        <summary>
            <span className="be-chev"><Ico d={I.chev} size={16} /></span>
            {lead}
            <span className="be-fold-t"><b>{title}</b>{meta && <small>{meta}</small>}</span>
            {tools && <span className="be-tools" onClick={(e) => e.preventDefault()}>{tools}</span>}
        </summary>
        <div className="be-fold-body">{children}</div>
    </details>
);
const IconBtn = ({ d, label, onPress, disabled }: { d: string; label: string; onPress: () => void; disabled?: boolean }) => (
    <button type="button" className="be-ib" aria-label={label} title={label} disabled={disabled} onClick={onPress}><Ico d={d} size={16} /></button>
);
const AddRow = ({ label, onPress }: { label: string; onPress: () => void }) => <button type="button" className="be-addrow" onClick={onPress}><Ico d={I.plus} size={16} />{label}</button>;
const Auto = ({ children }: { children: ReactNode }) => <p className="be-help">{children}</p>;

const IlloPicker = ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <div className="be-field"><span>Illustration</span><div role="radiogroup" aria-label="Illustration" className="be-illo">{ILLUSTRATIONS.map((k) => <button key={k} type="button" role="radio" aria-checked={value === k} aria-label={ILLUSTRATION_NAMES[k]} title={ILLUSTRATION_NAMES[k]} onClick={() => onChange(k)} style={{ background: ILLUSTRATION_BG[k] }}><CauseArt name={k} /></button>)}</div></div>
);
const Thumb = ({ illo, bg }: { illo?: string; bg: string }) => <span className="be-thumb" style={{ background: bg }}>{illo && <CauseArt name={illo} />}</span>;

const PageTab = ({ page, set }: { page: BioPage; set: Set }) => {
    const edit = <K extends ListKey>(k: K, id: string, patch: Partial<BioPage[K][number]>) => set(k, (page[k] as { id: string }[]).map((x) => (x.id === id ? { ...x, ...patch } : x)) as BioPage[K]);
    const drop = <K extends ListKey>(k: K, id: string) => set(k, (page[k] as { id: string }[]).filter((x) => x.id !== id) as BioPage[K]);
    const move = (i: number, d: -1 | 1) => { const b = [...page.blocks]; const j = i + d; if (j < 0 || j >= b.length) return; [b[i], b[j]] = [b[j], b[i]]; set("blocks", b); };
    const Trash = ({ k, id, label }: { k: ListKey; id: string; label: string }) => <IconBtn d={I.trash} label={`Remove ${label}`} onPress={() => drop(k, id)} />;

    const body: Record<BlockId, { meta: string; node: ReactNode }> = {
        links: { meta: `${page.links.length} links`, node: <>
            {page.links.map((l) => <Fold key={l.id} className="be-item" title={l.label || "Untitled link"} meta={l.url} tools={<Trash k="links" id={l.id} label={l.label} />}>
                <Input label="Label" value={l.label} onChange={(v) => edit("links", l.id, { label: v })} />
                <Input label="Address" value={l.url} onChange={(v) => edit("links", l.id, { url: v })} />
            </Fold>)}
            <AddRow label="Add link" onPress={() => set("links", [...page.links, { id: uid(), label: "New link", url: "https://" }])} />
        </> },
        banner: { meta: "Counts down, then shows the night", node: <Input label="Ramadan starts" type="date" value={page.ramadanStart} onChange={(v) => set("ramadanStart", v)} hint="Before this date the banner counts down; then it shows the night, the last ten nights and Eid." /> },
        ways: { meta: "Last 10 nights, Zakat, iftar", node: <Auto>Three quick ways to give in Ramadan. Each opens the donate flow, where donors choose the amount.</Auto> },
        totals: { meta: "From your donations", node: <Auto>Raised, goal and supporters add up from your campaigns, causes and donations.</Auto> },
        campaigns: { meta: `${page.campaigns.length} campaigns · first 3 featured`, node: <>
            {page.campaigns.map((c, i) => <Fold key={c.id} className="be-item" lead={<Thumb illo={c.illo} bg={ART_BG[c.art % 4]} />} title={c.title || "Untitled campaign"} meta={<>{i < 3 && <em>Featured</em>}{money(c.raised)} of {money(c.goal)}</>} tools={<Trash k="campaigns" id={c.id} label={c.title} />}>
                <Input label="Title" value={c.title} onChange={(v) => edit("campaigns", c.id, { title: v })} />
                <TextArea label="Description" rows={2} value={c.text} onChange={(v) => edit("campaigns", c.id, { text: v })} />
                <div className="be-two">
                    <Input label="Raised (£)" inputMode="numeric" value={String(c.raised)} onChange={(v) => edit("campaigns", c.id, { raised: num(v) })} />
                    <Input label="Goal (£)" inputMode="numeric" value={String(c.goal)} onChange={(v) => edit("campaigns", c.id, { goal: num(v) || 1 })} />
                </div>
                <Input label="Ends" type="date" value={c.ends} onChange={(v) => edit("campaigns", c.id, { ends: v })} />
                <IlloPicker value={c.illo} onChange={(v) => edit("campaigns", c.id, { illo: v })} />
                <div className="be-field"><span>Background</span><div role="radiogroup" aria-label="Background" className="be-dots">{ART_BG.map((bg, k) => <button key={bg} type="button" role="radio" aria-checked={c.art % 4 === k} aria-label={`Background ${k + 1}`} style={{ background: bg }} onClick={() => edit("campaigns", c.id, { art: k })} />)}</div></div>
            </Fold>)}
            <AddRow label="Add campaign" onPress={() => set("campaigns", [...page.campaigns, { id: uid(), title: "New campaign", text: "", raised: 0, goal: 10000, art: page.campaigns.length % 4, illo: "water", ends: page.ramadanStart }])} />
        </> },
        causes: { meta: `${page.causes.length} causes`, node: <>
            {page.causes.map((c) => <Fold key={c.id} className="be-item" lead={<Thumb illo={c.icon} bg={ILLUSTRATION_BG[c.icon as keyof typeof ILLUSTRATION_BG] ?? "#F4F3F0"} />} title={c.title || "Untitled cause"} meta={`${money(c.raised)} raised`} tools={<Trash k="causes" id={c.id} label={c.title} />}>
                <Input label="Title" value={c.title} onChange={(v) => edit("causes", c.id, { title: v })} />
                <IlloPicker value={c.icon} onChange={(v) => edit("causes", c.id, { icon: v })} />
                <div className="be-two">
                    <Input label="Raised (£)" inputMode="numeric" value={String(c.raised)} onChange={(v) => edit("causes", c.id, { raised: num(v) })} />
                    <Input label="Goal (£)" inputMode="numeric" value={String(c.goal)} onChange={(v) => edit("causes", c.id, { goal: num(v) || 1 })} />
                </div>
            </Fold>)}
            <AddRow label="Add cause" onPress={() => set("causes", [...page.causes, { id: uid(), title: "New cause", note: "", raised: 0, goal: 5000, icon: "health", amounts: [] }])} />
        </> },
        supporters: { meta: "From your donations", node: <Auto>Your biggest supporters, ranked automatically. Donors who give anonymously are never shown.</Auto> },
        gifts: { meta: "From your donations", node: <Auto>The latest gifts appear here as they come in.</Auto> },
        journey: { meta: `${page.journey.length} milestones`, node: <>
            {page.journey.map((s) => <Fold key={s.id} className="be-item" title={s.title || "Untitled milestone"} meta={s.done ? "Reached" : "Next"} tools={<Trash k="journey" id={s.id} label={s.title} />}>
                <Input label="Milestone" value={s.title} onChange={(v) => edit("journey", s.id, { title: v })} />
                <Input label="Detail" value={s.text} onChange={(v) => edit("journey", s.id, { text: v })} />
                <Toggle on={s.done} onChange={(v) => edit("journey", s.id, { done: v })} label="Reached" />
            </Fold>)}
            <AddRow label="Add milestone" onPress={() => set("journey", [...page.journey, { id: uid(), title: "New milestone", text: "", done: false }])} />
        </> },
    };

    return (
        <>
            <Fold className="be-card be-profile" lead={<span className="be-av">{page.avatar || page.name.slice(0, 2).toUpperCase()}</span>} title={page.name} meta={page.tagline}>
                <Input label="Charity name" value={page.name} onChange={(v) => set("name", v)} />
                <Input label="Tagline" value={page.tagline} onChange={(v) => set("tagline", v)} placeholder="Clean water for 40 villages" />
                <div className="be-two">
                    <Input label="Charity number" value={page.charityNo} onChange={(v) => set("charityNo", v)} placeholder="1234567" />
                    <Input label="Initials" value={page.avatar} onChange={(v) => set("avatar", v.slice(0, 3))} placeholder="CT" />
                </div>
                <Input label="Logo image address" value={page.logo} onChange={(v) => set("logo", v)} placeholder="https://… (empty shows initials)" />
                <div className="be-two">
                    {(["instagram", "whatsapp", "website", "email"] as const).map((k) => <Input key={k} label={k[0].toUpperCase() + k.slice(1)} value={page.socials[k]} onChange={(v) => set("socials", { ...page.socials, [k]: v })} placeholder={k === "email" ? "mailto:…" : "https://…"} />)}
                </div>
            </Fold>

            <h2 className="be-label">Sections <small>Top to bottom, as on the page</small></h2>
            {page.blocks.map((b, i) => (
                <Fold key={b.id} className={cx("be-card", !b.on && "off")} title={BLOCK_NAMES[b.id]} meta={b.on ? body[b.id].meta : "Hidden"} tools={<>
                    <IconBtn d={I.up} label={`Move ${BLOCK_NAMES[b.id]} up`} disabled={i === 0} onPress={() => move(i, -1)} />
                    <IconBtn d={I.down} label={`Move ${BLOCK_NAMES[b.id]} down`} disabled={i === page.blocks.length - 1} onPress={() => move(i, 1)} />
                    <IconBtn d={b.on ? I.eye : I.eyeOff} label={b.on ? `Hide ${BLOCK_NAMES[b.id]}` : `Show ${BLOCK_NAMES[b.id]}`} onPress={() => set("blocks", page.blocks.map((x) => (x.id === b.id ? { ...x, on: !x.on } : x)))} />
                </>}>
                    {body[b.id].node}
                </Fold>
            ))}
        </>
    );
};

const Toggle = ({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) => (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="be-toggle"><span aria-hidden="true"><i /></span>{label}</button>
);

/* ---------- Design tab ---------- */

const Segments = ({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) => (
    <div className="be-field"><span>{label}</span><div role="radiogroup" aria-label={label} className="be-seg">{options.map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}>{l}</button>)}</div></div>
);

const DesignTab = ({ t, theme, reset }: { t: Theme; theme: <K extends keyof Theme>(k: K, v: Theme[K]) => void; reset: () => void }) => (
    <div className="be-card be-design">
        <div className="be-field"><span>Colour</span>
            <div role="radiogroup" aria-label="Accent colour" className="be-swatches">
                {COLOURS.map((c) => <button key={c} type="button" role="radio" aria-checked={t.colour.toLowerCase() === c.toLowerCase()} aria-label={c} onClick={() => theme("colour", c)} style={{ background: c }} />)}
                <label className="be-custom" title="Any colour"><input type="color" value={t.colour} onChange={(e) => theme("colour", e.target.value)} aria-label="Pick any colour" /><Ico d={I.plus} size={16} /></label>
            </div>
        </div>
        <div className="be-field"><span>Look</span>
            <div className="be-looks">
                {([["outgive", "Outgive"], ["outline", "Outline"], ["soft", "Soft"]] as const).map(([v, l]) => (
                    <button key={v} type="button" aria-pressed={t.style === v} onClick={() => theme("style", v)} className={`be-look l-${v}`} style={{ ["--c" as string]: t.colour }}>
                        <span className="be-look-pic" aria-hidden="true"><i /><b /><b /></span>{l}
                    </button>
                ))}
            </div>
        </div>
        <Segments label="Corners" value={t.corners} onChange={(v) => theme("corners", v as Theme["corners"])} options={[["square", "Square"], ["round", "Round"], ["pill", "Pill"]]} />
        <Segments label="Font" value={t.font} onChange={(v) => theme("font", v as Theme["font"])} options={[["Outfit", "Outfit"], ["DM Sans", "DM Sans"], ["Space Grotesk", "Grotesk"], ["Fraunces", "Fraunces"]]} />
        <Segments label="Causes" value={t.causes} onChange={(v) => theme("causes", v as Theme["causes"])} options={[["grid", "Grid"], ["list", "List"]]} />
        <button type="button" className="be-reset" onClick={() => { if (confirm("Reset the page to the sample content? Your edits will be lost.")) reset(); }}>Reset to sample page</button>
    </div>
);
