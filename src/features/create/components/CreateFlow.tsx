import { type ReactNode, useEffect, useRef, useState } from "react";
import { ShareDialog, readImage, Logo, Buddy, Confetti, youtubeId } from "@/shared/ui";
import { useApp } from "@/shared/lib/app-context";
import { CURRENCIES, DEFAULT_ALLOCATION, type Cover, LAYOUTS, PAGE_TYPES, PREFIX, type PageData, type PageType } from "@/shared/domain/model";
import { campaigns } from "@/shared/lib/campaign-store";
import { DEMO_SLUG } from "@/shared/lib/route";
import type { PageRow } from "@/shared/domain/types";
import { cx } from "@/shared/utils/cx";
import { track } from "@/shared/lib/analytics";
import { heard, inWords } from "./heard";
import { ACCENT, ARROW, BACK, Bubble, Check, Kbd, Mic, Svg, TICK, Tick, UP, field, fieldInput, focus, linkCls, next, pill, soft, tile } from "@/shared/ui";

// Every size, colour and gap here is lifted from the "Campaign Create Flow" design canvas (Round 3 desktop talk, Round 4 A · Focus);
// the palette lives in outgive.css under .focus-bg. Buttons use the homepage pink; the progress bar is thicker than the design's 4px.
const GOALS =[1000, 5000, 10000, 25000, 50000];
const PRESETS = [10, 25, 50, 100, 250];
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const toHtml = (...parts: string[]) => parts.flatMap((p) => p.split(/\n\s*\n/)).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
const fromHtml = (h: string) => h.replace(/<\/p>\s*<p>/g, "\n\n").replace(/<br\s*\/?>/g, "\n").replace(/<[^>]*>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const TYPE_DESC: Record<PageType, string> = { fundraiser: "Raise for a person, a cause or a bill", campaign: "An organisation's ongoing appeal", team: "Several people raise toward one goal", challenge: "Run, walk, cycle — sponsored by friends", event: "Tickets or donations for a date", memory: "A tribute page for someone you've lost" };
const MONEY_GOES = /\b(goes? (straight )?to|pays? for|covers?|spent on|will fund)\b/i;
const MAC = /Mac|iPhone|iPad/.test(navigator.userAgent);

// Web Speech API: Chrome/Edge/Safari. Elsewhere the transcript box is just typed into.
type Rec = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null };
const SpeechRec = (window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => Rec }).webkitSpeechRecognition;
/** What to tell someone when the browser's speech service gives up, keyed by SpeechRecognitionErrorEvent.error. */
const VOICE_ERRORS: Record<string, string> = {
    "not-allowed": "The microphone is blocked. Allow it from the icon in the address bar, then try again.",
    "service-not-allowed": "This browser won't let the page use speech. Try Chrome, Edge or Safari, or type in the box.",
    "audio-capture": "No microphone was found. Plug one in, or type in the box.",
    network: "This browser can't reach its speech service (Brave and some Chromium builds block it). Try Chrome, Edge or Safari, or type in the box.",
    "no-speech": "Penny didn't catch any words. Check the right microphone is picked and allowed (on Windows: Settings › Privacy › Microphone), speak up, and try again.",
    "language-not-supported": "Speech isn't available in your browser's language. Type in the box instead.",
};
/** Starts dictation; each result replaces what this session has said so far, appended to `before`. Returns the recogniser, or null. */
const listen = (before: string, onText: (s: string) => void, onEnd: () => void, onError: (message: string) => void): Rec | null => {
    if (!SpeechRec) return null;
    const r = new SpeechRec();
    r.lang = navigator.language || "en-US"; r.continuous = true; r.interimResults = true;
    const pre = before.trim() ? `${before.trim()} ` : "";
    // Chrome ends a session that heard no words without any error, so track whether anything arrived and say so if not.
    let heardAny = false, failed = false;
    r.onresult = (e) => { heardAny = true; onText(pre + Array.from(e.results, (x) => x[0].transcript).join("")); };
    r.onerror = (e) => { if (e.error === "aborted") return; failed = true; onError(VOICE_ERRORS[e.error] ?? `Speech stopped (${e.error}). Try again, or type in the box.`); };
    r.onend = () => { if (!heardAny && !failed) onError(VOICE_ERRORS["no-speech"]); onEnd(); };
    try { r.start(); return r; } catch (e) { onError(`Couldn't start the microphone: ${(e as Error).message}`); return null; }
};

type Screen = "talk" | "title" | "detail" | "goal" | "photo" | "story" | "gifts";
const NAMES: Record<Screen, string> = { talk: "Talk", title: "Title", detail: "Details", goal: "Amount", photo: "Images", story: "Story", gifts: "Donation buttons" };
const DRAFT = "outgive.draft";
/** Talk first (or type), then one field per screen: title + type, the one detail some types need, goal (with the charity), photo, story,
 *  donation buttons. Layout, money split and causes get defaults and are changed later from the manage screen.
 *  A draft is kept in the browser so signing in loses nothing. */
export const CreateFlow = ({ parent }: { parent?: string }) => {
    const { db, go, href, money, currency, org, user, isDemo, toast } = useApp();
    const draft = (() => { try { return JSON.parse(localStorage.getItem(DRAFT) ?? "null") ?? {}; } catch { return {}; } })() as Record<string, unknown>;
    const [screen, setScreen] = useState<Screen | "live">((draft.screen as Screen) in NAMES ? (draft.screen as Screen) : "talk");
    const [type, setType] = useState<PageType>((draft.type as PageType) ?? "fundraiser");
    const [orgName, setOrg] = useState((draft.orgName as string) ?? org?.name ?? "");
    const [d, setD] = useState<Record<string, string>>((draft.d as Record<string, string>) ?? {});
    const [goal, setGoal] = useState((draft.goal as number) ?? 5000);
    const [title, setTitle] = useState((draft.title as string) ?? "");
    const [lead, setLead] = useState((draft.lead as string) ?? "");
    const [body, setBody] = useState((draft.body as string) ?? (typeof draft.story === "string" ? fromHtml(draft.story) : ""));
    const [gifts, setGifts] = useState<number[]>((draft.gifts as number[]) ?? [10, 25, 50, 100]);
    const [custom, setCustom] = useState("");
    const [said, setSaid] = useState((draft.said as string) ?? "");
    /** Up to three photos; the first is the cover, the others go under the story. */
    const [video, setVideo] = useState((draft.video as string) ?? "");
    const [photos, setPhotos] = useState<string[]>((draft.photos as string[]) ?? ((draft.cover as Cover | undefined)?.src ? [(draft.cover as Cover).src] : []));
    const [coverError, setCoverError] = useState("");
    /** Real campaigns a team can join, as [address key, title]. */
    const [joinable, setJoinable] = useState<[string, string][]>([]);
    const [joinId, setJoinId] = useState((draft.joinId as string) ?? "");
    const [tried, setTried] = useState(false);
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);
    const [key, setKey] = useState("");
    const [listening, setListening] = useState<"" | "talk" | "story">("");
    const [secs, setSecs] = useState(0);
    const [voiceError, setVoiceError] = useState("");
    const rec = useRef<Rec | null>(null);
    const live = screen === "live";
    useEffect(() => { campaigns.list().then((all) => setJoinable(all.filter((x) => x.type === "campaign" || x.type === "challenge").map((x) => [`${PREFIX[x.type]}/${x.slug}`, x.title]))).catch(() => setJoinable([])); }, []);
    useEffect(() => {
        if (live) return;
        const all = { screen, type, orgName, d, goal, title, lead, body, gifts, said, photos, video, joinId };
        try { localStorage.setItem(DRAFT, JSON.stringify(all)); } catch { try { localStorage.setItem(DRAFT, JSON.stringify({ ...all, photos: [] })); } catch { /* storage unavailable */ } }
    }, [screen, type, orgName, d, goal, title, lead, body, gifts, said, photos, video, joinId]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { if (!listening) return; const t = setInterval(() => setSecs((s) => s + 1), 1000); return () => clearInterval(t); }, [listening]);
    useEffect(() => () => rec.current?.stop(), []);

    const layout = (LAYOUTS.find((l) => l.types.includes(type)) ?? LAYOUTS[0]).id;
    const address = slugify(title) || "your-page";
    const path = `${PREFIX[type]}/${address}`;
    const rate = CURRENCIES[currency];
    const cover: Cover = photos[0] ? { kind: "image", src: photos[0] } : { kind: "none", src: "" };
    const hasCover = !!photos[0];
    const steps: Screen[] = ["title", ...(type === "fundraiser" || type === "campaign" ? [] : ["detail" as const]), "goal", "photo", "story", "gifts"];
    const at = live ? steps.length : steps.indexOf(screen as Screen);
    const got = heard(said);
    const story = toHtml(lead, body);
    /** What the current screen still needs, or "". Only truly required answers are checked. */
    const gap = (): string => {
        if (screen === "title" && !title.trim()) return "Give your page a title.";
        if (screen === "detail") {
            if (type === "team" && !d["Team name"]?.trim()) return "Add the team name.";
            if (type === "memory" && !d["In memory of"]?.trim()) return "Add the name of the person this page remembers.";
            if (type === "challenge" && !(Number(d.Target) > 0)) return "Set a target for the challenge.";
            if (type === "event" && !d.When) return "Add the date and time of the event.";
        }
        if (screen === "goal" && !(goal > 0)) return "Set a goal above zero.";
        if (screen === "goal" && !orgName.trim()) return "Add the charity the gifts go to.";
        if (screen === "photo" && video.trim() && !youtubeId(video.trim())) return "That link isn't a YouTube video. Paste a youtube.com, youtu.be or Shorts link.";
        if (screen === "gifts" && !gifts.length) return "Turn on at least one donation button.";
        return "";
    };
    const page: PageData = { type, slug: address, title: title.trim(), org: orgName.trim(), country: org?.country ?? "", goal, raised: 0, supporters: 0, story, cover: hasCover ? cover : { kind: "none", src: "" }, layout, isSample: false, causes: [], details: { ...d, Charity: orgName.trim() }, gifts, endDate: "", showGoal: true, created: Date.now(), donations: [], updates: [], allocation: DEFAULT_ALLOCATION };
    /** Where the new campaign lives: /f/<slug>, /t/<slug>… (a real campaign, never the demo). */
    const realPage = (k: string) => { const [t, s] = k.split("/"); return { name: "page" as const, org: DEMO_SLUG, page: { type: (Object.keys(PREFIX) as PageType[]).find((x) => PREFIX[x] === t)!, slug: s }, real: true as const }; };
    const url = `${window.location.origin}${href(realPage(key || path))}`;

    /** Saves the campaign through the campaign service (cookies for now, the API later) and shows the live screen. */
    const publish = async () => {
        setBusy(true);
        try {
            // The page this one raises for: from a "Start a fundraiser" link (?for=c/slug), or the campaign a team chose to join.
            const parentId = parent || (type === "team" && joinId ? joinId : undefined);
            const c = await campaigns.create({ type, slug: address, title: title.trim().replace(/^\p{Ll}/u, (ch) => ch.toUpperCase()), charity: orgName.trim() || org?.name || "", goal, lead: lead.trim(), body: body.trim(), gifts, details: d, photos, ...(user?.name && { organiser: user.name }), ...(youtubeId(video.trim()) && { video: video.trim() }), ...(parentId && { parentId }) });
            track("page-published", { type: c.type, layout });
            setKey(`${PREFIX[c.type]}/${c.slug}`); try { localStorage.removeItem(DRAFT); } catch { /* ignore */ }
            setScreen("live"); window.scrollTo(0, 0);
        } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
    };
    const stop = () => { const r = rec.current; rec.current = null; r?.stop(); setListening(""); };
    const start = (what: "talk" | "story") => {
        stop(); setVoiceError("");
        // Only the current recogniser may flip the button back: an old one ending late must not stop the new session's UI.
        const r: Rec | null = listen(what === "talk" ? said : body, what === "talk" ? setSaid : setBody, () => { if (rec.current === r) { rec.current = null; setListening(""); } }, setVoiceError);
        rec.current = r;
        if (r) { setSecs(0); setListening(what); }
    };
    /** Hand what was said to the typed flow: every field pre-filled, the person fixes rather than fills. */
    const doneTalking = () => {
        stop();
        if (got.title && !title.trim()) setTitle(got.title);
        if (got.type) setType(got.type);
        if (got.goal) setGoal(Math.max(1, Math.round(got.goal / rate)));
        if (got.story && !lead.trim() && !body.trim()) { const [first, ...rest] = got.story.split(/(?<=[.!?])\s+/); setLead(first); setBody(rest.join(" ")); }
        if (got.type === "memory" && got.name) setD((o) => ({ ...o, "In memory of": o["In memory of"] || got.name! }));
        track("create-talked", { words: said.split(/\s+/).length });
        setScreen("title");
    };
    const submit = () => {
        if (screen === "talk") { if (said.trim()) doneTalking(); else setScreen("title"); return; }
        if (gap()) { setTried(true); return; }
        setTried(false); stop();
        if (screen === "gifts") { publish(); return; }
        setScreen(steps[at + 1]);
    };
    const back = () => { setTried(false); stop(); setScreen(at <= 0 ? "talk" : steps[at - 1]); };
    const skip = (to: Screen) => () => { setTried(false); stop(); setScreen(to); };
    const setDetail = (k: string, v: string) => { setD((o) => ({ ...o, [k]: v })); setTried(false); };
    const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); } };
    const addPhotos = async (files: File[]) => {
        setCoverError("");
        const imgs = files.filter((f) => f.type.startsWith("image/")).slice(0, 3 - photos.length);
        if (files.length && !imgs.length) return setCoverError(photos.length >= 3 ? "Three photos is the most. Remove one first." : "Choose an image file.");
        try { const srcs = await Promise.all(imgs.map((f) => readImage(f))); setPhotos((o) => [...o, ...srcs].slice(0, 3)); } catch (e) { setCoverError((e as Error).message); }
    };
    const addCustom = () => { const n = Math.round(Number(custom.replace(/[^\d.]/g, "")) / rate); if (n > 0) setGifts((o) => [...new Set([...o, n])].sort((a, b) => a - b)); setCustom(""); setTried(false); };

    const missing = tried ? gap() : "";
    const shown = Math.round(goal * rate).toLocaleString(currency === "INR" ? "en-IN" : "en");
    const symbol = money(0).replace(/[\d.,\s]/g, "");
    /** The goal shrinks as it grows so it always sits inside the gauge's arc. */
    const amountSize = shown.length <= 6 ? 52 : shown.length <= 8 ? 42 : shown.length <= 10 ? 34 : 28;
    const qCls = "m-0 text-[34px] leading-[1.08] font-extrabold tracking-[-0.035em] text-balance text-(--f-ink) md:text-[44px]";
    /** Step pill and the question; every step opens the same way. */
    const head = (q: ReactNode, asH1 = false) => (
        <div className="flex flex-col items-start gap-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-(--f-line) bg-(--f-card)/80 py-1 pr-3.5 pl-1 text-[13px] leading-none font-semibold text-(--f-ink) tabular-nums shadow-[0_1px_2px_rgb(11_15_25/0.04)]"><span className="rounded-full bg-(--f-ice) px-2.5 py-1.5 font-bold text-(--f-blue)">Step {at + 1} of {steps.length}</span>{NAMES[screen as Screen]}</span>
            {asH1 ? <h1 className={qCls}>{q}</h1> : <div className={qCls}>{q}</div>}
        </div>
    );
    const section = (label: string, note?: string) => <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="text-[15px] font-bold tracking-[-0.01em] text-(--f-ink)">{label}</span>{note && <span className="text-[13px] text-(--f-faint)">{note}</span>}</div>;
    const hint = (h: ReactNode, right?: ReactNode) => <div role="status" className={cx("flex items-center justify-between gap-4 px-1 text-sm leading-normal", missing ? "font-semibold text-error-primary" : "text-(--f-grey)")}><span>{missing ? <>Almost! {missing}</> : h}</span>{right && <span className="shrink-0 tabular-nums">{right}</span>}</div>;
    const footer = (label: ReactNode, extra?: ReactNode, d?: string) => (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-(--f-line) pt-6">
            <button type="button" onClick={back} className={linkCls}><Svg d={BACK} size={14} />Back</button>
            <span className="ml-auto">{extra ?? <span className="inline-flex items-center gap-1.5 text-[13px] text-(--f-grey) max-sm:hidden">press <Kbd>Enter ↵</Kbd></span>}</span>
            <button type="submit" disabled={busy} className={next}>{label}<Bubble d={d} /></button>
        </div>
    );
    const saveExit = <button type="button" onClick={() => go({ name: "home" })} className={cx("inline-flex h-10 cursor-pointer items-center rounded-full border border-(--f-line) bg-(--f-card)/70 px-4 text-[13px] leading-none font-bold text-(--f-ink) transition hover:bg-(--f-card)", focus)}>Save &amp; exit</button>;

    // The story's checklist: each beat ticks when the text seems to answer it; tapping one adds a sentence starter.
    const text = `${lead} ${body}`;
    const beats: [string, boolean, string, string][] = [
        ["What happened", lead.trim().length > 20, "Who it's for and what changed", ""],
        ["By when, and where", /\b(january|february|march|april|may|june|july|august|september|october|november|december|by the|on the \d)/i.test(text), "The date and the place", "It happens on "],
        ["Where the money goes", MONEY_GOES.test(text), "Name who receives the money", "Every penny goes to "],
        [`What ${money(gifts[1] ?? 25)} buys`, /\b(buys|pays for one|is one|covers one)\b/i.test(text), "Something one gift pays for", `${money(gifts[1] ?? 25)} buys `],
        ["How you'll keep donors posted", /\bupdates?\b/i.test(text), "e.g. an update every week", "I'll post an update "],
    ];
    const ticks = beats.filter((b) => b[1]).length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;

    if (screen === "talk") {
        // Talk-to-Penny landing (Round 3 · Desktop · Talk to Spark)
        const terms = [got.name, got.when, ...(said.match(/[£$€₹]\s?\d[\d,]*(?:\.\d+)?\s*(?:k|thousand|lakhs?|million)?|\d[\d,]*\s*(?:k|thousand|lakhs?|million)\b/gi) ?? [])].filter(Boolean) as string[];
        const parts = terms.length ? said.split(new RegExp(`(${terms.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g")) : [said];
        const found: [string, boolean][] = [
            [got.name ? `${got.type === "memory" ? "In memory of" : "For"} ${got.name} · ${PAGE_TYPES.find((x) => x.id === got.type)!.label}` : "Who it's for", !!got.name],
            [got.goal ? `Goal ${money(Math.round(got.goal / rate))}` : "How much you need", !!got.goal],
            ...(got.when ? [[got.when, true] as [string, boolean]] : []),
            ["What the money covers", MONEY_GOES.test(said)],
        ];
        const shared = "col-start-1 row-start-1 m-0 min-h-[96px] w-full p-0 font-jakarta text-[18px] leading-[1.45] font-semibold tracking-[-0.01em] break-words whitespace-pre-wrap md:text-[22px]";
        return (
            <div data-accent={ACCENT} className="focus-bg talk-bg relative isolate flex min-h-dvh flex-col items-center overflow-hidden font-jakarta">
                <svg aria-hidden="true" viewBox="0 0 1280 820" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 -z-10 size-full">
                    <defs><filter id="f-cloud" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="40" /></filter></defs>
                    <ellipse cx="140" cy="700" rx="320" ry="120" fill="var(--f-cloud)" opacity="0.9" filter="url(#f-cloud)" />
                    <ellipse cx="1160" cy="640" rx="300" ry="110" fill="var(--f-cloud)" opacity="0.9" filter="url(#f-cloud)" />
                    <ellipse cx="640" cy="120" rx="420" ry="90" fill="var(--f-cloud)" opacity="0.5" filter="url(#f-cloud)" />
                </svg>
                <header className="flex w-full max-w-[1120px] items-center justify-between px-5 py-6 md:px-8">
                    <Logo onClick={() => go({ name: "home" })} />
                    <button type="button" onClick={() => go({ name: "home" })} className={cx("inline-flex h-10 cursor-pointer items-center rounded-full border border-[rgb(11_15_25/0.08)] bg-(--f-card)/70 px-4 text-[13px] leading-none font-bold text-(--f-ink)", focus)}>Save &amp; exit</button>
                </header>

                <section className="flex flex-col items-center gap-4 px-5 pt-4 pb-7 text-center md:px-8">
                    <span className="inline-flex items-center gap-2 rounded-full border border-(--f-ice-line) bg-(--f-card)/75 py-1.5 pr-3.5 pl-1.5 text-[13px] leading-none font-semibold text-(--f-blue)"><span className="rounded-full bg-(--f-blue) px-[9px] py-[5px] text-[11px] font-extrabold text-white">New</span>Create a page by talking</span>
                    <h1 className="m-0 text-[38px] leading-[1.05] font-extrabold tracking-[-0.035em] md:text-[54px]">Tell Penny what happened.<br /><span className="text-(--f-blue)">She writes</span> the rest.</h1>
                    <p className="m-0 max-w-[560px] text-[17px] leading-normal text-(--f-body)">Sixty seconds of talking becomes a title, a goal, a story and donation buttons — ready to launch.</p>
                </section>

                <main className="relative w-full max-w-[980px] px-4 pb-14 md:px-8">
                    <div className="relative">
                        <div aria-hidden className="absolute inset-x-8 -top-[22px] h-[60px] rounded-[28px] bg-linear-to-r from-(--f-ice-line) via-(--f-sky) to-(--f-ice-line) opacity-70" />
                        <div aria-hidden className="absolute inset-x-4 -top-[11px] h-[60px] rounded-[28px] bg-(--f-card) opacity-90" />
                        <form noValidate onSubmit={(e) => { e.preventDefault(); submit(); }} className="relative flex flex-col gap-6 rounded-[28px] bg-(--f-card) px-5 pt-5 pb-8 shadow-[0_30px_80px_var(--f-glow),0_2px_6px_rgb(11_15_25/0.04)] md:px-8">
                            <nav aria-label="Steps" className="flex justify-center overflow-x-auto">
                                <ol className="m-0 inline-flex list-none gap-1 rounded-full bg-(--f-chip) p-[5px]">
                                    {["Talk", "Draft", "Photo", "Buttons", "Launch"].map((s, i) => <li key={s} aria-current={i === 0 ? "step" : undefined} className={cx("inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm leading-none font-bold", i === 0 ? "bg-(--f-card) text-(--f-ink) shadow-[0_2px_8px_rgb(11_15_25/0.08)]" : "text-(--f-faint)")}>{i === 0 && <span className="size-2 rounded-full bg-(--f-rec-dot)" />}{s}</li>)}
                                </ol>
                            </nav>

                            <div className="flex flex-wrap gap-7">
                                <div className="flex flex-[0_0_200px] flex-col items-center gap-3.5 pt-1.5 max-sm:flex-1">
                                    <Buddy mood={listening ? "wow" : "happy"} className="w-[150px]" />
                                    {SpeechRec ? (
                                        <button type="button" onClick={() => listening ? stop() : start("talk")} className={cx("inline-flex cursor-pointer items-center gap-2 rounded-full px-3.5 py-2 text-[13px] leading-none font-bold", focus, listening ? "bg-(--f-rec-bg) text-(--f-rec)" : "bg-(--f-chip) text-(--f-ink)")}>
                                            {listening ? <><span className="size-2 animate-pulse rounded-full bg-(--f-rec-dot)" />Listening · {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}</> : <><Mic size={14} />{said ? "Keep talking" : "Start talking"}</>}
                                        </button>
                                    ) : <span className="text-center text-[13px] text-(--f-grey)">Voice isn't available in this browser — type it instead.</span>}
                                    {voiceError && <p role="alert" className="m-0 max-w-[220px] text-center text-[13px] leading-snug font-semibold text-error-primary">{voiceError}</p>}
                                    <div aria-hidden className="flex h-7 items-end gap-1">{[10, 20, 28, 14, 24, 9, 18, 26, 12].map((h, i) => <span key={i} className={cx("w-1 origin-bottom rounded-[2px]", [2, 4, 6].includes(i) ? "bg-(--f-sky)" : "bg-(--f-blue)", listening ? "animate-[eq_0.9s_ease-in-out_infinite]" : "opacity-30")} style={{ height: h, animationDelay: `${i * -0.11}s` }} />)}</div>
                                </div>

                                <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-[18px]">
                                    <div className="flex flex-col gap-2.5 rounded-[20px] bg-(--f-soft) px-6 py-[22px]">
                                        <label htmlFor="f-said" className="text-[11px] leading-none font-semibold tracking-[0.08em] text-(--f-faint) uppercase">{listening ? "Live transcript" : "What happened"}</label>
                                        {/* The textarea's own text is transparent; the copy behind it carries the highlighted bits Penny picked out. */}
                                        <div className="grid">
                                            <div aria-hidden className={cx(shared, "text-(--f-ink)")}>{parts.map((x, i) => i % 2 ? <mark key={i} className="!p-0 !font-semibold [box-shadow:-4px_0_0_var(--f-mark),4px_0_0_var(--f-mark)]">{x}</mark> : x)}{"\n"}</div>
                                            <textarea id="f-said" aria-label="What happened" rows={3} value={said} onChange={(e) => setSaid(e.target.value)} placeholder="Who it's for, what happened, how much you need and by when…" className={cx(shared, "resize-none overflow-hidden border-0 bg-transparent text-transparent caret-(--f-ink) outline-none placeholder:font-medium placeholder:text-(--f-ph)")} />
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2" aria-live="polite">
                                        {found.map(([v, ok]) => <span key={v} className={cx("inline-flex h-10 items-center gap-2 rounded-full bg-(--f-chip) pr-3.5 pl-2.5 text-sm leading-none font-bold", ok ? "text-(--f-ink)" : "text-(--f-faint)")}><Check on={ok} />{v}</span>)}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-(--f-line-2) pt-1">
                                <span className="inline-flex flex-wrap items-center gap-2 pt-4 text-[13px] text-(--f-grey)">{listening ? <>Tap <b>Listening</b> to pause · any language</> : <>Talk or type in the box ·<button type="button" onClick={() => { stop(); setScreen("title"); }} className={cx(linkCls, "text-[13px] underline underline-offset-2")}>I'd rather type</button></>}</span>
                                <button type="submit" className={cx(next, "mt-4")}>{said.trim() ? "I'm done talking" : "Skip, I'll type"}<Bubble d={UP} /></button>
                            </div>
                        </form>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div data-accent={ACCENT} className="focus-bg flex min-h-dvh flex-col font-jakarta">
            {!live && (
                <div role="progressbar" aria-label="Progress" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={at + 1} className="h-2.5 bg-(--f-line-2)">
                    <div className="h-full rounded-r-full bg-(--f-blue) transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ width: `${((at + 1) / steps.length) * 100}%` }} />
                </div>
            )}
            <header className="flex items-center justify-between px-5 py-5 md:px-10">
                <Logo onClick={() => go({ name: "home" })} />
                {saveExit}
            </header>

            <main className="flex flex-1 items-center justify-center px-5 pt-4 pb-20 md:px-10">
                <form noValidate onSubmit={(e) => { e.preventDefault(); submit(); }} className={cx("flex w-full max-w-[980px] flex-col gap-8", live && "max-w-[640px] items-center text-center")}>
                    {screen === "title" && <>
                        {head(<label htmlFor="f-title">What are you raising money for?</label>)}
                        <div className="flex flex-col gap-2.5">
                            <div className={field}>
                                <Svg d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" size={18} w={2} className="shrink-0 text-(--f-faint)" />
                                <input id="f-title" autoFocus aria-label="Title" maxLength={60} placeholder="What you're raising for, in a few words" value={title} onChange={(e) => { setTitle(e.target.value); setTried(false); }} className={fieldInput} />
                                {title.trim().split(/\s+/).length >= 3 && title.length <= 45 && <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-(--f-mark) px-3 py-1.5 text-xs leading-none font-bold text-[#0b0f19]"><Svg d={TICK} size={11} w={3.5} />Good title</span>}
                                <span className="shrink-0 text-[13px] font-medium text-(--f-faint) tabular-nums max-sm:hidden">{title.length}/60</span>
                            </div>
                            {hint(<>A <mark>name and a verb</mark> beat anything clever. This is what people see when you share the link.</>)}
                        </div>
                        <div className="flex flex-col gap-3">
                            {section("Campaign type", "Changes which fields you'll see next")}
                            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">{PAGE_TYPES.map((pt) => { const on = pt.id === type; const Icon = pt.icon; return (
                                <button key={pt.id} type="button" aria-pressed={on} onClick={() => setType(pt.id)} className={cx(tile(on), "flex items-start gap-3.5 p-4 pr-11")}>
                                    <span className={cx("flex size-10 shrink-0 items-center justify-center rounded-xl transition", on ? "bg-(--f-ice) text-(--f-blue)" : "bg-(--f-chip) text-(--f-grey)")}><Icon className="size-[18px]" /></span>
                                    <span className="flex flex-col gap-1"><span className="text-[15px] leading-tight font-bold text-(--f-ink)">{pt.label}</span><span className="text-[13px] leading-snug text-(--f-grey)">{TYPE_DESC[pt.id]}</span></span>
                                    <Tick on={on} />
                                </button>
                            ); })}</div>
                        </div>
                        {footer("Continue")}
                    </>}

                    {screen === "detail" && <>
                        {type === "team" && <>
                            {head(<label htmlFor="f-detail">What's the team called?</label>)}
                            <div className="flex flex-col gap-2.5">
                                <div className={field}><Svg d="M16 19a4 4 0 00-8 0M12 11a3 3 0 100-6 3 3 0 000 6zM20 19a3 3 0 00-3-3M17 10a2 2 0 100-4M4 19a3 3 0 013-3M7 10a2 2 0 110-4" size={18} w={2} className="shrink-0 text-(--f-faint)" /><input id="f-detail" autoFocus aria-label="Team name" className={fieldInput} placeholder="Your team's name" value={d["Team name"] ?? ""} onChange={(e) => setDetail("Team name", e.target.value)} /></div>
                                {hint(<>Teammates join and raise <mark>one shared total</mark>.</>)}
                            </div>
                            {joinable.length > 0 && !parent && <div className="flex flex-col gap-3">
                                {section("Part of a campaign?", "Optional")}
                                <div className={cx(field, "h-14 pr-3")}><select aria-label="Join a campaign" value={joinId} onChange={(e) => setJoinId(e.target.value)} className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent text-[15px] font-semibold text-(--f-ink) outline-none"><option value="">Standalone team (no campaign)</option>{joinable.map(([k, name]) => <option key={k} value={k}>Join: {name}</option>)}</select></div>
                            </div>}
                        </>}
                        {type === "memory" && <>
                            {head(<label htmlFor="f-detail">Who are we remembering?</label>)}
                            <div className="flex flex-col gap-2.5">
                                <div className={field}><Svg d="M12 21s-7-4.5-7-11a4 4 0 017-2 4 4 0 017 2c0 6.5-7 11-7 11z" size={18} w={2} className="shrink-0 text-(--f-faint)" /><input id="f-detail" autoFocus aria-label="In memory of" className={fieldInput} placeholder="Their name" value={d["In memory of"] ?? ""} onChange={(e) => setDetail("In memory of", e.target.value)} /></div>
                                {hint(<>Their name goes <mark>at the top</mark> of the page.</>)}
                            </div>
                        </>}
                        {type === "challenge" && <>
                            {head(<label htmlFor="f-detail">What's the target?</label>)}
                            <div className="flex flex-col gap-2.5">
                                <div className={field}><Svg d="M5 21V4h11l-2 4 2 4H5" size={18} w={2} className="shrink-0 text-(--f-faint)" /><input id="f-detail" autoFocus aria-label="Target" inputMode="numeric" className={fieldInput} placeholder="100" value={d.Target ?? ""} onChange={(e) => setDetail("Target", e.target.value.replace(/[^\d.]/g, ""))} />
                                    <select aria-label="Unit" className="h-10 shrink-0 cursor-pointer rounded-full border-0 bg-(--f-chip) px-4 text-sm font-bold text-(--f-ink) outline-none" value={d.Unit ?? "km"} onChange={(e) => setDetail("Unit", e.target.value)}>{["km", "miles", "steps", "days"].map((u) => <option key={u}>{u}</option>)}</select></div>
                                {hint(<>Supporters love <mark>watching you get there</mark>.</>)}
                            </div>
                        </>}
                        {type === "event" && <>
                            {head(<label htmlFor="f-detail">When is it?</label>)}
                            <div className="flex flex-col gap-2.5">
                                <div className={field}><input id="f-detail" autoFocus aria-label="Date and time" type="datetime-local" className={fieldInput} value={d.When ?? ""} onChange={(e) => setDetail("When", e.target.value)} /></div>
                                {hint(<>We'll show a <mark>countdown</mark> on your page.</>)}
                            </div>
                        </>}
                        {footer("Continue")}
                    </>}

                    {screen === "goal" && <>
                        {head(<label htmlFor="f-goal">How much do you need?</label>)}
                        <div className="flex flex-col items-center gap-6 rounded-[24px] border-[1.5px] border-(--f-line) bg-(--f-card) px-5 pt-8 pb-7 shadow-[0_1px_2px_rgb(11_15_25/0.04)]">
                            {/* Step-tracker gauge: the arc fills toward the biggest suggested goal. */}
                            <div className="relative flex h-[150px] w-[260px] flex-col items-center justify-end gap-1.5 md:h-[176px] md:w-[320px]">
                                <svg viewBox="0 0 220 120" aria-hidden="true" className="absolute top-0 w-full">
                                    <path d="M20 110a90 90 0 01180 0" fill="none" stroke="var(--f-ice)" strokeWidth="16" strokeLinecap="round" />
                                    <path d="M20 110a90 90 0 01180 0" pathLength={100} fill="none" stroke="var(--f-blue)" strokeWidth="16" strokeLinecap="round" strokeDasharray={`${Math.max(0.5, Math.min(1, goal / GOALS[GOALS.length - 1]) * 100)} 100`} className="transition-[stroke-dasharray] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]" />
                                </svg>
                                <span className="relative text-xs leading-none font-semibold text-(--f-faint)">Goal amount</span>
                                <div className="relative flex items-baseline justify-center gap-1">
                                    <span style={{ fontSize: Math.round(amountSize * 0.55) }} className="leading-none font-extrabold text-(--f-faint)">{symbol}</span>
                                    <input id="f-goal" autoFocus aria-label={`Goal in ${currency}`} inputMode="numeric" value={shown} onChange={(e) => { const n = Number(e.target.value.replace(/[^\d]/g, "")); setGoal(n > 0 ? Math.max(1, Math.round(n / rate)) : 0); setTried(false); }} style={{ fontSize: amountSize }} className="field-sizing-content min-w-[2ch] max-w-[240px] border-0 bg-transparent p-0 text-center leading-none font-extrabold tracking-[-0.03em] text-(--f-ink) tabular-nums outline-none transition-[font-size] duration-200" />
                                </div>
                                <span className="relative rounded-full bg-(--f-ice) px-2.5 py-1 text-xs leading-none font-bold text-(--f-blue)">{goal <= GOALS[1] ? "Small · reachable in a week" : goal <= GOALS[3] ? "Mid-range · reachable in 30 days" : "Big · plan for 60+ days"}</span>
                            </div>
                            <p className="sr-only">{inWords(goal * rate, currency === "INR")}</p>
                            <div className="flex flex-wrap justify-center gap-2">{GOALS.map((g) => <button key={g} type="button" aria-pressed={goal === g} onClick={() => { setGoal(g); setTried(false); }} className={pill(goal === g)}>{money(g)}</button>)}</div>
                        </div>
                        <div className="flex flex-col gap-3">
                            {section("Who receives the money", "Payouts go straight to the charity")}
                            <label className={cx(field, "h-14")}><Svg d="M12 21s-7-4.5-7-11a4 4 0 017-2 4 4 0 017 2c0 6.5-7 11-7 11z" size={18} w={2} className="shrink-0 text-(--f-faint)" /><input aria-label="Charity" className="min-w-0 flex-1 border-0 bg-transparent text-[17px] font-bold text-(--f-ink) outline-none placeholder:text-(--f-ph)" placeholder={org?.name ?? "Charity"} value={orgName} onChange={(e) => { setOrg(e.target.value); setTried(false); }} /></label>
                            {missing && hint(null)}
                        </div>
                        {footer("Continue")}
                    </>}

                    {screen === "photo" && <>
                        {head(<>Show them who it's for.</>, true)}
                        <div className="flex flex-col gap-2.5">
                            <div className="grid h-[320px] grid-cols-[2fr_1fr] grid-rows-2 gap-3 max-sm:h-auto max-sm:grid-cols-2 max-sm:grid-rows-none">
                                {[0, 1, 2].map((i) => {
                                    const src = photos[i];
                                    const box = cx("relative overflow-hidden rounded-[22px]", i === 0 ? "row-span-2 max-sm:col-span-2 max-sm:row-span-1 max-sm:h-56" : "max-sm:h-32");
                                    if (src) return (
                                        <div key={i} className={cx(box, "border-[1.5px] border-(--f-line)")}>
                                            <img src={src} alt={i === 0 ? "Cover photo" : `Photo ${i + 1}`} className="size-full object-cover" />
                                            {i === 0 && <span className="absolute top-3 left-3 rounded-full bg-white/95 px-3 py-1.5 text-xs leading-none font-bold text-[#0b0f19] shadow-sm">Cover</span>}
                                            <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => setPhotos((o) => o.filter((_, k) => k !== i))} className={cx("absolute top-3 right-3 flex size-8 cursor-pointer items-center justify-center rounded-full bg-white/95 text-[#0b0f19] shadow-sm transition hover:bg-white", focus)}><Svg d="M6 6l12 12M18 6L6 18" size={14} /></button>
                                        </div>
                                    );
                                    return (
                                        <label key={i} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addPhotos([...e.dataTransfer.files]); }} className={cx(box, "group flex cursor-pointer flex-col items-center justify-center gap-2.5 border-2 border-dashed border-(--f-ice-line) bg-(--f-card) px-3 text-center transition hover:bg-(--f-ice) focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-(--f-blue)")}>
                                            <span className={cx("flex items-center justify-center bg-(--f-ice) text-(--f-blue) transition group-hover:bg-(--f-card)", i === 0 ? "size-14 rounded-2xl" : "size-10 rounded-xl")}>{i === 0 ? <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h3l2-3h6l2 3h3v12H4z" /><circle cx="12" cy="13" r="3.5" /></svg> : <Svg d="M12 5v14M5 12h14" size={18} />}</span>
                                            {i === 0 ? <><span className="text-[17px] font-bold text-(--f-ink)">Drop the cover photo here</span><span className="-mt-1 text-sm text-(--f-grey)">or <span className="font-bold text-(--f-blue)">click to browse</span> · JPG, PNG or WebP</span></>
                                                : <span className="text-sm font-bold text-(--f-ink)">Add a photo</span>}
                                            <input type="file" accept="image/*" multiple aria-label={i === 0 ? "Cover photo" : `Photo ${i + 1}`} className="sr-only" onChange={(e) => { addPhotos([...(e.target.files ?? [])]); e.target.value = ""; }} />
                                        </label>
                                    );
                                })}
                            </div>
                            {coverError && <p className="m-0 text-sm text-error-primary">{coverError}</p>}
                            {hint(<><mark>A face, not a logo</mark>. The first photo is the cover; the others show under your story.</>, `${photos.length} of 3 added`)}
                        </div>
                        <div className="flex flex-col gap-3">
                            {section("Add a video", "Optional · YouTube or Shorts")}
                            <label className={cx(field, "h-16")}>
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#ff0033] text-white"><svg viewBox="0 0 24 24" className="ml-0.5 size-4" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg></span>
                                <input aria-label="YouTube link" inputMode="url" value={video} onChange={(e) => { setVideo(e.target.value); setTried(false); }} placeholder="Paste a YouTube or Shorts link" className="min-w-0 flex-1 border-0 bg-transparent text-[16px] font-semibold text-(--f-ink) outline-none placeholder:font-medium placeholder:text-(--f-ph)" />
                                {youtubeId(video.trim()) && <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-(--f-mark) px-3 py-1.5 text-xs leading-none font-bold text-[#0b0f19]"><Svg d={TICK} size={11} w={3.5} />Video added</span>}
                            </label>
                        </div>
                        {footer("Continue", <button type="button" onClick={skip("story")} className={linkCls}>Skip for now</button>)}
                    </>}

                    {screen === "story" && <>
                        {head(<label htmlFor="f-story">Tell it like a text to a friend.</label>)}
                        <div className="flex flex-wrap items-stretch gap-5">
                            <div className="flex min-w-0 flex-[1_1_520px] flex-col overflow-hidden rounded-[24px] border-[1.5px] border-(--f-line) bg-(--f-card) shadow-[0_1px_2px_rgb(11_15_25/0.04)] transition focus-within:border-(--f-ice-line) focus-within:shadow-[0_0_0_4px_var(--f-ice)]">
                                <div className="flex items-center gap-2 border-b border-(--f-line-2) px-4 py-3">
                                    {SpeechRec && <button type="button" onClick={() => listening === "story" ? stop() : start("story")} className={cx("inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs leading-none font-bold", focus, listening === "story" ? "bg-(--f-rec-bg) text-(--f-rec)" : "bg-(--f-chip) text-(--f-ink)")}><Mic size={13} />{listening === "story" ? `Listening · ${secs}s` : "Dictate"}</button>}
                                    <span className="ml-auto inline-flex items-center gap-2 text-xs leading-none font-bold text-(--f-ink)"><span aria-hidden className="inline-flex gap-[3px]">{[0, 1, 2, 3].map((i) => <span key={i} className={cx("h-1.5 w-[18px] rounded-full", i < Math.ceil((ticks * 4) / 5) ? "bg-(--f-blue)" : "bg-(--f-line)")} />)}</span>{ticks >= 4 ? "Strong" : ticks >= 2 ? "Getting there" : "Just started"}</span>
                                </div>
                                {voiceError && <p role="alert" className="m-0 border-b border-(--f-line-2) bg-error-primary/5 px-6 py-2.5 text-[13px] leading-snug font-semibold text-error-primary">{voiceError}</p>}
                                <div className="flex flex-col gap-1.5 px-6 pt-5">
                                    <span className="text-xs leading-none font-semibold text-(--f-faint)">First line — shown before "read more"</span>
                                    <input type="text" aria-label="First line" value={lead} onChange={(e) => setLead(e.target.value)} placeholder="The one sentence you want everyone to read" className="w-full border-0 bg-transparent px-0 py-1 text-[22px] leading-[1.35] font-extrabold tracking-[-0.02em] text-(--f-ink) outline-none placeholder:text-(--f-ph)" />
                                </div>
                                <div className="flex-1 px-6 pt-1">
                                    <textarea id="f-story" rows={6} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }} placeholder={"What happened next, what the money pays for, and how you'll keep people posted.\n\nWho you are to them."} className="w-full resize-none border-0 bg-transparent px-0 py-1.5 text-[17px] leading-[1.65] font-medium text-(--f-story) outline-none placeholder:text-(--f-ph)" />
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-(--f-line-2) px-6 py-3 text-[13px] text-(--f-grey)">
                                    <span><mark>Specific beats dramatic</mark> — names, dates, amounts.</span>
                                    <span className="tabular-nums">{body.length.toLocaleString("en")} / 2,000 · ~{Math.max(1, Math.round(words / 200))} min read</span>
                                </div>
                            </div>
                            <div className="flex flex-[0_1_300px] flex-col gap-2.5">
                                {section("A good story answers", "Tap to add")}
                                {beats.map(([t, ok, eg, starter]) => (
                                    <button key={t} type="button" onClick={() => { if (!ok && starter) { setBody((b) => `${b.trim()}${b.trim() ? "\n\n" : ""}${starter}`); setTimeout(() => { const el = document.getElementById("f-story") as HTMLTextAreaElement | null; el?.focus(); el?.setSelectionRange(el.value.length, el.value.length); }); } }} className={cx(tile(ok), "flex items-start gap-3 p-3.5 pr-11")}>
                                        <span className="flex flex-col gap-1"><span className="text-sm leading-tight font-bold text-(--f-ink)">{t}</span><span className="text-xs leading-snug font-medium text-(--f-grey)">{eg}</span></span>
                                        <Tick on={ok} />
                                    </button>
                                ))}
                            </div>
                        </div>
                        {footer("Continue", <span className="inline-flex items-center gap-1.5 text-[13px] text-(--f-grey) max-sm:hidden">press <Kbd>{MAC ? "⌘" : "Ctrl"} Enter</Kbd></span>)}
                    </>}

                    {screen === "gifts" && <>
                        {head(<>What can donors tap?</>, true)}
                        <div className="flex flex-col gap-2.5">
                            <div role="group" aria-label="Donation buttons" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                {[...new Set([...PRESETS, ...gifts])].sort((a, b) => a - b).map((g) => { const on = gifts.includes(g); return (
                                    <button key={g} type="button" aria-pressed={on} onClick={() => { setGifts((o) => on ? o.filter((x) => x !== g) : [...o, g].sort((a, b) => a - b)); setTried(false); }} className={cx(tile(on), "flex flex-col items-start gap-2 px-5 pt-5 pb-4")}>
                                        <Tick on={on} />
                                        <span className="text-[28px] leading-none font-extrabold tracking-[-0.025em] text-(--f-ink) tabular-nums">{money(g)}</span>
                                        <span className={cx("text-[13px] leading-[1.3]", on ? "font-semibold text-(--f-blue)" : "font-medium text-(--f-grey)")}>{goal > 0 ? `${+((g / goal) * 100).toFixed(g / goal < 0.01 ? 2 : 1)}% of the goal` : " "}</span>
                                    </button>
                                ); })}
                                <label className="flex min-h-[96px] items-center justify-center rounded-[18px] border-[1.5px] border-dashed border-(--f-ice-line) bg-(--f-card) px-4 transition hover:bg-(--f-ice) focus-within:bg-(--f-ice)">
                                    <span className="sr-only">Custom amount</span>
                                    <input inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value)} onBlur={addCustom} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} placeholder="+ Custom amount" className="w-full border-0 bg-transparent text-center text-[15px] font-bold text-(--f-ink) outline-none placeholder:text-(--f-blue)" />
                                </label>
                            </div>
                            {hint(<><mark>Three to four</mark> is the sweet spot. Donors can always type their own.</>, `${gifts.length} on`)}
                        </div>
                        {footer(busy ? "Launching…" : "Launch campaign", <span className="text-[13px] text-(--f-grey) max-sm:hidden">By launching you agree to the <a href="/terms" target="_blank" rel="noopener" className="text-(--f-grey) underline underline-offset-2">terms</a> and <a href="/privacy" target="_blank" rel="noopener" className="text-(--f-grey) underline underline-offset-2">privacy policy</a>.</span>, UP)}
                    </>}

                    {live && <>
                        <Confetti at={1} />
                        <div className="flex flex-col items-center gap-4">
                            <Buddy mood="cheer" className="w-32" />
                            <h1 className={qCls}>Woohoo, it's live!</h1>
                            <p className="m-0 text-[17px] leading-normal text-(--f-body)">Share it with <mark>three friends</mark> first. Early gifts make others give.</p>
                        </div>
                        <div className={cx(field, "h-16 w-full gap-3 pr-2 pl-5")}><Svg d="M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1" size={18} w={2} className="shrink-0 text-(--f-faint)" /><span className="min-w-0 flex-1 truncate text-left text-[15px] font-semibold text-(--f-ink)">{url.replace(/^https?:\/\//, "")}</span><button type="button" onClick={copy} className={cx("h-11 shrink-0 cursor-pointer rounded-full bg-(--f-chip) px-5 text-sm font-bold text-(--f-ink) transition hover:bg-(--f-ice)", focus)}>{copied ? "Copied" : "Copy link"}</button></div>
                        <div className="flex flex-wrap items-center justify-center gap-5">
                            <button type="button" onClick={() => go(realPage(key))} className={linkCls}>View page</button>
                            <button type="button" onClick={() => setShareOpen(true)} className={next}>Share it now<Bubble d={UP} /></button>
                        </div>
                    </>}
                </form>
            </main>
            <ShareDialog isOpen={shareOpen} onClose={() => setShareOpen(false)} url={url} title={page.title} />
        </div>
    );
};
