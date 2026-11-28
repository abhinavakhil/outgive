import { type ComponentType, type ReactNode, lazy } from "react";
import type { View } from "@/shared/lib/route";

/** Each feature is its own chunk, fetched the first time one of its screens opens. */
const screen = <K extends string>(load: () => Promise<Record<K, ComponentType<any>>>, name: K) => lazy(() => load().then((m) => ({ default: m[name] })));

const LandingB = screen(() => import("@/features/marketing"), "LandingB");
const LandingV2 = screen(() => import("@/features/launch"), "LandingV2");
const CharityBio = screen(() => import("@/features/launch"), "CharityBio");
const BioEditor = screen(() => import("@/features/launch"), "BioEditor");
const RamadanGive = screen(() => import("@/features/launch"), "RamadanGive");
const RamadanSignIn = screen(() => import("@/features/launch"), "RamadanSignIn");
const RamadanAccount = screen(() => import("@/features/launch"), "RamadanAccount");
const RamadanTeam = screen(() => import("@/features/launch"), "RamadanTeam");
const Pricing = screen(() => import("@/features/marketing"), "Pricing");
const Info = screen(() => import("@/features/marketing"), "Info");
const Blog = screen(() => import("@/features/blog"), "Blog");
const Start = screen(() => import("@/features/onboarding"), "Start");
const Login = screen(() => import("@/features/auth"), "Login");
const Dashboard = screen(() => import("@/features/dashboard"), "Dashboard");
const Receipt = screen(() => import("@/features/dashboard"), "Receipt");
const Leaderboard = screen(() => import("@/features/leaderboard"), "Leaderboard");
const Live = screen(() => import("@/features/live"), "Live");
const Overlay = screen(() => import("@/features/live"), "Overlay");
const Embed = screen(() => import("@/features/live"), "Embed");
const HostConsole = screen(() => import("@/features/live/components/HostConsole"), "HostConsole");
const PledgePay = screen(() => import("@/features/pledge-pay"), "PledgePay");
const ImpactReport = screen(() => import("@/features/impact-report"), "ImpactReport");
const Unsubscribe = screen(() => import("@/features/impact-report"), "Unsubscribe");
const Give = screen(() => import("@/features/donate"), "Give");
const Thanks = screen(() => import("@/features/donate"), "Thanks");
const CreateFlow = screen(() => import("@/features/create"), "CreateFlow");
const Admin = screen(() => import("@/features/admin"), "Admin");
const PageScreen = screen(() => import("@/features/campaign"), "PageScreen");
const CheckoutScreen = screen(() => import("@/features/checkout"), "CheckoutScreen");
const OrgCheckout = screen(() => import("@/features/checkout"), "OrgCheckout");
const Engage = screen(() => import("@/features/engage"), "Engage");
const ZakatPage = screen(() => import("@/features/zakat"), "ZakatPage");
const ZakatEmbed = screen(() => import("@/features/zakat"), "ZakatEmbed");
const NotFound = screen(() => import("@/shared/ui"), "NotFound");
/** Design-system gallery; only built into dev. */
const Gallery = import.meta.env.DEV ? screen(() => import("@/shared/ui/gallery"), "Gallery") : NotFound;
const Variants = import.meta.env.DEV ? screen(() => import("@/shared/ui/variants"), "Variants") : NotFound;
const SamplePage = screen(() => import("@/features/campaign"), "SamplePage");

/** The screen for a view. The landing page is handled before this, so it renders without waiting for any chunk. */
export const screenFor = (view: View): ReactNode => {
    switch (view.name) {
        case "checkout": return view.org ? <OrgCheckout /> : <CheckoutScreen />;
        case "landing-b": return <LandingB />;
        case "v2": return <LandingV2 />;
        case "ramadhan": return <CharityBio />;
        case "ramadhan-edit": return <BioEditor />;
        case "ramadhan-give": return <RamadanGive />;
        case "ramadhan-login": return <RamadanSignIn />;
        case "ramadhan-account": return <RamadanAccount />;
        case "ramadhan-team": return <RamadanTeam />;
        case "ramadan": return null;
        case "layouts": return <SamplePage />;
        case "ui": return <Gallery />;
        case "ui-variants": return <Variants />;
        case "pricing": return <Pricing />;
        case "blog": return <Blog />;
        case "post": return <Blog slug={view.slug} />;
        case "engage": return <Engage section={view.section} />;
        case "zakat-calculator": return <ZakatPage />;
        case "zakat-embed": return <ZakatEmbed />;
        case "start": return <Start />;
        case "login": return <Login />;
        case "dashboard": return view.gift ? <Receipt gift={view.gift} /> : <Dashboard tab={view.tab} />;
        case "about": case "rules": case "faq": case "terms": case "privacy": return <Info kind={view.name} />;
        case "board": return <Leaderboard skin={view.skin ?? (view.org === "clearwell" ? "v2" : undefined)} />;
        case "live": return <Live pageRef={view.page} layout={view.layout} theme={view.theme} />;
        case "overlay": return <Overlay pageRef={view.page} style={view.style} />;
        case "give": return <Give pageRef={view.page} />;
        case "create": return <CreateFlow parent={view.parent} />;
        case "admin": return <Admin tab={view.tab} />;
        case "thanks": return <Thanks gref={view.ref} />;
        case "page": return <PageScreen key={`${view.page.type}/${view.page.slug}`} real={view.real} pageRef={view.page} manage={view.sub === "manage"} donate={view.sub === "donate" ? view.amount ?? true : undefined} />;
        case "pledge": return <PledgePay token={view.token} />;
        case "impact-report": return <ImpactReport token={view.token} />;
        case "unsubscribe": return <Unsubscribe token={view.token} />;
        case "host": return <HostConsole />;
        case "embed": return <Embed pageRef={view.page} theme={view.theme} limit={view.limit} />;
        default: return <NotFound />;
    }
};
