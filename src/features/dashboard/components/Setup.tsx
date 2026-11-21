import { type ReactNode, useEffect, useState } from "react";
import { useApp } from "@/shared/lib/app-context";
import { initials } from "@/shared/lib/format";
import { METHOD_ROWS, PAYPAL_ID, usePaySettings } from "@/shared/lib/pay-settings";
import type { Org } from "@/shared/domain/types";
import { cx } from "@/shared/utils/cx";

const MUTED = "text-(--od-muted)";
const PLUS = <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>;
const Connected = ({ text = "Connected" }: { text?: string }) => <span className="inline-flex items-center gap-2 text-sm font-medium text-(--od-ok-fg)"><span className="size-[7px] rounded-full bg-(--od-ok-fg)" />{text}</span>;
/** One setting: what it is on the left, its control on the right; they stack when there is no room. */
export const Field = ({ label, hint, first, children }: { label: string; hint?: ReactNode; first?: boolean; children: ReactNode }) => (
    <div className={cx("flex flex-wrap items-center gap-x-6 gap-y-2.5 py-[18px]", !first && "border-t border-(--od-line)")}>
        <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5"><span className="text-[15px] font-medium">{label}</span>{hint && <span className={cx("text-sm", MUTED)}>{hint}</span>}</div>
        <div className="flex max-w-[340px] min-w-0 flex-[1_1_300px] items-center justify-end gap-3">{children}</div>
    </div>
);
export const Sheet = ({ children, className }: { children: ReactNode; className?: string }) => <section className={cx("od-card rounded-3xl px-5 py-1.5 sm:px-6", className)}>{children}</section>;

/** Payment gateways: Stripe and PayPal as the organiser admin connects them, and which ways to pay the checkout offers. */
export const Gateways = ({ org, setOrg }: { org: Org; setOrg: (o: Org) => void }) => {
    const { href, isDemo } = useApp();
    const { country, setCountry, busy, st, stripe, save, connected, live, pm, offered } = usePaySettings(org, setOrg, "/dashboard/gateways");
    /** The gateway whose connect form or disconnect question is open. */
    const [open, setOpen] = useState<"" | "stripe" | "paypal">("");
    const [paypal, setPaypal] = useState("");
    useEffect(() => { setOpen(""); }, [org.id, connected.stripe, connected.paypal]);
    const started = !!org.stripe_account_id;
    const gateways = [
        {
            id: "stripe" as const, name: "Stripe", tag: "Cards and bank", on: connected.stripe, kind: "Cards, Apple Pay, Google Pay, pay by bank and Direct Debit",
            actions: connected.stripe
                ? <><Connected text={org.stripe_payouts_enabled ? "Connected" : "Connected, payouts pending"} /><button type="button" className="od-btn" disabled={busy || isDemo} title={isDemo ? "Not available in the demo" : undefined} onClick={() => stripe("dashboard")}>Open Stripe</button></>
                : started ? <><span className="od-tag warn">Set-up not finished</span><button type="button" className="od-btn" disabled={busy} onClick={() => stripe("onboard")}>Continue set-up</button></>
                : <button type="button" className="od-btn" aria-expanded={open === "stripe"} onClick={() => setOpen(open === "stripe" ? "" : "stripe")}>{PLUS}Connect</button>,
            panel: open === "stripe" && !started && (
                <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); stripe("onboard"); }}>
                    <label className="flex flex-[1_1_180px] flex-col gap-1.5 text-sm font-medium">Country (ISO code)<input className="od-in" value={country} maxLength={2} autoFocus onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 2))} aria-describedby="od-country-hint" /></label>
                    <button type="submit" className="od-btn cta" disabled={busy || country.length !== 2}>{isDemo ? "Connect Stripe (demo)" : "Connect with Stripe"}</button>
                    <span id="od-country-hint" className={cx("basis-full text-sm", MUTED)}>Where the organisation is registered. Stripe verifies it and pays out to your bank.</span>
                </form>
            ),
        },
        {
            id: "paypal" as const, name: "PayPal", tag: "Wallet", on: connected.paypal, kind: connected.paypal ? `Paying to ${org.paypal_merchant_id}` : "PayPal balance or a saved card",
            actions: connected.paypal
                ? open !== "paypal" && <><Connected /><button type="button" className="od-btn" disabled={busy} onClick={() => setOpen("paypal")}>Disconnect</button></>
                : <button type="button" className="od-btn" aria-expanded={open === "paypal"} onClick={() => setOpen(open === "paypal" ? "" : "paypal")}>{PLUS}Connect</button>,
            panel: open === "paypal" && (connected.paypal
                ? <div role="alertdialog" aria-label="Confirm disconnect" className="flex flex-wrap items-center justify-between gap-3">
                    <span className="flex-[1_1_280px] text-sm leading-[1.45] text-(--od-ink2)">Disconnect PayPal? Donors will no longer be able to pay by PayPal.</span>
                    <div className="flex gap-2"><button type="button" className="od-btn" autoFocus onClick={() => setOpen("")}>Cancel</button><button type="button" className="od-btn danger" disabled={busy} onClick={() => { setPaypal(""); save({ paypal_merchant_id: "" }, "PayPal disconnected"); }}>Disconnect</button></div>
                </div>
                : <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); if (PAYPAL_ID.test(paypal.trim())) save({ paypal_merchant_id: paypal.trim() }, "PayPal connected"); }}>
                    <label className="flex flex-[1_1_240px] flex-col gap-1.5 text-sm font-medium">PayPal merchant ID or email<input className="od-in" value={paypal} autoFocus placeholder="7Q2XJ4M9ABCDE or giving@charity.org" aria-invalid={!!paypal && !PAYPAL_ID.test(paypal.trim())} aria-describedby="od-paypal-hint" onChange={(e) => setPaypal(e.target.value)} /></label>
                    <button type="submit" className="od-btn cta" disabled={busy || !PAYPAL_ID.test(paypal.trim())}>Connect PayPal</button>
                    <span id="od-paypal-hint" className={cx("basis-full text-sm", paypal && !PAYPAL_ID.test(paypal.trim()) ? "text-(--od-bad-fg)" : MUTED)}>{paypal && !PAYPAL_ID.test(paypal.trim()) ? "That isn't a merchant ID (13 letters and digits) or an email address." : "Find the merchant ID in PayPal under Account settings, Business information."}</span>
                </form>),
        },
    ];
    const group = (title: string, list: typeof gateways) => list.length > 0 && <>
        <h2 className={cx("m-0 text-[15px] font-medium not-first:mt-[18px]", MUTED)}>{title}</h2>
        {list.map((g) => (
            <div key={g.id} data-gateway={g.id} className="od-card flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[22px] px-[18px] py-4">
                <span aria-hidden="true" className="flex size-11 flex-none items-center justify-center rounded-xl bg-(--od-soft) text-lg font-medium">{g.name[0]}</span>
                <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-[3px]"><div className="flex flex-wrap items-center gap-2"><h3 className="m-0 text-base font-medium">{g.name}</h3><span className="rounded-md bg-(--od-soft) px-[7px] py-0.5 text-xs text-(--od-ink2)">{g.tag}</span></div><span className={cx("truncate text-sm", MUTED)}>{g.kind}</span></div>
                {g.actions && <div className="flex flex-none flex-wrap items-center gap-3.5">{g.actions}</div>}
                {g.panel && <div className="basis-full border-t border-(--od-line) pt-3.5">{g.panel}</div>}
            </div>
        ))}
    </>;
    return (
        <div className="mx-auto flex w-full max-w-[760px] flex-col gap-2.5">
            {group("Connected", gateways.filter((g) => g.on))}
            {group("Available", gateways.filter((g) => !g.on))}
            {st?.requirements && st.requirements.length > 0 && <p className="m-0 text-sm text-(--od-warn-fg)">Stripe still needs: {st.requirements.join(", ")}</p>}

            <h2 className={cx("m-0 mt-[18px] text-[15px] font-medium", MUTED)}>Ways to pay at checkout</h2>
            <Sheet>
                {METHOD_ROWS.map(([k, name, desc, via], i) => {
                    const ready = connected[via]; const on = ready && pm[k];
                    return (
                        <Field key={k} first={i === 0} label={name} hint={ready ? desc : `Connect ${via === "stripe" ? "Stripe" : "PayPal"} to offer this.`}>
                            {live[k] && <span className="od-tag ok">Live</span>}
                            <button type="button" role="switch" aria-checked={on} aria-label={name} disabled={!ready || busy} onClick={() => save({ pay_methods: { [k]: !on } })} className={cx("relative h-7 w-12 flex-none rounded-full border-0 p-0 transition-colors after:absolute after:-inset-2", on ? "bg-(--od-lime)" : "bg-(--od-soft)")}><span className={cx("absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow-sm transition-transform", on && "translate-x-5")} /></button>
                        </Field>
                    );
                })}
            </Sheet>
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-3">
                <p className={cx("m-0 flex-[1_1_320px] text-sm leading-normal", MUTED)}>{offered ? `Donors see ${offered} way${offered === 1 ? "" : "s"} to pay.` : "Donors can't pay yet: connect Stripe or PayPal."} Money goes straight from the donor to your own Stripe or PayPal account.</p>
                <a className="od-btn" href={href({ name: "checkout", org: org.slug })}>Preview checkout</a>
            </div>
        </div>
    );
};

const COLOURS: [string, string][] = [["Orchid", "#d9a0f0"], ["Lime", "#b6e84a"], ["Ember", "#ffb08a"], ["Butter", "#f8e08a"], ["Sky", "#a9c8f5"]];
const TAGLINE_MAX = 160;
const fieldsOf = (o: Org) => ({ name: o.name, tagline: o.tagline ?? "", color: o.color, logo_url: o.logo_url ?? "", registration_number: o.registration_number ?? "", website: o.website ?? "" });

/** How the charity appears to donors: the organisation's own name, logo, colour and registration, saved with org_update. */
export const Profile = ({ org, setOrg }: { org: Org; setOrg: (o: Org) => void }) => {
    const { db, toast } = useApp();
    const [f, setF] = useState(() => fieldsOf(org));
    const [state, setState] = useState<"" | "dirty" | "saving" | "saved">("");
    useEffect(() => { setF(fieldsOf(org)); setState(""); }, [org.id]); // eslint-disable-line react-hooks/exhaustive-deps
    const set = (k: keyof typeof f, max?: number) => (v: string) => { setF((o) => ({ ...o, [k]: max ? v.slice(0, max) : v })); setState("dirty"); };
    const save = async () => { setState("saving"); try { setOrg(await db.rpc<Org>("org_update", { org: org.id, p: f })); setState("saved"); } catch (e) { toast((e as Error).message); setState("dirty"); } };
    const logo = async (file?: File) => { if (!file) return; if (file.size > 2 * 1024 * 1024) return toast("That file is over 2 MB."); try { set("logo_url")(await db.upload(file, `logos/${org.id}/${Date.now()}-${file.name}`)); } catch (e) { toast((e as Error).message); } };
    const colours = COLOURS.some(([, hex]) => hex === org.color.toLowerCase()) ? COLOURS : [["Current", org.color] as [string, string], ...COLOURS];
    return (
        <form className="mx-auto flex w-full max-w-[760px] flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (f.name.trim()) save(); }}>
            <Sheet>
                <Field first label="Logo" hint="PNG or SVG, up to 2 MB">
                    {f.logo_url ? <img src={f.logo_url} alt="" className="size-11 flex-none rounded-xl object-cover" /> : <span aria-hidden="true" className="flex size-11 flex-none items-center justify-center rounded-xl text-[15px] font-semibold text-[#1a1440]" style={{ background: f.color }}>{initials(f.name) || "?"}</span>}
                    <label className="od-btn cursor-pointer focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-[#b45fd6]">{f.logo_url ? "Replace" : "Upload"}<input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className="sr-only" aria-label="Logo file" onChange={(e) => logo(e.target.files?.[0])} /></label>
                </Field>
                <Field label="Name" hint="Shown on your donation page"><input className="od-in" aria-label="Name" required value={f.name} onChange={(e) => set("name")(e.target.value)} /></Field>
                <Field label="Short description" hint={`${TAGLINE_MAX - f.tagline.length} characters left`}><textarea className="od-in" aria-label="Short description" value={f.tagline} onChange={(e) => set("tagline", TAGLINE_MAX)(e.target.value)} /></Field>
                <Field label="Brand colour" hint="Tints your logo tile">
                    <div className="flex flex-wrap justify-end gap-2">
                        {colours.map(([name, hex]) => <button key={hex} type="button" onClick={() => set("color")(hex)} aria-pressed={f.color.toLowerCase() === hex.toLowerCase()} aria-label={name} title={name} className="size-11 rounded-full border-2 p-0 shadow-[inset_0_0_0_5px_var(--od-cs)]" style={{ background: hex, borderColor: f.color.toLowerCase() === hex.toLowerCase() ? "var(--od-ink)" : "transparent" }} />)}
                        <label title="Custom colour" className="relative flex size-11 cursor-pointer items-center justify-center rounded-full border border-dashed border-(--od-muted) text-(--od-muted) focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-[#b45fd6]">{PLUS}<input type="color" aria-label="Custom colour" value={/^#[0-9a-f]{6}$/i.test(f.color) ? f.color : "#000000"} onChange={(e) => set("color")(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" /></label>
                    </div>
                </Field>
            </Sheet>
            <Sheet>
                <Field first label="Registered charity number" hint="Shown on donor receipts"><input className="od-in" aria-label="Registered charity number" placeholder="1234567" value={f.registration_number} onChange={(e) => set("registration_number", 40)(e.target.value)} /></Field>
                <Field label="Website" hint="Shown on donor receipts"><input className="od-in" type="url" aria-label="Website" placeholder="https://" value={f.website} onChange={(e) => set("website")(e.target.value)} /></Field>
            </Sheet>
            <div className="flex flex-wrap items-center justify-end gap-4">
                <span role="status" className={cx("text-sm", state === "dirty" ? "text-(--od-warn-fg)" : "text-(--od-ok-fg)")}>{state === "dirty" ? "Unsaved changes" : state === "saved" ? "Saved" : ""}</span>
                {state === "dirty" && <button type="button" className="od-btn ghost" onClick={() => { setF(fieldsOf(org)); setState(""); }}>Discard</button>}
                <button type="submit" className="od-btn cta" disabled={state !== "dirty" || !f.name.trim()}>{state === "saving" ? "Saving…" : "Save changes"}</button>
            </div>
        </form>
    );
};
