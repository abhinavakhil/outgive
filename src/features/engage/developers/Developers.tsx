/**
 * Headless API (/engage/api): take a gift anywhere. The embed snippet, the REST API and the webhook payload as copyable code; API keys
 * (shown once, revocable); webhook endpoints with their delivery log, replay and test events; and the integrations built on them.
 * Admins only for keys and webhooks (the database enforces it); everyone on the team sees the code and integrations.
 * The API is supabase/functions/api, webhooks go out through supabase/functions/webhook-deliver. Data: ./data.
 */
import { type FormEvent, useId, useState } from "react";
import { ArrowClockwise, BracketsCurly, Code, Copy, Key, PaperPlaneTilt, Plus, Trash, WebhooksLogo } from "@phosphor-icons/react";
import { useApp } from "@/shared/lib/app-context";
import { Card, Empty, StatStrip, Tabs, Tag, type Tone } from "../ui/primitives";
import { useWorkspace } from "../shell/workspace";
import { type Store, useDevelopers } from "./data";
import { API_BASE, type ApiKey, EVENTS, type KeyKind, ago, deliveryLabel, embedCode, payloadCode, restCode, shortUrl, validUrl } from "./model";
import "./developers.css";

type CodeTab = "embed" | "rest" | "payload";
const ic = { size: 18, "aria-hidden": true } as const;

export const Developers = () => {
    const ws = useWorkspace(), { toast } = useApp();
    const store = useDevelopers();
    const [busy, setBusy] = useState(false);
    const act = async <T,>(f: () => Promise<T>, done?: string) => {
        setBusy(true);
        try { const r = await f(); if (done) toast(done); return r; } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
    };
    const copy = (text: string, what: string) => navigator.clipboard.writeText(text).then(() => toast(`${what} copied`), () => toast("Could not copy; select the text instead"));

    if (store.state === "loading") return <div className="eg-skeleton tall" aria-busy="true"><span className="eg-sr">Loading the Headless API</span></div>;
    const { d } = store, ready = store.state === "ready";
    const live = d.keys.filter((k) => !k.revoked_at), used = live.map((k) => k.last_used_at).filter(Boolean).sort().pop() ?? null;
    const ok = d.deliveries.filter((x) => x.status === "succeeded").length;
    const props = { store, busy, act, copy };

    return (
        <div className="eg-dv">
            <header className="eg-dv-head">
                <div>
                    <h1>Headless API</h1>
                    <p className="eg-muted">Take a gift anywhere: drop the hosted checkout into any page, or call the API from your own app. Every gift lands tagged, receipted and in one total.</p>
                </div>
                <p className="eg-dv-mode">{ws.mode === "live" ? <Tag tone="forest">Live keys</Tag> : <Tag tone="peach">Test mode: no real money</Tag>}</p>
            </header>

            {ready && <Card className="eg-card-strip eg-dv-kpis"><h2 className="eg-sr">Key numbers</h2><StatStrip items={[
                { label: "Active keys", value: live.length, note: `${live.filter((k) => k.kind === "secret").length} secret, ${live.filter((k) => k.kind === "publishable").length} publishable` },
                { label: "Last API call", value: ago(used), note: "Any key" },
                { label: "Webhook endpoints", value: d.endpoints.filter((e) => e.active).length, note: `${d.endpoints.filter((e) => e.source === "zapier").length} from Zapier` },
                { label: "Delivered", value: d.deliveries.length ? `${ok} of ${d.deliveries.length}` : "None yet", note: "Last 50 events" },
            ]} /></Card>}

            <div className="eg-dv-grid">
                <CodeCard slug={ws.org.slug} copy={copy} />
                {ready ? <Keys {...props} /> : <Card title="API keys"><Empty>{store.state === "forbidden" ? "Only the charity's admins can see and make API keys." : `This could not be loaded: ${store.error}`}</Empty></Card>}
            </div>
            {ready ? <Webhooks {...props} /> : <Card title="Webhooks"><Empty>{store.state === "forbidden" ? "Only admins can manage webhooks." : "Webhooks could not be loaded."}</Empty></Card>}
            <Integrations store={store} ready={ready} />
            {ws.sample && <p className="eg-muted eg-dv-foot">Sample keys, endpoint and deliveries. In the demo, keys work only on this page and nothing is sent.</p>}
        </div>
    );
};

type Props = { store: Store; busy: boolean; act: <T>(f: () => Promise<T>, done?: string) => Promise<T | undefined>; copy: (text: string, what: string) => void };

// ---------------------------------------------------------------- code
const CodeCard = ({ slug, copy }: { slug: string; copy: Props["copy"] }) => {
    const [tab, setTab] = useState<CodeTab>("embed");
    const code = tab === "embed" ? embedCode(slug) : tab === "rest" ? restCode() : payloadCode;
    return (
        <Card title="Take a gift anywhere" className="eg-dv-code" action={<button type="button" className="eg-btn white sm" onClick={() => copy(code, "Code")}><Copy {...ic} />Copy</button>}>
            <Tabs id="eg-dv" label="Code sample" value={tab} onChange={setTab} items={[
                { id: "embed", label: "Embed", icon: <Code {...ic} /> },
                { id: "rest", label: "REST", icon: <BracketsCurly {...ic} /> },
                { id: "payload", label: "Webhook payload", icon: <WebhooksLogo {...ic} /> },
            ]} />
            <div id="eg-dv-panel" role="tabpanel" aria-labelledby={`eg-dv-tab-${tab}`}>
                <pre className="eg-dv-pre" tabIndex={0} aria-label="Code"><code>{code}</code></pre>
                <p className="eg-dv-note">
                    {tab === "embed" ? "Paste it where the gift form should appear. Anything you leave out follows your checkout builder; card details stay on Outgive."
                    : tab === "rest" ? <>Base URL <code>{API_BASE}</code>. Full reference: <a href={`${API_BASE}/openapi.json`} target="_blank" rel="noreferrer">OpenAPI spec</a>. Keep secret keys on your server.</>
                    : "Answer any 2xx within 10 seconds. Anything else is retried after 1 min, 5 min, 30 min, 2 h, 6 h, 12 h and 24 h. A replay keeps the event id, so you can skip duplicates."}
                </p>
            </div>
        </Card>
    );
};

// ---------------------------------------------------------------- keys
const Keys = ({ store, busy, act, copy }: Props) => {
    const [fresh, setFresh] = useState<{ key: string; kind: KeyKind } | null>(null);
    const make = async (kind: KeyKind) => {
        const key = await act(() => store.createKey(kind, kind === "secret" ? "Server" : "Website"));
        if (key) setFresh({ key, kind });
    };
    const revoke = (k: ApiKey) => { if (confirm(`Revoke ${k.hint}? Anything using it stops working at once.`)) void act(() => store.revokeKey(k.id), "Key revoked"); };
    return (
        <Card title="API keys" className="eg-dv-keys">
            {fresh && (
                <div className="eg-dv-fresh" role="status">
                    <b>{fresh.kind === "secret" ? "Your new secret key. Copy it now: it is shown only once." : "Your new publishable key. It is safe in page code."}</b>
                    <code className="eg-dv-key">{fresh.key}</code>
                    <span className="eg-dv-row">
                        <button type="button" className="eg-btn black sm" onClick={() => copy(fresh.key, "Key")}><Copy {...ic} />Copy key</button>
                        <button type="button" className="eg-btn white sm" onClick={() => setFresh(null)}>I have saved it</button>
                    </span>
                </div>
            )}
            {store.d.keys.length ? (
                <ul className="eg-dv-list">
                    {store.d.keys.map((k) => (
                        <li key={k.id} className={k.revoked_at ? "off" : undefined}>
                            <span className="eg-dv-grow">
                                <b>{k.kind === "secret" ? "Secret" : "Publishable"}{k.name ? `, ${k.name}` : ""}</b>
                                <code>{k.token ?? k.hint}</code>
                                <small>{k.revoked_at ? `Revoked ${ago(k.revoked_at)}` : `Last used ${ago(k.last_used_at).toLowerCase()}`}</small>
                            </span>
                            {k.revoked_at ? <Tag>Revoked</Tag> : (
                                <span className="eg-dv-row">
                                    {k.token && <button type="button" className="eg-btn white sm" onClick={() => copy(k.token!, "Key")} aria-label={`Copy ${k.hint}`}><Copy {...ic} /></button>}
                                    <button type="button" className="eg-btn white sm" disabled={busy} onClick={() => revoke(k)} aria-label={`Revoke ${k.hint}`}>Revoke</button>
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            ) : <Empty>No keys yet. A secret key reads your data and starts gifts from your server; a publishable key goes in page code.</Empty>}
            <span className="eg-dv-row">
                <button type="button" className="eg-btn black sm" disabled={busy} onClick={() => void make("secret")}><Key {...ic} />New secret key</button>
                <button type="button" className="eg-btn white sm" disabled={busy} onClick={() => void make("publishable")}><Plus {...ic} />Publishable key</button>
            </span>
        </Card>
    );
};

// ---------------------------------------------------------------- webhooks
const Webhooks = ({ store, busy, act, copy }: Props) => {
    const id = useId();
    const [url, setUrl] = useState(""), [events, setEvents] = useState<string[]>(["donation.succeeded"]);
    const [shown, setShown] = useState<string | null>(null);
    const { endpoints, deliveries } = store.d;
    const add = async (e: FormEvent) => {
        e.preventDefault();
        if (!validUrl(url)) return void act(async () => { throw new Error("Use a full https:// address"); });
        if (!events.length) return void act(async () => { throw new Error("Choose at least one event"); });
        await act(() => store.addEndpoint(url.trim(), events), "Endpoint added");
        setUrl("");
    };
    return (
        <Card title="Webhooks" className="eg-dv-hooks">
            <p className="eg-muted eg-dv-note">We POST each event to your URL, signed with the endpoint's secret in <code>Outgive-Signature</code>. Zapier subscribes here by itself when a Zap is turned on.</p>
            {endpoints.length ? (
                <ul className="eg-dv-list">
                    {endpoints.map((e) => (
                        <li key={e.id}>
                            <span className="eg-dv-grow">
                                <b className="eg-dv-url">{shortUrl(e.url)}</b>
                                <small>{e.events.includes("*") ? "Every event" : e.events.join(", ")}</small>
                                <small className="eg-dv-secret">Signing secret <code>{shown === e.id ? e.secret : `whsec_${"•".repeat(10)}${e.secret.slice(-4)}`}</code>
                                    <button type="button" className="eg-dv-link" aria-pressed={shown === e.id} onClick={() => setShown(shown === e.id ? null : e.id)}>{shown === e.id ? "Hide" : "Reveal"}</button>
                                    <button type="button" className="eg-dv-link" onClick={() => copy(e.secret, "Signing secret")}>Copy</button>
                                </small>
                            </span>
                            <span className="eg-dv-row">
                                {e.source === "zapier" && <Tag tone="lilac">Zapier</Tag>}
                                <Tag tone={e.active ? "sage" : "grey"}>{e.active ? "Active" : "Off"}</Tag>
                                <button type="button" className="eg-btn white sm" disabled={busy} onClick={() => void act(() => store.test(e.id), "Test event queued")}><PaperPlaneTilt {...ic} />Send test</button>
                                <button type="button" className="eg-btn white sm" disabled={busy} aria-label={`Remove ${shortUrl(e.url)}`} onClick={() => { if (confirm(`Stop sending events to ${shortUrl(e.url)}?`)) void act(() => store.removeEndpoint(e.id), "Endpoint removed"); }}><Trash {...ic} /></button>
                            </span>
                        </li>
                    ))}
                </ul>
            ) : <Empty>No endpoints yet. Add your server's URL below to hear about gifts, pledges and receipts as they happen.</Empty>}

            <form className="eg-dv-form" onSubmit={add} aria-labelledby={`${id}-h`}>
                <h3 id={`${id}-h`}>Add an endpoint</h3>
                <label className="eg-dv-field"><span>URL</span><input type="url" inputMode="url" required placeholder="https://your-site.org/hooks/outgive" value={url} onChange={(e) => setUrl(e.target.value)} /></label>
                <fieldset className="eg-dv-events">
                    <legend>Events</legend>
                    {EVENTS.map((ev) => (
                        <label key={ev.id}>
                            <input type="checkbox" checked={events.includes(ev.id)} onChange={(e) => setEvents(e.target.checked ? [...events, ev.id] : events.filter((x) => x !== ev.id))} />
                            <span><code>{ev.id}</code><small>{ev.note}</small></span>
                        </label>
                    ))}
                </fieldset>
                <button type="submit" className="eg-btn black sm" disabled={busy}><Plus {...ic} />Add endpoint</button>
            </form>

            <h3 className="eg-dv-h3">Delivery log</h3>
            {deliveries.length ? (
                <div className="eg-dv-scroll" tabIndex={0} role="region" aria-label="Delivery log">
                    <table className="eg-dv-table">
                        <thead><tr><th scope="col">Event</th><th scope="col">Endpoint</th><th scope="col">When</th><th scope="col">Result</th><th scope="col"><span className="eg-sr">Actions</span></th></tr></thead>
                        <tbody>{deliveries.map((x) => {
                            const [tone, label] = deliveryLabel(x);
                            return (
                                <tr key={x.id}>
                                    <th scope="row"><code>{x.type}</code></th>
                                    <td className="eg-dv-url">{shortUrl(x.url)}</td>
                                    <td>{ago(x.last_at ?? x.created_at)}{x.attempts > 1 && <small>{x.attempts} tries</small>}</td>
                                    <td><Tag tone={tone as Tone}>{label}</Tag>{x.last_error && x.status !== "succeeded" && <small title={x.last_error}>{x.last_error}</small>}</td>
                                    <td className="eg-dv-act"><button type="button" className="eg-btn white sm" disabled={busy} onClick={() => void act(() => store.replay(x.id), "Sending again")}><ArrowClockwise {...ic} />Replay</button></td>
                                </tr>
                            );
                        })}</tbody>
                    </table>
                </div>
            ) : <Empty>Nothing sent yet. Use Send test on an endpoint to see one arrive.</Empty>}
        </Card>
    );
};

// ---------------------------------------------------------------- integrations
const Integrations = ({ store, ready }: { store: Store; ready: boolean }) => {
    const d = store.d, zaps = d.endpoints.filter((e) => e.source === "zapier" && e.active).length, ads = d.ads?.opt_in;
    const items: { name: string; note: string; tag: [Tone, string]; href?: string }[] = [
        { name: "Stripe Connect", note: "Gifts go straight to your own Stripe account.", tag: !ready ? ["grey", "Admins see this"] : d.stripe ? ["sage", "Connected"] : ["grey", "Not connected"] },
        { name: "Zapier", note: zaps ? `${zaps} Zap${zaps === 1 ? "" : "s"} listening for events.` : "Connect with a secret key; Zaps subscribe to events through REST Hooks.", tag: zaps ? ["sage", "Connected"] : ["grey", "Ready"] },
        { name: "Google Analytics 4", note: "The donation event only: no fund, no donor detail.", tag: ads && d.ads?.ga4 ? ["lilac", "Donation event on"] : ["grey", "Off"], href: "/engage/revenue" },
        { name: "Meta Pixel", note: "The value only: no fund, no donor detail.", tag: ads && d.ads?.meta ? ["lilac", "Value only on"] : ["grey", "Off"], href: "/engage/revenue" },
        { name: "CSV import", note: "Bring in gifts from LaunchGood or Donorbox for one total.", tag: d.imports ? ["sage", `${d.imports} import${d.imports === 1 ? "" : "s"}`] : ["grey", "Not used yet"], href: "/engage/revenue" },
        { name: "Salesforce NPSP", note: "Built with you; webhooks cover it today.", tag: ["grey", "On request"] },
        { name: "Bloomerang", note: "Built with you; webhooks cover it today.", tag: ["grey", "On request"] },
        { name: "Mailchimp", note: "Built with you; webhooks cover it today.", tag: ["grey", "On request"] },
    ];
    return (
        <Card title="Integrations" className="eg-dv-int">
            <ul className="eg-dv-tiles">{items.map((i) => (
                <li key={i.name}>
                    <b>{i.href ? <a href={i.href}>{i.name}</a> : i.name}</b>
                    <small>{i.note}</small>
                    <Tag tone={i.tag[0]}>{i.tag[1]}</Tag>
                </li>
            ))}</ul>
        </Card>
    );
};
