/**
 * Accounts for the Ramadan pages, built from the donate flow's parts (pile.css: the gb top bar, fields, buttons and boxes).
 *   /ramadhan/login    Sign in or sign up, one screen: Google, or a 6-digit code (and a link) by email. No passwords.
 *   /ramadhan/account  The donor's giving and receipts (guest gifts made with the same email included), and their charity teams.
 *   /ramadhan/team     A charity's team: invite by email, change roles, remove. Admins and owners.
 * Giving never needs an account. Signing in only adds history for donors, and the organiser view for a charity's team.
 */
import { type ReactNode, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ChartBar, EnvelopeOpen, LockSimple, MoonStars, Receipt, SignOut, UsersThree } from "@phosphor-icons/react";
import { OgLogo } from "@/shared/ui";
import { useApp } from "@/shared/lib/app-context";
import { track } from "@/shared/lib/analytics";
import { cx } from "@/shared/utils/cx";
import { gbp } from "../give/model";
import { RAMADAN_ORG } from "../bio/live";
import { ROLE_INFO, type Role, atLeast, useRoles } from "./roles";
import "../give/pile.css";
import "./account.css";

const nextOf = () => { const n = new URLSearchParams(location.search).get("next"); return n && n.startsWith("/") && !n.startsWith("//") ? n : "/ramadhan/account"; };

/** The donate flow's frame: top bar with back, the logo and "Secure", then one centred column. */
const Frame = ({ children, back = "/ramadhan" }: { children: ReactNode; back?: string }) => (
    <div className="gb ac">
        <header className="gb-top">
            <a className="gb-back" href={back} aria-label="Back"><ArrowLeft size={18} weight="bold" aria-hidden="true" /></a>
            <a href="/" aria-label="Outgive home" className="og-home"><OgLogo size={24} /></a>
            <span style={{ flex: 1 }} />
            <span className="gb-secure"><LockSimple size={14} weight="fill" aria-hidden="true" />Secure</span>
        </header>
        <main className="ac-main">{children}</main>
    </div>
);

// ---------------------------------------------------------------- sign in
/** Google's four-colour G: their brand guidelines ask for it on "Continue with Google". */
const GoogleG = () => (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
);

/** Six boxes drawn over one real input, so paste, one-time-code autofill and the keyboard all just work. */
const CodeBoxes = ({ value, onChange, bad }: { value: string; onChange: (v: string) => void; bad: boolean }) => (
    <label className={cx("ac-otp", bad && "bad")}>
        <span className="ac-sr">6-digit code</span>
        <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={value} autoFocus aria-invalid={bad || undefined}
            onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))} />
        {Array.from({ length: 6 }, (_, i) => <span key={i} aria-hidden="true" className={cx(value[i] && "on", i === Math.min(value.length, 5) && "cur")}>{value[i] ?? ""}</span>)}
    </label>
);

export const SignInPanel = ({ next, title = "Sign in to Outgive", sub = "Your gifts, receipts and Gift Aid in one place. New here? This creates your account." }: { next: string; title?: string; sub?: string }) => {
    const { db, isDemo } = useApp();
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [step, setStep] = useState<"email" | "code">("email");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [wait, setWait] = useState(0);
    useEffect(() => { if (!wait) return; const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t); }, [wait]);
    const redirect = `${location.origin}${next}`;
    const run = async (f: () => Promise<void>) => { setBusy(true); setError(""); try { await f(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
    const send = () => {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Enter a valid email address.");
        void run(async () => { await db.signInEmail(email.trim(), redirect); setStep("code"); setCode(""); setWait(30); track("auth_code_sent", {}); });
    };
    const verify = (c = code) => {
        if (!/^\d{6}$/.test(c)) return setError("Enter all 6 digits from the email.");
        void run(async () => { await db.verifyEmail(email.trim(), c); track("auth_signed_in", { via: "code" }); location.replace(next); });
    };
    const typed = (c: string) => { setCode(c); setError(""); if (c.length === 6 && !busy) verify(c); };

    if (isDemo) return <div className="ac-panel"><h1 className="ac-title">{title}</h1><p className="ac-sub">This is the demo, so you are already signed in as the sample charity’s owner.</p><a className="gb-btn ac-cta" href={next}>Continue</a></div>;
    return step === "email" ? (
        <form className="ac-panel" noValidate onSubmit={(e) => { e.preventDefault(); send(); }}>
            <div className="ac-intro"><h1 className="ac-title">{title}</h1><p className="ac-sub">{sub}</p></div>
            <button type="button" className="ac-google" disabled={busy} onClick={() => run(async () => { track("auth_google", {}); await db.signInGoogle(redirect); })}><GoogleG />Continue with Google</button>
            <div className="ac-or"><span>or use your email</span></div>
            <label className={cx("gb-field", error && "bad")}><span>Email address</span><input type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} aria-invalid={!!error || undefined} />{error && <small role="alert">{error}</small>}</label>
            <button type="submit" className="gb-btn ac-cta" disabled={busy}>{busy ? "Sending code…" : <>Continue with email<ArrowRight size={18} weight="bold" aria-hidden="true" /></>}</button>
            <p className="ac-fine">No password needed. We’ll email you a 6-digit code. You never need an account to give.</p>
        </form>
    ) : (
        <form className="ac-panel" onSubmit={(e) => { e.preventDefault(); verify(); }}>
            <span className="ac-badge"><EnvelopeOpen size={26} weight="duotone" aria-hidden="true" /></span>
            <div className="ac-intro"><h1 className="ac-title">Check your inbox</h1><p className="ac-sub">Enter the 6-digit code we sent to <b>{email.trim()}</b>, or tap the link in the email.</p></div>
            <CodeBoxes value={code} onChange={typed} bad={!!error} />
            {error && <small className="ac-err" role="alert">{error}</small>}
            <button type="submit" className="gb-btn ac-cta" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Verify and sign in"}</button>
            <p className="ac-fine">Didn’t get it? Check spam, or <button type="button" className="ac-link" disabled={wait > 0 || busy} onClick={send}>{wait ? `resend in ${wait}s` : "send a new code"}</button>.</p>
            <button type="button" className="ac-link ac-back" onClick={() => { setStep("email"); setCode(""); setError(""); }}><ArrowLeft size={14} weight="bold" aria-hidden="true" />Use a different email</button>
        </form>
    );
};

/** Sign-in layout: the form on the left, a warm Ramadan panel on the right (hidden on phones). */
const AuthShell = ({ children }: { children: ReactNode }) => (
    <div className="gb ac-auth">
        <div className="ac-side">
            <header className="ac-bar"><a href="/" aria-label="Outgive home" className="og-home"><OgLogo size={24} /></a></header>
            <main className="ac-center">{children}</main>
            <p className="ac-foot"><LockSimple size={13} weight="fill" aria-hidden="true" />Secure sign-in. We never sell or share your details.</p>
        </div>
        <aside className="ac-art" aria-hidden="true">
            <svg className="ac-moon" viewBox="0 0 200 200"><path d="M128 22a82 82 0 1 0 50 136A70 70 0 1 1 128 22z" fill="currentColor" /><path d="m160 52 5 13 13 5-13 5-5 13-5-13-13-5 13-5z" fill="currentColor" /></svg>
            <div className="ac-art-copy">
                <p className="ac-kicker">Ramadan on Outgive</p>
                <p className="ac-big">Every night<br />of giving, in<br />one place.</p>
                <ul>
                    <li><Receipt size={20} weight="bold" />Receipts and Gift Aid for every gift</li>
                    <li><MoonStars size={20} weight="bold" />Your giving, night by night</li>
                    <li><ChartBar size={20} weight="bold" />Live organiser view for charity teams</li>
                </ul>
            </div>
        </aside>
    </div>
);

export const RamadanSignIn = () => {
    const { user } = useApp();
    const next = nextOf();
    useEffect(() => { if (user) location.replace(next); }, [user, next]);
    return <AuthShell><SignInPanel next={next} /></AuthShell>;
};

// ---------------------------------------------------------------- account: my giving and my teams
type MyGift = { id: string; org_name: string; page_title: string | null; amount_cents: number; currency: string; gift_aid_cents: number; recurring: boolean; status: string; created_at: string };
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export const RamadanAccount = () => {
    const { db, user, isDemo } = useApp();
    const roles = useRoles();
    const [gifts, setGifts] = useState<MyGift[] | null>(null);
    useEffect(() => { if (!user || isDemo) return; db.rpc<MyGift[]>("my_gifts").then((g) => setGifts(g ?? []), () => setGifts([])); }, [db, user, isDemo]);
    if (!user && !isDemo) return <AuthShell><SignInPanel next="/ramadhan/account" title="Your giving" sub="Sign in to see your gifts, receipts and Gift Aid. Gifts you made as a guest show up too, if you use the same email." /></AuthShell>;
    const paid = (gifts ?? []).filter((g) => g.status === "succeeded");
    const total = paid.reduce((n, g) => n + g.amount_cents, 0) / 100, aid = paid.reduce((n, g) => n + g.gift_aid_cents, 0) / 100;
    return (
        <Frame>
            <div className="ac-hello">
                <h1 className="gb-h ac-h">Salaam{user?.name ? `, ${user.name.split(" ")[0]}` : ""}</h1>
                <p className="ac-sub">{user?.email ?? "Demo account"}</p>
            </div>
            {!!roles?.length && (
                <section className="gb-box">
                    <div className="gb-box-head"><b>Your charities</b><span>Your role</span></div>
                    <ul className="ac-list">{roles.map((r) => (
                        <li key={r.org_id}>
                            <span className="ac-av">{r.name.slice(0, 2).toUpperCase()}</span>
                            <span className="ac-grow"><b>{r.name}</b><small>{ROLE_INFO[r.role][0]} · {ROLE_INFO[r.role][1]}</small></span>
                            {r.slug === RAMADAN_ORG && <a className="gb-btn outline sm" href="/ramadhan?insights">Organiser view</a>}
                            {r.slug === RAMADAN_ORG && atLeast(r.role, "admin") && <a className="gb-btn outline sm" href="/ramadhan/team"><UsersThree size={16} weight="bold" aria-hidden="true" />Team</a>}
                        </li>
                    ))}</ul>
                </section>
            )}
            <section className="gb-box">
                <div className="gb-box-head"><b>Your giving</b><span>{paid.length ? `${gbp(total)} given${aid ? ` · ${gbp(aid)} Gift Aid` : ""}` : ""}</span></div>
                {isDemo ? <p className="ac-sub">In the demo, gifts are not saved to an account.</p>
                    : gifts === null ? <p className="ac-sub">Loading…</p>
                    : !gifts.length ? <div className="ac-empty"><p className="ac-sub">No gifts yet. Gifts you make with {user?.email} will appear here, with their receipts.</p><a className="gb-btn primary sm" href="/ramadhan/give">Give this Ramadan</a></div>
                    : <ul className="ac-list">{gifts.map((g) => (
                        <li key={g.id}>
                            <span className="ac-grow"><b>{g.page_title ?? g.org_name}</b><small>{day(g.created_at)}{g.recurring ? " · Regular" : ""}{g.gift_aid_cents ? ` · +${gbp(g.gift_aid_cents / 100)} Gift Aid` : ""}{g.status !== "succeeded" ? ` · ${g.status}` : ""}</small></span>
                            <b className="ac-amt">{gbp(g.amount_cents / 100)}</b>
                        </li>
                    ))}</ul>}
            </section>
            <button type="button" className="gb-btn outline ac-wide" onClick={async () => { await db.signOut(); location.href = "/ramadhan"; }}><SignOut size={18} weight="bold" aria-hidden="true" />Sign out</button>
        </Frame>
    );
};

// ---------------------------------------------------------------- team
type Member = { user_id: string; email: string; name: string; role: Role };
type Invite = { email: string; role: Role; created_at: string };

export const RamadanTeam = () => {
    const { db, user, isDemo } = useApp();
    const roles = useRoles();
    const me = roles?.find((r) => r.slug === RAMADAN_ORG) ?? null;
    const [members, setMembers] = useState<Member[]>([]);
    const [invites, setInvites] = useState<Invite[]>([]);
    const [email, setEmail] = useState("");
    const [role, setRole] = useState<Role>("viewer");
    const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
    const load = async () => {
        if (!me || isDemo) return;
        setMembers((await db.rpc<Member[]>("org_members_list", { org: me.org_id })) ?? []);
        setInvites(atLeast(me.role, "admin") ? ((await db.rpc<Invite[]>("org_invites_list", { org: me.org_id }).catch(() => [])) ?? []) : []);
    };
    useEffect(() => { void load(); }, [me?.org_id, me?.role]); // eslint-disable-line react-hooks/exhaustive-deps
    /** Runs a team change and says how it went; f returns the message for success. */
    const act = async (f: () => Promise<string>) => { setNote(null); try { setNote({ ok: true, text: await f() }); await load(); } catch (e) { setNote({ ok: false, text: (e as Error).message }); } };
    const add = () => act(async () => {
        const e = email.trim();
        const added = await db.rpc<boolean>("member_add", { org: me!.org_id, member_email: e, member_role: role });
        setEmail("");
        // ponytail: no invite email is sent yet; the admin tells them. Send one from an edge function (Resend) when teams grow.
        return added ? `${e} is on the team.` : `Saved. ${e} has no account yet: ask them to sign in at ${location.host}/ramadhan/login with this email, and they’ll be on the team.`;
    });

    if (!user && !isDemo) return <AuthShell><SignInPanel next="/ramadhan/team" title="Your charity’s team" sub="Sign in with the email your charity added you with." /></AuthShell>;
    if (roles === null) return <Frame><p className="ac-sub">Loading…</p></Frame>;
    if (!atLeast(me?.role, "admin")) return <Frame><div className="gb-box"><h1 className="gb-h ac-h">Admins only</h1><p className="ac-sub">Only the charity’s admins and owners can manage its team. Ask one of them to change your role.</p><a className="gb-btn outline ac-wide" href="/ramadhan/account">Back to your account</a></div></Frame>;
    const owner = me!.role === "owner";
    const canChange = (m: Member) => m.user_id !== user?.id && (owner || !atLeast(m.role, "admin"));
    const offer: Role[] = owner ? ["owner", "admin", "editor", "viewer"] : ["editor", "viewer"];

    return (
        <Frame back="/ramadhan/account">
            <div className="ac-hello"><h1 className="gb-h ac-h">{me!.name}’s team</h1><p className="ac-sub">Everyone here can see the organiser view. What else they can do depends on their role.</p></div>
            <form className="gb-box ac-form" onSubmit={(e) => { e.preventDefault(); if (email.includes("@")) void add(); }}>
                <div className="gb-box-head"><b>Add someone</b></div>
                <label className="gb-field"><span>Email</span><input type="email" autoComplete="off" placeholder="name@yourcharity.org" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
                <div className="ac-roles" role="radiogroup" aria-label="Role">{(offer.filter((r) => r !== "owner") as Role[]).map((r) => (
                    <button key={r} type="button" role="radio" aria-checked={role === r} className={cx("gb-method", role === r && "on")} onClick={() => setRole(r)}>
                        <span className="gb-method-tx"><b>{ROLE_INFO[r][0]}</b><span>{ROLE_INFO[r][1]}</span></span>
                    </button>
                ))}</div>
                <button type="submit" className="gb-btn primary lg" disabled={!email.includes("@")}>Add to the team</button>
                <p className="gb-fine">No account yet? They join the team the first time they sign in with this email.</p>
            </form>
            {note && <p role="status" className={cx("ac-note", !note.ok && "bad")}>{note.text}</p>}
            <section className="gb-box">
                <div className="gb-box-head"><b>Team</b><span>{members.length} {members.length === 1 ? "person" : "people"}</span></div>
                <ul className="ac-list">{members.map((m) => (
                    <li key={m.user_id}>
                        <span className="ac-av">{(m.name || m.email).slice(0, 2).toUpperCase()}</span>
                        <span className="ac-grow"><b>{m.name || m.email}{m.user_id === user?.id && <em> (you)</em>}</b><small>{m.email}</small></span>
                        {canChange(m) ? <>
                            <span className="gb-input sel ac-sel"><select aria-label={`Role for ${m.email}`} value={m.role} onChange={(e) => { const r = e.target.value as Role; void act(async () => { await db.rpc("member_set_role", { org: me!.org_id, member: m.user_id, new_role: r }); return `${m.email} is now ${ROLE_INFO[r][0].toLowerCase()}.`; }); }}>{(offer.includes(m.role) ? offer : [m.role, ...offer]).map((r) => <option key={r} value={r}>{ROLE_INFO[r][0]}</option>)}</select></span>
                            <button type="button" className="gb-tx" onClick={() => act(async () => { await db.rpc("member_remove", { org: me!.org_id, member: m.user_id }); return `${m.email} was removed.`; })}>Remove</button>
                        </> : <span className="ac-tag">{ROLE_INFO[m.role][0]}</span>}
                    </li>
                ))}</ul>
            </section>
            {!!invites.length && (
                <section className="gb-box">
                    <div className="gb-box-head"><b>Invited</b><span>Waiting for them to sign in</span></div>
                    <ul className="ac-list">{invites.map((i) => (
                        <li key={i.email}>
                            <span className="ac-grow"><b>{i.email}</b><small>{ROLE_INFO[i.role][0]} · invited {day(i.created_at)}</small></span>
                            <button type="button" className="gb-tx" onClick={() => act(async () => { await db.rpc("invite_cancel", { org: me!.org_id, invite_email: i.email }); return `Invite to ${i.email} cancelled.`; })}>Cancel</button>
                        </li>
                    ))}</ul>
                </section>
            )}
        </Frame>
    );
};
