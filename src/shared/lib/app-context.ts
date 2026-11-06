import { createContext, useContext } from "react";
import { type Activity, type Brand, CURRENCIES, type Supporter } from "@/shared/domain/model";
import type { Org, User } from "@/shared/domain/types";
import type { DB } from "@/shared/lib/db";
import type { PageRef, Tenant, View } from "@/shared/lib/route";
export type { View } from "@/shared/lib/route";

/** Navigation targets. Short forms leave out the organisation: it is the one on screen (or the demo). */
export type Go = View | { name: "home" } | { name: "create"; parent?: string } | { name: "page"; key: string } | { name: "admin"; tab?: string } | { name: "live" } | { name: "overlay" } | { name: "give"; page?: PageRef } | { name: "thanks"; ref?: string };
export interface AppCtx {
    db: DB; user: User | null; tenant: Tenant; org: Org | null; member: boolean; isDemo: boolean;
    currency: string; setCurrency: (c: string) => void; money: (usd: number) => string;
    go: (v: Go) => void; href: (v: Go) => string;
    board: Supporter[]; activity: Activity[]; hall: [string, string, number][]; refresh: () => void;
    brand: Brand; setBrand: (b: Brand) => void; setOrg: (o: Org) => void;
    /** The board row this browser claimed, if any. */
    me: string | null; setMe: (id: string | null) => void;
    toast: (m: string) => void;
}
export const AppContext = createContext<AppCtx>(null!);
export const useApp = () => useContext(AppContext);
export const makeMoney = (currency: string) => (usd: number) =>
    new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(Math.round(usd * CURRENCIES[currency]));
