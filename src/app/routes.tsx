import { type ComponentType, type ReactNode, lazy } from "react";
import type { View } from "@/shared/lib/route";

/** Each feature is its own chunk, fetched the first time one of its screens opens. */
const screen = <K extends string>(load: () => Promise<Record<K, ComponentType<any>>>, name: K) => lazy(() => load().then((m) => ({ default: m[name] })));

const LandingB = screen(() => import("@/features/marketing"), "LandingB");
const Pricing = screen(() => import("@/features/marketing"), "Pricing");
const Info = screen(() => import("@/features/marketing"), "Info");
const Start = screen(() => import("@/features/onboarding"), "Start");
const Login = screen(() => import("@/features/auth"), "Login");
const Dashboard = screen(() => import("@/features/dashboard"), "Dashboard");
const Leaderboard = screen(() => import("@/features/leaderboard"), "Leaderboard");
const Live = screen(() => import("@/features/live"), "Live");
const Overlay = screen(() => import("@/features/live"), "Overlay");
const Embed = screen(() => import("@/features/live"), "Embed");
const Give = screen(() => import("@/features/donate"), "Give");
const Thanks = screen(() => import("@/features/donate"), "Thanks");
const CreateFlow = screen(() => import("@/features/create"), "CreateFlow");
const Admin = screen(() => import("@/features/admin"), "Admin");
const PageScreen = screen(() => import("@/features/campaign"), "PageScreen");
const NotFound = screen(() => import("@/shared/ui"), "NotFound");
/** Design-system gallery; only built into dev. */
const Gallery = import.meta.env.DEV ? screen(() => import("@/shared/ui/gallery"), "Gallery") : NotFound;
const Variants = import.meta.env.DEV ? screen(() => import("@/shared/ui/variants"), "Variants") : NotFound;
const SamplePage = screen(() => import("@/features/campaign"), "SamplePage");

/** The screen for a view. The landing page is handled before this, so it renders without waiting for any chunk. */
export const screenFor = (view: View): ReactNode => {
    switch (view.name) {
        case "landing-b": return <LandingB />;
        case "layouts": return <SamplePage />;
        case "ui": return <Gallery />;
        case "ui-variants": return <Variants />;
        case "pricing": return <Pricing />;
        case "start": return <Start />;
        case "login": return <Login />;
        case "dashboard": return <Dashboard />;
        case "about": case "rules": case "faq": case "terms": case "privacy": return <Info kind={view.name} />;
        case "board": return <Leaderboard />;
        case "live": return <Live pageRef={view.page} layout={view.layout} theme={view.theme} />;
        case "overlay": return <Overlay pageRef={view.page} style={view.style} />;
        case "give": return <Give pageRef={view.page} />;
        case "create": return <CreateFlow parent={view.parent} />;
        case "admin": return <Admin tab={view.tab} />;
        case "thanks": return <Thanks gref={view.ref} />;
        case "page": return <PageScreen key={`${view.page.type}/${view.page.slug}`} pageRef={view.page} manage={view.sub === "manage"} donate={view.sub === "donate" ? view.amount ?? true : undefined} />;
        case "embed": return <Embed pageRef={view.page} theme={view.theme} limit={view.limit} />;
        default: return <NotFound />;
    }
};
