import { useEffect, useState } from "react";
import { Check, Share07 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { ShareDialog } from "@/components/outgive/dialogs";
import { Container, SiteHeader, useApp } from "@/components/outgive/shared";
import { fmt } from "@/lib/money";
import { PREFIX, type PageType } from "@/data";

interface Lookup { id: string; name: string; amount_cents: number; currency: string; tip_cents: number; status: string; recurring: boolean; claimed_rank: number | null; page: { type: PageType; slug: string; title: string } | null; org: { slug: string; name: string }; supporter: { id: string; name: string } | null }

/** After Checkout (or a demo gift). The webhook may land a moment after the redirect, so a pending gift is polled a few times. */
export const Thanks = () => {
    const { db, org, go, href, setMe, board, isDemo } = useApp();
    const q = new URLSearchParams(window.location.search);
    const [d, setD] = useState<Lookup | null | undefined>(undefined);
    const [share, setShare] = useState(false);
    useEffect(() => {
        let tries = 0; let stop = false;
        const look = async () => {
            const r = await db.rpc<Lookup | null>("thanks_lookup", { session: q.get("session_id"), gift: q.get("donation") }).catch(() => null);
            if (stop) return;
            setD(r);
            if (r?.status === "pending" && tries++ < 10) setTimeout(look, 1500);
            if (r?.supporter?.id && r.status === "succeeded") setMe(r.supporter.id);
        };
        look(); return () => { stop = true; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const rank = d?.supporter ? [...board].sort((a, b) => b.total - a.total).findIndex((s) => s.id === d.supporter!.id) + 1 : 0;
    const pageUrl = d?.page ? `${window.location.origin}${href({ name: "page", org: org?.slug ?? d.org.slug, page: d.page })}` : `${window.location.origin}${href({ name: "home" })}`;
    return (
        <div className="min-h-dvh bg-primary"><Container className="flex max-w-xl flex-col gap-8 py-5"><SiteHeader />
            {d === undefined && <p className="text-sm text-tertiary">Confirming your gift…</p>}
            {d === null && <div className="flex flex-col gap-3"><h1 className="text-display-xs font-semibold text-primary">We could not find that gift</h1><p className="text-tertiary">If you paid, you will still get a receipt by email. Otherwise go back to the page and try again.</p><Button color="secondary" className="w-fit rounded-full" onPress={() => go({ name: "home" })}>Back to the board</Button></div>}
            {d && <div className="flex flex-col items-center gap-4 rounded-3xl bg-brand-primary p-8 text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-brand-solid text-white"><Check className="size-7" /></span>
                <h1 className="text-display-xs font-semibold text-primary md:text-display-sm">{d.status === "succeeded" ? `Thank you${d.name !== "Anonymous" ? `, ${d.name.split(" ")[0]}` : ""}` : d.status === "pending" ? "Almost there" : "This gift did not go through"}</h1>
                <p className="max-w-md text-md text-tertiary">
                    {d.status === "succeeded" && <>Your {d.recurring ? "monthly " : ""}gift of <b className="text-primary">{fmt(d.amount_cents, d.currency)}</b>{d.tip_cents > 0 && <> (plus a {fmt(d.tip_cents, d.currency)} tip to Outgive)</>} to <b className="text-primary">{d.page?.title ?? d.org.name}</b> has been received.{isDemo ? " Demo: nothing was charged." : " A receipt is on its way by email."}</>}
                    {d.status === "pending" && "Your payment is being confirmed. This page updates by itself."}
                    {(d.status === "failed" || d.status === "refunded") && "Nothing was taken. You can try again from the page."}
                </p>
                {d.status === "succeeded" && d.supporter && rank > 0 && <p className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary">{d.supporter.name} is now <span className="text-brand-secondary">#{rank}</span> on the {org?.name ?? d.org.name} board</p>}
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                    <Button color="primary" className="rounded-full" iconLeading={Share07} onPress={() => setShare(true)}>Share</Button>
                    {d.page && <Button color="secondary" className="rounded-full" onPress={() => go({ name: "page", org: org?.slug ?? d.org.slug, page: d.page! })}>Back to {d.page.title}</Button>}
                    <Button color="secondary" className="rounded-full" onPress={() => go({ name: "home" })}>See the board</Button>
                </div>
            </div>}
            <ShareDialog isOpen={share} onClose={() => setShare(false)} url={pageUrl} title={d?.page?.title ?? org?.name ?? "Outgive"} />
        </Container></div>
    );
};
export const pagePath = (p: { type: PageType; slug: string }) => `/${PREFIX[p.type]}/${p.slug}`;
