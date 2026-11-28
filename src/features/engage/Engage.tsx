/**
 * /engage: Outgive Engage + Checkout, the charity's back office. Signed-in team members only (viewer or higher at a charity);
 * the database checks the same thing on every figure (org_insights refuses anyone else). In the demo you are the sample charity's owner.
 */
import { type ReactNode, Suspense, useEffect } from "react";
import { useApp } from "@/shared/lib/app-context";
import { SignInPanel, useRoles } from "@/features/launch";
import type { EngageSection } from "@/shared/lib/route";
import { Shell } from "./shell/Shell";
import { type Section, sectionOf } from "./shell/sections";
import { WorkspaceContext, useLoadWorkspace } from "./shell/workspace";
import type { OrgRole } from "@/features/launch";
import { Onboard, Welcome } from "./onboard/Onboard";
import "./engage.css";

/** Centred message on the wash, for sign-in and loading. */
const Plain = ({ children }: { children: ReactNode }) => <div className="eg eg-plain"><div className="eg-panel eg-panel-sm">{children}</div></div>;

const Placeholder = ({ s }: { s: Section }) => (
    <div className="eg-next">
        <span className="eg-next-ic" aria-hidden="true">{s.icon}</span>
        <p className="eg-label">Coming next</p>
        <h1>{s.label}</h1>
        <p>{s.plan}</p>
        <a className="eg-btn white" href="/engage">Back to the overview</a>
    </div>
);

const Office = ({ roles, section }: { roles: OrgRole[]; section: Section }) => {
    const ws = useLoadWorkspace(roles);
    useEffect(() => { document.title = `${section.label} · ${ws?.org.name ?? "Outgive"}`; }, [section.label, ws?.org.name]);
    if (!ws) return <Plain><p className="eg-muted" aria-busy="true">Loading your charity…</p></Plain>;
    const Screen = section.screen;
    return (
        <WorkspaceContext.Provider value={ws}>
            <Shell section={section}>
                {!section.id && <Welcome org={ws.org.slug} us={ws.org.currency !== "GBP"} />}
                <Suspense fallback={<div className="eg-skeleton tall" aria-busy="true" />}>{Screen ? <Screen /> : <Placeholder s={section} />}</Suspense>
            </Shell>
        </WorkspaceContext.Provider>
    );
};

export const Engage = ({ section }: { section?: EngageSection }) => {
    const { user, isDemo } = useApp();
    const roles = useRoles();
    const s = sectionOf(section);
    const next = `/engage${section ? `/${section}` : ""}`;
    if (!user && !isDemo) return <Plain><div className="gb"><SignInPanel next={next} title="Sign in to your charity" sub="Engage and Checkout are your charity’s back office. Sign in to join your team, or to set up a new charity." /></div></Plain>;
    if (roles === null) return <Plain><p className="eg-muted" aria-busy="true">Loading…</p></Plain>;
    // No charity yet: set one up here (?onboard previews this in the demo, which always has one).
    if (!roles.length || (isDemo && new URLSearchParams(location.search).has("onboard"))) return <Onboard />;
    return <Office roles={roles} section={s} />;
};
