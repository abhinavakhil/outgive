/**
 * The charity the back office is looking at, shared with every screen in /engage through useWorkspace().
 * Picked from the signed-in person's roles (?org=<slug> chooses one when they have several).
 */
import { createContext, useContext, useEffect, useState } from "react";
import { useApp } from "@/shared/lib/app-context";
import type { Org } from "@/shared/domain/types";
import type { OrgRole, Role } from "@/features/launch";

export type Mode = "demo" | "test" | "live";
export type Workspace = {
    org: { id: string; slug: string; name: string; ein: string; currency: string };
    role: Role; roles: OrgRole[];
    /** demo: the in-browser demo, cards show labelled sample figures. test: Stripe test keys, no real money. live: real payments. */
    mode: Mode;
    /** True when cards should show sample figures instead of the database (the demo; ?empty shows the empty states instead). */
    sample: boolean;
    money: (n: number) => string;
    /** Money in few characters, for tight spots (pie labels, stat strip): $412.9K. */
    short: (n: number) => string;
};
export const WorkspaceContext = createContext<Workspace>(null!);
export const useWorkspace = () => useContext(WorkspaceContext);

/** The demo's charity: the SAMPLE US org Hope Foundation (supabase/migrations/20261128000050_us_sample_org.sql). Not a real charity. */
export const SAMPLE_ORG = { slug: "hope-foundation", name: "Hope Foundation", ein: "12-3456789", currency: "USD" };

const MODE: Mode = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY?.startsWith("pk_live") ? "live" : "test";

/** Builds the workspace for one of the person's charities; null while the org row loads. */
export const useLoadWorkspace = (roles: OrgRole[]): Workspace | null => {
    const { db, isDemo } = useApp();
    const want = new URLSearchParams(location.search).get("org");
    const r = roles.find((x) => x.slug === want) ?? roles[0];
    const [org, setOrg] = useState<Org | null>(null);
    useEffect(() => {
        let off = false;
        // If the row cannot be read, the role already names the charity; only the EIN and currency are missing.
        const fallback = { id: r.org_id, slug: r.slug, name: r.name, registration_number: "", currency: "USD" } as Org;
        db.rpc<Org[]>("org_by_slug", { s: r.slug }).then((o) => !off && setOrg(o[0] ?? fallback), () => !off && setOrg(fallback));
        return () => { off = true; };
    }, [db, r.slug]);
    if (!org) return null;
    const sample = isDemo && !new URLSearchParams(location.search).has("empty");
    // The demo's sample figures are a US charity's, in dollars; real data uses the charity's own currency.
    const currency = sample ? "USD" : org.currency || "USD";
    const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 });
    const compact = new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 });
    return {
        // The demo shows the prototype's US sample charity (hope-foundation in the SQL samples) on every screen; its id stays the demo org's.
        org: sample ? { id: org.id, ...SAMPLE_ORG } : { id: org.id, slug: org.slug, name: org.name, ein: org.registration_number, currency },
        role: r.role, roles, mode: isDemo ? "demo" : MODE, sample, money: (n) => fmt.format(n), short: (n) => (n < 10000 ? fmt.format(n) : compact.format(n)),
    };
};
