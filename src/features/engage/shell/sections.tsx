/**
 * The back office's navigation: Overview, then the Checkout tools, then the Engage tools. Each section is /engage/<id>.
 * Adding a screen is one line: give its entry below a `screen`, e.g.
 *     screen: lazy(() => import("../revenue/Revenue").then((m) => ({ default: m.Revenue }))),
 * Without one the section shows a "Coming next" placeholder with its `plan` line. The shell draws the frame either way.
 */
import { type ComponentType, type ReactNode, lazy } from "react";
import { Calculator, CreditCard, ChartLineUp, Code, FileText, HandCoins, Megaphone, PaperPlaneTilt, Receipt, SquaresFour, Storefront, TreeStructure, UsersThree } from "@phosphor-icons/react";
import type { EngageSection } from "@/shared/lib/route";
import { Overview } from "../overview/Overview";

export type Section = { id: EngageSection | undefined; label: string; icon: ReactNode; plan?: string; screen?: ComponentType };
const ic = (I: typeof SquaresFour) => <I size={20} weight="regular" aria-hidden="true" />;

export const OVERVIEW: Section = { id: undefined, label: "Overview", icon: ic(SquaresFour), screen: Overview };
export const GROUPS: { label: string; tone: string; items: Section[] }[] = [
    { label: "Checkout", tone: "lilac", items: [
        { id: "checkout", label: "Checkout builder", icon: ic(Storefront), plan: "Six layouts and up to three add-ons, previewed as the real donate flow in test mode.", screen: lazy(() => import("../checkout/CheckoutBuilder").then((m) => ({ default: m.CheckoutBuilder }))) },
        { id: "zakat", label: "Zakat calculator", icon: ic(Calculator), plan: "An embeddable calculator that works out Zakat due and fills the gift amount." },
        { id: "receipts", label: "Receipts and safety", icon: ic(Receipt), plan: "Tax receipts with the Zakat amount on its own line, an EIN check and fraud controls.", screen: lazy(() => import("../compliance/Compliance").then((m) => ({ default: m.Compliance }))) },
        { id: "api", label: "Headless API", icon: ic(Code), plan: "Take a gift anywhere: an embed, a REST API and signed webhooks.", screen: lazy(() => import("../developers/Developers").then((m) => ({ default: m.Developers }))) },
    ] },
    { label: "Engage", tone: "sage", items: [
        { id: "campaigns", label: "Campaigns", icon: ic(Megaphone), plan: "Every appeal of the year from a template, and text-to-give keywords.", screen: lazy(() => import("../campaigns/Campaigns").then((m) => ({ default: m.Campaigns }))) },
        { id: "pledges", label: "Pledge recovery", icon: ic(HandCoins), plan: "Every open pledge with a one-tap pay link, and a reminder sequence that collects it.", screen: lazy(() => import("../pledges/Pledges").then((m) => ({ default: m.Pledges }))) },
        { id: "revenue", label: "Revenue tracking", icon: ic(ChartLineUp), plan: "What raised the money: by source, night, fund and campaign.", screen: lazy(() => import("../revenue/Revenue").then((m) => ({ default: m.Revenue }))) },
        { id: "journey", label: "After-Eid journey", icon: ic(PaperPlaneTilt), plan: "The emails and texts from Eid day to next Ramadan that bring donors back.", screen: lazy(() => import("../journeys/Journey").then((m) => ({ default: m.Journey }))) },
        { id: "impact", label: "Impact reports", icon: ic(FileText), plan: "A personal report for each donor: what their gifts did, in meals, packs and people.", screen: lazy(() => import("../impact/Impact").then((m) => ({ default: m.Impact }))) },
    ] },
    { label: "Account", tone: "lilac", items: [
        { id: "team", label: "Team", icon: ic(UsersThree), screen: lazy(() => import("../account/Team").then((m) => ({ default: m.Team }))) },
        { id: "chapters", label: "Chapters", icon: ic(TreeStructure), screen: lazy(() => import("../account/Chapters").then((m) => ({ default: m.Chapters }))) },
        { id: "billing", label: "Billing", icon: ic(CreditCard), screen: lazy(() => import("../account/Billing").then((m) => ({ default: m.Billing }))) },
    ] },
];
export const SECTIONS = [OVERVIEW, ...GROUPS.flatMap((g) => g.items)];
export const sectionOf = (id: EngageSection | undefined) => SECTIONS.find((s) => s.id === id) ?? OVERVIEW;
export const hrefOf = (id: EngageSection | undefined) => `/engage${id ? `/${id}` : ""}`;
