/**
 * Team (/engage/team): who works on the charity and what they can do. Admins invite (an email goes out through the invite-email
 * function), change roles, remove people, and resend or cancel invites. The database checks every change (has_role, member_*).
 */
import { type FormEvent, useState } from "react";
import { EnvelopeSimple, PaperPlaneTilt, Trash, X } from "@phosphor-icons/react";
import { useApp } from "@/shared/lib/app-context";
import { cx } from "@/shared/utils/cx";
import { ROLE_INFO, type Role } from "@/features/launch";
import { Card, Empty, StatStrip, Tag } from "../ui/primitives";
import { useWorkspace } from "../shell/workspace";
import { type Member, canManage, rolesOffered } from "./model";
import { useTeam } from "./data";
import "./account.css";

const ago = (iso: string) => {
    const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
    return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};
const initials = (s: string) => s.split(/[\s@.]+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const TONE: Record<Role, "forest" | "lilac" | "sage" | "grey"> = { owner: "forest", admin: "lilac", editor: "sage", viewer: "grey" };

export const Team = () => {
    const ws = useWorkspace(), { toast } = useApp();
    const t = useTeam();
    const offer = rolesOffered(ws.role), admin = offer.length > 0;
    const [email, setEmail] = useState("");
    const [role, setRole] = useState<Role>("editor");
    const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
    const [busy, setBusy] = useState(false);
    const act = async (f: () => Promise<string>) => {
        setBusy(true); setNote(null);
        try { const text = await f(); setNote({ ok: true, text }); toast(text); } catch (e) { setNote({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
    };

    if (t.state === "loading") return <div className="eg-skeleton tall" aria-busy="true"><span className="eg-sr">Loading the team</span></div>;
    if (t.state === "error") return <Card title="Team"><Empty>The team could not be loaded: {t.error}</Empty></Card>;
    const invite = (e: FormEvent) => {
        e.preventDefault();
        const to = email.trim();
        void act(async () => {
            const r = await t.add(to, role); setEmail("");
            return r === "added" ? `${to} is on the team as ${ROLE_INFO[role][0].toLowerCase()}.` : r === "invited" ? `Invite emailed to ${to}. They join when they sign in with that address.`
                : `Invite saved for ${to}, but the email did not send. Use Resend, or ask them to sign in at ${location.host}/ramadhan/login.`;
        });
    };
    const owners = t.members.filter((m) => m.role === "owner").length;

    return (
        <div className="eg-ac">
            <header className="eg-ac-head">
                <div>
                    <h1>Team</h1>
                    <p className="eg-muted">Everyone here sees {ws.org.name}'s numbers. What else they can do depends on their role. Admins and owners of a parent organisation also manage its chapters.</p>
                </div>
            </header>
            <div className="eg-card eg-ac-kpis"><StatStrip items={[
                { label: "People", value: t.members.length, note: `${owners} ${owners === 1 ? "owner" : "owners"}` },
                { label: "Can edit", value: t.members.filter((m) => m.role !== "viewer").length, note: "Editors and up" },
                { label: "Invited", value: t.invites.length, note: "Waiting to sign in" },
            ]} /></div>

            <div className="eg-ac-grid">
                <Card title="People" action={<span className="eg-chip">{t.members.length}</span>}>
                    <ul className="eg-ac-list">{t.members.map((m) => <Person key={m.user_id} m={m} me={t.me} offer={offer} busy={busy}
                        onRole={(r) => act(async () => { await t.setRole(m, r); return `${m.name || m.email} is now ${ROLE_INFO[r][0].toLowerCase()}.`; })}
                        onRemove={() => act(async () => { await t.remove(m); return `${m.name || m.email} was removed.`; })} />)}</ul>
                </Card>

                <div className="eg-ac-stack">
                    {admin ? (
                        <Card title="Invite someone">
                            <form className="eg-ac-form" onSubmit={invite}>
                                <label className="eg-ac-field"><span>Email</span><input type="email" required autoComplete="off" placeholder="name@yourcharity.org" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
                                <fieldset className="eg-ac-roles">
                                    <legend>Role</legend>
                                    {offer.filter((r) => r !== "owner").map((r) => (
                                        <label key={r} className={cx(role === r && "on")}>
                                            <input type="radio" name="eg-ac-role" value={r} checked={role === r} onChange={() => setRole(r)} />
                                            <span><b>{ROLE_INFO[r][0]}</b><small>{ROLE_INFO[r][1]}</small></span>
                                        </label>
                                    ))}
                                </fieldset>
                                <button className="eg-btn black" disabled={busy || !email.includes("@")}><PaperPlaneTilt size={16} aria-hidden="true" />Send invite</button>
                                <p className="eg-muted eg-ac-fine">No password needed. They get an email, sign in with a code, and join the team. Owners are added once they have signed in.</p>
                            </form>
                        </Card>
                    ) : <Card title="Invite someone"><Empty>Only admins and owners can invite people or change roles.</Empty></Card>}
                    {note && <p role="status" className={cx("eg-ac-note", !note.ok && "bad")}>{note.text}</p>}

                    {admin && (
                        <Card title="Pending invites" action={<span className="eg-chip">{t.invites.length}</span>}>
                            {t.invites.length ? <ul className="eg-ac-list">{t.invites.map((i) => (
                                <li key={i.email}>
                                    <span className="eg-ac-av ghost" aria-hidden="true"><EnvelopeSimple size={16} /></span>
                                    <span className="eg-ac-who"><b>{i.email}</b><small>{ROLE_INFO[i.role][0]} · invited {ago(i.created_at)}{i.emailed_at ? ` · emailed ${(i.emails_sent ?? 1) === 1 ? "once" : `${i.emails_sent} times`}` : " · not emailed"}</small></span>
                                    <span className="eg-ac-acts">
                                        <button type="button" className="eg-btn white sm" disabled={busy} onClick={() => act(async () => { await t.resend(i); return `Invite emailed again to ${i.email}.`; })}>Resend</button>
                                        <button type="button" className="eg-icon-btn sm" aria-label={`Cancel the invite to ${i.email}`} disabled={busy} onClick={() => act(async () => { await t.cancel(i); return `Invite to ${i.email} cancelled.`; })}><X size={16} aria-hidden="true" /></button>
                                    </span>
                                </li>
                            ))}</ul> : <Empty>No invites waiting. Invite someone and they appear here until they sign in.</Empty>}
                        </Card>
                    )}
                </div>
            </div>
            {ws.sample && <p className="eg-muted eg-ac-fine">Sample team. In the demo, invites are not emailed and changes last until you reload.</p>}
        </div>
    );
};

const Person = ({ m, me, offer, busy, onRole, onRemove }: { m: Member; me: string | undefined; offer: Role[]; busy: boolean; onRole: (r: Role) => void; onRemove: () => void }) => {
    const ws = useWorkspace();
    const can = canManage(ws.role, m, me), who = m.name || m.email;
    return (
        <li>
            <span className="eg-ac-av" aria-hidden="true">{initials(who)}</span>
            <span className="eg-ac-who"><b>{who}{m.user_id === me && <em> (you)</em>}</b><small>{m.email}</small></span>
            <span className="eg-ac-acts">
                {can ? <>
                    <label className="eg-ac-sel"><span className="eg-sr">Role for {who}</span>
                        <select value={m.role} disabled={busy} onChange={(e) => onRole(e.target.value as Role)}>{(offer.includes(m.role) ? offer : [m.role, ...offer]).map((r) => <option key={r} value={r}>{ROLE_INFO[r][0]}</option>)}</select>
                    </label>
                    <button type="button" className="eg-icon-btn sm" aria-label={`Remove ${who}`} disabled={busy} onClick={() => { if (confirm(`Remove ${who} from the team?`)) onRemove(); }}><Trash size={16} aria-hidden="true" /></button>
                </> : <Tag tone={TONE[m.role]}>{ROLE_INFO[m.role][0]}</Tag>}
            </span>
        </li>
    );
};
