/**
 * Who the signed-in person is to each charity. The database decides every permission (has_role in
 * supabase/migrations/20261127010000); this only tells the UI what to show. In the demo you are the sample charity's owner.
 */
import { useEffect, useState } from "react";
import { useApp } from "@/shared/lib/app-context";

export type Role = "owner" | "admin" | "editor" | "viewer";
export type OrgRole = { org_id: string; slug: string; name: string; role: Role };

const RANK: Record<Role, number> = { owner: 4, admin: 3, editor: 2, viewer: 1 };
/** `role` is `min` or higher. */
export const atLeast = (role: Role | null | undefined, min: Role) => !!role && RANK[role] >= RANK[min];

export const ROLE_INFO: Record<Role, [string, string]> = {
    owner: ["Owner", "Everything, including other owners"],
    admin: ["Admin", "Team, payments, refunds and donors"],
    editor: ["Editor", "Edit pages, see donors"],
    viewer: ["Viewer", "See the organiser view only"],
};

/** The signed-in user's roles; null until known. */
export const useRoles = () => {
    const { db, user, isDemo } = useApp();
    const [roles, setRoles] = useState<OrgRole[] | null>(null);
    useEffect(() => {
        if (isDemo) { setRoles([{ org_id: "demo", slug: "clearwell", name: "Clearwell Trust", role: "owner" }]); return; }
        if (!user) { setRoles([]); return; }
        let off = false;
        db.rpc<OrgRole[]>("my_roles").then((r) => !off && setRoles(r ?? []), () => !off && setRoles([]));
        return () => { off = true; };
    }, [db, user, isDemo]);
    return roles;
};

/** The user's role at one charity, or null. */
export const useRoleAt = (slug: string) => useRoles()?.find((r) => r.slug === slug)?.role ?? null;
