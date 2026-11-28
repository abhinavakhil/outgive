/**
 * The opt-out page every journey message links to, /unsubscribe/<token>. Public, no sign-in. One button, so a mail scanner that opens
 * links does not unsubscribe anyone by itself. The opt-out is per charity and per channel (contact_suppressions).
 */
import { useEffect, useState } from "react";
import { unsubscribe, unsubscribeInfo } from "@/features/engage";
import { useApp } from "@/shared/lib/app-context";
import { Shell } from "./ImpactReport";
import "./impact-report.css";

type Info = { org_name: string; channel: "email" | "sms"; unsubscribed: boolean };
const SAMPLE: Info = { org_name: "Hope Foundation", channel: "email", unsubscribed: false };

export const Unsubscribe = ({ token }: { token: string }) => {
    const { db, isDemo } = useApp();
    const [i, setI] = useState<Info | null | undefined>(undefined);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (isDemo) { setI(SAMPLE); return; }
        unsubscribeInfo(db, token).then((x) => setI(x ?? null), () => setI(import.meta.env.DEV ? SAMPLE : null));
    }, [db, isDemo, token]);

    const go = async () => {
        setBusy(true); setError("");
        try { setI(isDemo ? { ...SAMPLE, unsubscribed: true } : (await unsubscribe(db, token)) ?? null); }
        catch { setError("That did not go through. Please try again."); }
        finally { setBusy(false); }
    };

    if (i === undefined) return <div className="ir" aria-busy="true" />;
    if (i === null) return (
        <Shell org="Unsubscribe"><section className="ir-card ir-note"><h1 className="ir-h ir-mid">This link is incomplete</h1><p className="ir-sub">Reply to the email you received and ask the charity to stop writing to you. They have to honour it.</p></section></Shell>
    );
    const what = i.channel === "email" ? "emails" : "text messages";
    return (
        <Shell org={i.org_name}>
            <section className="ir-card ir-note" aria-live="polite">
                {i.unsubscribed ? <>
                    <h1 className="ir-h ir-mid">You are unsubscribed</h1>
                    <p className="ir-sub">{i.org_name} will not send you any more of these {what}. Receipts for gifts you make still reach you.</p>
                </> : <>
                    <h1 className="ir-h ir-mid">Stop {what} from {i.org_name}?</h1>
                    <p className="ir-sub">You will stop getting their thank-you notes, updates and appeals by {i.channel === "email" ? "email" : "text"}. Receipts for gifts you make still reach you.</p>
                    <div className="ir-actions"><button type="button" className="ir-btn ink" onClick={go} disabled={busy}>{busy ? "Unsubscribing" : "Unsubscribe"}</button></div>
                    {error && <p className="ir-err" role="alert">{error}</p>}
                </>}
            </section>
        </Shell>
    );
};
