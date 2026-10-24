import { useState } from "react";
import { ArrowRight } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import { NativeSelect } from "@/components/base/select/select-native";
import { Container, SiteHeader, useApp } from "@/components/outgive/shared";
import { CURRENCIES, FONTS } from "@/data";
import type { Org } from "@/lib/types";
import { ALL_VARIANTS } from "@/views/boards";
import { SignIn } from "@/views/Login";

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

/** A charity creates its organisation: the board exists as soon as this is submitted; Stripe is connected from the dashboard. */
export const Start = () => {
    const { db, user, go, isDemo } = useApp();
    const [f, setF] = useState({ name: "", slug: "", tagline: "", description: "", color: "#e0603f", font: "Poppins", variant: "list", currency: "USD", country: "", registration_number: "", website: "", impact_unit: "", impact_usd: "" });
    const set = (k: keyof typeof f) => (v: string) => setF((o) => ({ ...o, [k]: v }));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const slug = f.slug || slugify(f.name);
    const submit = async () => {
        if (!f.name.trim()) return setError("Give your organisation a name.");
        if (!/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(slug)) return setError("The address can only have letters, numbers and dashes.");
        setBusy(true); setError("");
        try { const o = await db.rpc<Org>("org_create", { p: { ...f, slug, impact_usd: f.impact_usd || null } }); go({ name: "admin", org: o.slug, tab: "payments" }); } catch (e) { setError((e as Error).message.includes("orgs_slug_key") ? "That address is taken. Pick another." : (e as Error).message); } finally { setBusy(false); }
    };
    return (
        <div className="min-h-dvh bg-primary"><Container className="flex max-w-2xl flex-col gap-8 py-5"><SiteHeader />
            <div><h1 className="text-display-sm font-semibold tracking-tight text-primary">Run a board for your organisation</h1><p className="mt-2 text-lg text-tertiary">Your name, colours and address. You can change all of it later and connect Stripe when you are ready to take gifts.</p></div>
            {!user && !isDemo ? <div className="rounded-3xl p-6 ring-1 ring-secondary ring-inset"><SignIn next="/start" title="Sign in to start" sub="Your account becomes the organisation's owner." /></div> : (
                <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); submit(); }}>
                    {isDemo && <p className="rounded-2xl bg-secondary px-4 py-3 text-sm text-tertiary">Demo: the organisation you create lives in this browser only.</p>}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="Organisation name" isRequired value={f.name} onChange={set("name")} placeholder="Clearwell Trust" />
                        <Input label="Address" value={f.slug} onChange={(v) => set("slug")(slugify(v))} placeholder={slug || "your-charity"} hint={`outgive.org/o/${slug || "your-charity"}`} />
                        <Input label="Tagline" value={f.tagline} onChange={set("tagline")} placeholder="Clean water for 40 villages" />
                        <Input label="Website" value={f.website} onChange={set("website")} placeholder="https://" />
                        <Input label="Country" value={f.country} onChange={set("country")} placeholder="United Kingdom" />
                        <Input label="Charity registration number" value={f.registration_number} onChange={set("registration_number")} placeholder="Shown on receipts" />
                        <NativeSelect label="Currency" value={f.currency} onChange={(e) => set("currency")(e.target.value)} options={Object.keys(CURRENCIES).map((c) => ({ label: c, value: c }))} />
                        <label className="flex flex-col gap-1.5 text-sm font-medium text-secondary">Brand colour<span className="flex h-10 items-center gap-3 rounded-lg px-3 ring-1 ring-primary ring-inset"><input type="color" aria-label="Brand colour" value={f.color} onChange={(e) => set("color")(e.target.value)} className="size-7 cursor-pointer rounded-md border-0 bg-transparent p-0" /><span className="font-mono text-sm text-tertiary uppercase">{f.color}</span></span></label>
                        <NativeSelect label="Font" value={f.font} onChange={(e) => set("font")(e.target.value)} options={FONTS.map((x) => ({ label: x, value: x }))} />
                        <NativeSelect label="Board layout" value={f.variant} onChange={(e) => set("variant")(e.target.value)} options={ALL_VARIANTS.map(([v, l]) => ({ label: l, value: v }))} />
                        <Input label="What gifts buy (plural)" value={f.impact_unit} onChange={set("impact_unit")} placeholder="boreholes" />
                        <Input label="Cost of one (USD)" type="number" value={f.impact_usd} onChange={set("impact_usd")} placeholder="6000" />
                    </div>
                    <TextArea label="About your organisation" rows={3} value={f.description} onChange={set("description")} />
                    {error && <p className="text-sm text-error-primary">{error}</p>}
                    <Button type="submit" color="primary" size="xl" className="w-fit rounded-full" iconTrailing={ArrowRight} isDisabled={busy}>{busy ? "Creating…" : "Create my board"}</Button>
                </form>
            )}
        </Container></div>
    );
};
