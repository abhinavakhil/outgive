import { useCallback, useEffect, useState } from "react";
import { CampaignPage } from "@/views/CampaignPage";
import { PageManage } from "@/views/PageManage";
import { NotFound } from "@/views/NotFound";
import { useApp } from "@/components/outgive/shared";
import { CURRENCIES, type Donation, type PageData, type PageUpdate, SAMPLE_PAGE, pageKey } from "@/data";
import type { PageRef } from "@/lib/route";
import { type PageBundle, type UpdateRow, toPageData } from "@/lib/types";

const usdRate = (c: string) => CURRENCIES[c] ?? 1;

/** Loads a published page and keeps it fresh as gifts land. */
export const usePage = (ref: PageRef) => {
    const { db, org } = useApp();
    const [bundle, setBundle] = useState<PageBundle | null | undefined>(undefined);
    const load = useCallback(() => { if (!org) return; db.rpc<PageBundle | null>("page_get", { org: org.id, t: ref.type, s: ref.slug }).then(setBundle).catch(() => setBundle(null)); }, [db, org, ref.type, ref.slug]);
    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        if (!org || !bundle) return;
        let t: ReturnType<typeof setTimeout>;
        return db.onDonations(org.id, (d) => { if (d.page_id === bundle.page.id || bundle.children.some((c) => c.id === d.page_id)) { clearTimeout(t); t = setTimeout(load, 300); } });
    }, [db, org, bundle?.page.id, load]); // eslint-disable-line react-hooks/exhaustive-deps
    return { bundle, setBundle, reload: load };
};

export const PageScreen = ({ pageRef, manage }: { pageRef: PageRef; manage: boolean }) => {
    const { db, org } = useApp();
    const { bundle, setBundle, reload } = usePage(pageRef);
    useEffect(() => { if (bundle?.page.id) db.rpc("visit", { page: bundle.page.id }).catch(() => {}); }, [db, bundle?.page.id]);
    if (!org) return null;
    if (bundle === undefined) return <div className="flex min-h-dvh items-center justify-center bg-primary text-sm text-tertiary">Loading…</div>;
    if (bundle === null) return <NotFound />;
    if (manage) return <PageManage bundle={bundle} reload={reload} />;
    const page = toPageData(bundle, usdRate);
    const addUpdate = async (u: PageUpdate) => { const row = await db.rpc<UpdateRow>("update_post", { page: bundle.page.id, t: u.title, b: u.body }); setBundle({ ...bundle, updates: [row, ...bundle.updates] }); };
    const setPage = async (p: PageData) => { if (p.layout !== page.layout) { await db.rpc("page_update", { page: bundle.page.id, p: { layout: p.layout } }); reload(); } };
    return <CampaignPage pageKey={pageKey(page)} page={page} row={bundle.page} org={org} tickets={bundle.tickets} childPages={bundle.children} parent={bundle.parent} canEdit={bundle.can_edit} setPage={setPage} addUpdate={bundle.can_edit ? addUpdate : undefined} />;
};

/** The layouts showcase at /layouts: the sample page, kept in memory, with a layout switcher. */
export const SamplePage = () => {
    const { org } = useApp();
    const [sample, setSample] = useState<PageData>(SAMPLE_PAGE);
    const give = (d: Donation) => setSample((p) => ({ ...p, raised: p.raised + d.usd, supporters: p.supporters + 1, donations: [d, ...p.donations] }));
    const addUpdate = async (u: PageUpdate) => setSample((p) => ({ ...p, updates: [u, ...p.updates] }));
    return <CampaignPage pageKey={pageKey(sample)} page={sample} org={org} canEdit={false} setPage={async (p) => setSample(p)} give={give} addUpdate={addUpdate} />;
};
