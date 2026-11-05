import { useEffect, useState } from "react";
import { Mail01 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Google } from "@/components/foundations/social-icons";
import { Container, SiteHeader, useApp } from "@/components/outgive/shared";

/** Magic link or Google. Works inline (on the create flow, the dashboard) and as its own screen. */
export const SignIn = ({ next, title = "Sign in", sub = "A link by email, or your Google account. No password." }: { next?: string; title?: string; sub?: string }) => {
    const { db, isDemo, go } = useApp();
    const [email, setEmail] = useState("");
    const [sent, setSent] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const redirect = `${window.location.origin}${next ?? window.location.pathname}`;
    const magic = async () => {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Enter your email address.");
        setBusy(true); setError("");
        try { await db.signInEmail(email.trim(), redirect); setSent(true); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    };
    if (isDemo) return <div className="flex flex-col gap-3 rounded-2xl bg-brand-primary p-5"><h2 className="text-lg font-semibold text-primary">{title}</h2><p className="text-sm text-tertiary">This is the demo, so you are already signed in as the sample charity's organiser. On the live platform you sign in with a magic link or Google.</p><Button color="primary" className="w-fit rounded-full" onPress={() => go({ name: "home" })}>Continue</Button></div>;
    if (sent) return <div className="flex flex-col gap-2 rounded-2xl bg-brand-primary p-5"><h2 className="text-lg font-semibold text-primary">Check your email</h2><p className="text-sm text-tertiary">We sent a sign-in link to <b className="text-primary">{email}</b>. Open it on this device to continue.</p></div>;
    return (
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); magic(); }}>
            <div><h2 className="text-lg font-semibold text-primary">{title}</h2><p className="text-sm text-tertiary">{sub}</p></div>
            <Input label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} isInvalid={!!error} hint={error || undefined} />
            <Button type="submit" color="primary" size="lg" className="rounded-full" iconLeading={Mail01} isDisabled={busy}>{busy ? "Sending…" : "Email me a link"}</Button>
            <div className="flex items-center gap-3 text-xs text-tertiary"><span className="h-px flex-1 bg-secondary" />or<span className="h-px flex-1 bg-secondary" /></div>
            <Button color="secondary" size="lg" className="rounded-full" onPress={() => db.signInGoogle(redirect).catch((e) => setError((e as Error).message))}><Google size={18} />Continue with Google</Button>
        </form>
    );
};

export const Login = () => {
    const { user, go } = useApp();
    const next = new URLSearchParams(window.location.search).get("next") ?? "/dashboard";
    useEffect(() => { if (user) go({ name: "dashboard" }); }, [user, go]);
    return (
        <div className="min-h-dvh bg-primary"><Container className="flex max-w-md flex-col gap-10 py-5"><SiteHeader /><div className="rounded-3xl p-6 ring-1 ring-secondary ring-inset"><SignIn next={next} /></div></Container></div>
    );
};
