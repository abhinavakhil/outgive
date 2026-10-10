import { Button } from "@/components/base/buttons/button";
import { Container, SiteHeader, useApp } from "@/components/outgive/shared";

export const NotFound = () => {
    const { go } = useApp();
    return (
        <div className="min-h-dvh bg-primary"><Container className="flex max-w-3xl flex-col gap-10 py-5">
            <SiteHeader />
            <div className="flex flex-col items-start gap-3 pt-10">
                <span className="text-sm font-semibold text-brand-secondary">404</span>
                <h1 className="text-display-sm font-semibold tracking-tight text-primary">We can't find that page</h1>
                <p className="max-w-md text-md text-tertiary">The link may be wrong, or the page was made in another browser. Pages in this demo are saved only in the browser that published them.</p>
                <div className="flex gap-3 pt-2"><Button color="primary" size="md" className="rounded-full" onPress={() => go({ name: "home" })}>Back to the leaderboard</Button><Button color="secondary" size="md" className="rounded-full" onPress={() => go({ name: "create" })}>Start fundraising</Button></div>
            </div>
        </Container></div>
    );
};
