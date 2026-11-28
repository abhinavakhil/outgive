/**
 * Chapters (/engage/chapters): a national body's local chapters, each its own organisation with its own give page and team.
 * Admins and owners of the parent hold the same role in every chapter (has_role). Totals come from org_insights per chapter.
 */
import { type FormEvent, useState } from "react";
import { ArrowUpRight, Plus } from "@phosphor-icons/react";
import { useApp } from "@/shared/lib/app-context";
import { Card, Empty, StatStrip } from "../ui/primitives";
import { useWorkspace } from "../shell/workspace";
import { chapterSlug, planAllows, rollUp } from "./model";
import { useBilling, useChapters } from "./data";
import { UpgradeNote } from "./Billing";
import "./account.css";

export const Chapters = () => {
    const ws = useWorkspace(), { toast } = useApp();
    const { billing } = useBilling();
    const c = useChapters();
    const [name, setName] = useState("");
    const [busy, setBusy] = useState(false);
    const admin = ws.role === "owner" || ws.role === "admin";
    if (!admin) return <Card title="Chapters"><Empty>Only admins and owners can see and add chapters.</Empty></Card>;
    if (billing?.billed_by_parent) return <Card title="Chapters"><Empty>{ws.org.name} is a chapter. Chapters are added and compared from the parent organisation.</Empty></Card>;
    if (c.state === "loading") return <div className="eg-skeleton tall" aria-busy="true"><span className="eg-sr">Loading chapters</span></div>;
    if (c.state === "error") return <Card title="Chapters"><Empty>Chapters could not be loaded: {c.error}</Empty></Card>;

    const plan = billing?.plan ?? "free", allowed = planAllows(plan, "chapters");
    const total = rollUp(c.chapters), slug = chapterSlug(ws.org.slug, name || "name");
    const top = Math.max(1, ...c.chapters.map((x) => x.insights.raised_cents));
    const add = async (e: FormEvent) => {
        e.preventDefault(); setBusy(true);
        try { await c.create(name, slug); toast(`${name.trim()} added`); setName(""); } catch (err) { toast((err as Error).message); } finally { setBusy(false); }
    };

    return (
        <div className="eg-ac">
            <header className="eg-ac-head">
                <div>
                    <h1>Chapters</h1>
                    <p className="eg-muted">Each chapter has its own give page, team and numbers. Admins and owners of {ws.org.name} are admins and owners in every chapter; a chapter's own team sees only that chapter.</p>
                </div>
            </header>
            <UpgradeNote plan={plan} feature="chapters" />
            <div className="eg-card eg-ac-kpis"><StatStrip items={[
                { label: "Chapters", value: c.chapters.length },
                { label: "Raised across chapters", value: ws.short(total.raised_cents / 100) },
                { label: "Gifts", value: total.gifts.toLocaleString("en-US") },
                { label: "Donors", value: total.donors.toLocaleString("en-US"), note: "Counted per chapter" },
            ]} /></div>
            <div className="eg-ac-grid">
                <Card title="Every chapter" action={<span className="eg-chip">{c.chapters.length}</span>}>
                    {c.chapters.length ? (
                        <table className="eg-ac-table">
                            <thead><tr><th scope="col">Chapter</th><th scope="col" className="n">Raised</th><th scope="col" className="n hide-sm">Gifts</th><th scope="col" className="n hide-sm">Team</th><th scope="col"><span className="eg-sr">Open</span></th></tr></thead>
                            <tbody>{c.chapters.map((x) => (
                                <tr key={x.id}>
                                    <th scope="row"><b>{x.name}</b><small>/{x.slug}</small><span className="eg-ac-bar" aria-hidden="true"><i style={{ width: `${(x.insights.raised_cents / top) * 100}%` }} /></span></th>
                                    <td className="n">{ws.money(x.insights.raised_cents / 100)}</td>
                                    <td className="n hide-sm">{x.insights.gifts.toLocaleString("en-US")}</td>
                                    <td className="n hide-sm">{x.members}</td>
                                    <td className="n"><a className="eg-btn white sm" href={`/engage?org=${x.slug}`} aria-label={`Open ${x.name}`}>Open<ArrowUpRight size={14} weight="bold" aria-hidden="true" /></a></td>
                                </tr>
                            ))}</tbody>
                        </table>
                    ) : <Empty>No chapters yet. Add the first one and it gets its own give page and team.</Empty>}
                </Card>
                <Card title="Add a chapter">
                    {allowed ? (
                        <form className="eg-ac-form" onSubmit={add}>
                            <label className="eg-ac-field"><span>Chapter name</span><input required maxLength={80} placeholder={`${ws.org.name} Dallas`} value={name} onChange={(e) => setName(e.target.value)} /></label>
                            {name.trim() && <p className="eg-muted eg-ac-fine">Short name: <b>{slug}</b></p>}
                            <button className="eg-btn black" disabled={busy || !name.trim()}><Plus size={16} aria-hidden="true" />Add chapter</button>
                            <p className="eg-muted eg-ac-fine">You reach it from the charity switcher at the top left. Invite its local team from its Team page.</p>
                        </form>
                    ) : <Empty href="/engage/billing" cta="See plans">Chapters are on the Multi-chapter plan.</Empty>}
                </Card>
            </div>
            {ws.sample && <p className="eg-muted eg-ac-fine">Sample chapters. In the demo, new chapters last until you reload and Open stays on the sample charity.</p>}
        </div>
    );
};
