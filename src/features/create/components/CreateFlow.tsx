import { type ReactNode, useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Check, Copy01, Eye, Plus, Share07, Trash01, Trophy01, Users01, XClose } from "@untitledui/icons";
import { FileUpload, Badge, Button, Checkbox, Input, ProgressBarBase, NativeSelect, FeaturedIcon, ShareDialog, CoverMedia, DescriptionEditor, readImage, youtubeId, Logo, ThemeToggle } from "@/shared/ui";
import { LayoutThumb } from "@/features/campaign";
import { useApp } from "@/shared/lib/app-context";
import { CAUSES, CURRENCIES, DEFAULT_ALLOCATION, type Cover, LAYOUTS, PAGE_TYPES, PREFIX, type LayoutId, type PageData, type PageType } from "@/shared/domain/model";
import { persistCover } from "@/shared/lib/media";
import type { PageRow } from "@/shared/domain/types";
import { SignIn } from "@/features/auth";
import { cx } from "@/shared/utils/cx";
import { track } from "@/shared/lib/analytics";

const STEPS = ["Type", "Details", "Goal", "Cover and story", "Name", "Layout", "Review"];
const TIPS: [string, string][] = [
    ["One flow for every page type", "Pick what fits. You can change it any time before you publish."],
    ["Only this step changes", "Everything after it is the same for every page type."],
    ["Supporters watch the bar fill", "A goal gives people something to finish."],
    ["People give to a story", "Say who is helped, what a gift buys and why now. One clear photo or a short video works better than a collage."],
    ["Your link, ready to share", "Short titles fit better in messages and posts."],
    ["Same sections, new arrangement", "Switch layout any time without losing content."],
    ["Nearly there", "You can edit everything after publishing."],
    ["Now share it", "Start with the people closest to the cause."],
];
const GOALS = [1000, 5000, 10000, 25000];
const GIFT_CHOICES = [5, 10, 25, 50, 100, 250];
const COUNTRIES = ["India", "Kenya", "United Kingdom", "United States", "United Arab Emirates", "Other"].map((c) => ({ label: c, value: c }));
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const STEP_HINTS = ["What you are making", "Who it is for", "Amount and gifts", "Photo, video, words", "Title and link", "How it looks", "Check and publish"];
const MAX_VIDEO = 150 * 1024 * 1024;
const chip = (on: boolean) => cx("h-11 cursor-pointer rounded-xl px-4 text-sm font-bold tabular-nums outline-focus-ring transition duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-2", on ? "bg-ink text-ink-inverse" : "bg-raised text-ink-2 shadow-edge hover:bg-raised-hover hover:text-ink");

const pill = (on: boolean) => cx("h-9 cursor-pointer rounded-full px-3.5 text-[13px] font-semibold outline-focus-ring transition duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-40", on ? "bg-ink text-ink-inverse" : "bg-raised text-ink-2 shadow-edge hover:text-ink");
const Tick = ({ className }: { className?: string }) => (<span className={cx("flex size-6 items-center justify-center rounded-full bg-ink text-ink-inverse", className)}><Check className="size-3.5 stroke-[3px]" /></span>);
const StepHead = ({ title, sub }: { title: string; sub: string }) => (<div><h1 className="text-display-xs leading-[0.95] font-extrabold tracking-[-0.045em] text-ink md:text-display-md">{title}</h1><p className="mt-3 text-lg text-ink-3">{sub}</p></div>);
const Row = ({ children }: { children: ReactNode }) => <div className="grid gap-5 sm:grid-cols-2 [&>*]:min-w-0">{children}</div>;
const Seg = ({ items, value, onChange, label }: { items: [string, string][]; value: string; onChange: (v: string) => void; label: string }) => (
    <div role="group" aria-label={label} className="flex w-full gap-1 rounded-full bg-tint-2 p-1 sm:w-fit">
        {items.map(([id, name]) => <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)} className={cx("h-11 flex-1 cursor-pointer rounded-full px-5 text-md font-semibold outline-focus-ring transition duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-2 sm:flex-none", value === id ? "bg-ink text-ink-inverse" : "text-ink-2 hover:text-ink")}>{name}</button>)}
    </div>
);

const DRAFT = "outgive.draft";
/** The seven steps. A draft is kept in the browser so signing in at the last step loses nothing; `parent` nests the page under a campaign. */
export const CreateFlow = ({ parent }: { parent?: string }) => {
    const { db, go, href, money, currency, setCurrency, org, user, isDemo, toast } = useApp();
    const draft = (() => { try { return JSON.parse(localStorage.getItem(DRAFT) ?? "null") ?? {}; } catch { return {}; } })() as Record<string, unknown>;
    const [parentRow, setParentRow] = useState<PageRow | null>(null);
    useEffect(() => { if (parent && org) db.rpc<PageRow[]>("pages_list", { org: org.id }).then((rows) => setParentRow(rows.find((r) => r.id === parent || `${PREFIX[r.type]}/${r.slug}` === parent) ?? null)); }, [db, org, parent]);
    const [step, setStep] = useState((draft.step as number) ?? 1); // 1 to 7, then 8 = live
    const [type, setType] = useState<PageType>((draft.type as PageType) ?? (parent ? "fundraiser" : "fundraiser"));
    const [orgName, setOrg] = useState((draft.orgName as string) ?? org?.name ?? "");
    const [country, setCountry] = useState((draft.country as string) ?? "India");
    const [d, setD] = useState<Record<string, string>>((draft.d as Record<string, string>) ?? {});
    const [goal, setGoal] = useState((draft.goal as number) ?? 5000);
    const [gifts, setGifts] = useState((draft.gifts as number[]) ?? [10, 25, 50, 100]);
    const [endDate, setEndDate] = useState((draft.endDate as string) ?? "");
    const [showGoal, setShowGoal] = useState((draft.showGoal as boolean) ?? true);
    const [alloc, setAlloc] = useState<[string, number][]>((draft.alloc as [string, number][]) ?? DEFAULT_ALLOCATION);
    const [story, setStory] = useState((draft.story as string) ?? "");
    const [cover, setCover] = useState<Cover>((draft.cover as Cover) ?? { kind: "none", src: "" });
    const [coverTab, setCoverTab] = useState<"image" | "video" | "youtube">((draft.coverTab as "image" | "youtube") ?? "image");
    const [coverError, setCoverError] = useState("");
    const [title, setTitle] = useState((draft.title as string) ?? "");
    const [slug, setSlug] = useState((draft.slug as string) ?? "");
    const [busy, setBusy] = useState(false);
    const [publishError, setPublishError] = useState("");
    const [causes, setCauses] = useState<string[]>((draft.causes as string[]) ?? []);
    const [layout, setLayout] = useState<LayoutId>((draft.layout as LayoutId) ?? "classic");
    /** Campaigns and challenges a team can join; the chosen one becomes the new page's parent. */
    const [joinable, setJoinable] = useState<PageRow[]>([]);
    const [joinId, setJoinId] = useState((draft.joinId as string) ?? "");
    /** The step whose Continue was pressed while something was missing, so its message shows. */
    const [tried, setTried] = useState(0);
    const [agree, setAgree] = useState(false);
    const [copied, setCopied] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);
    const [key, setKey] = useState("");
    useEffect(() => { if (org) db.rpc<PageRow[]>("pages_list", { org: org.id }).then((rows) => setJoinable(rows.filter((r) => (r.type === "campaign" || r.type === "challenge") && r.status === "live"))).catch(() => setJoinable([])); }, [db, org]);
    // A local video is a blob URL that dies with the tab, so it is not drafted; images (data URLs) and YouTube links are.
    useEffect(() => {
        if (live) return;
        const keep = cover.kind === "video" ? { kind: "none", src: "" } : cover;
        const all = { step, type, orgName, country, d, goal, gifts, endDate, showGoal, alloc, story, cover: keep, coverTab: coverTab === "video" ? "image" : coverTab, title, slug, causes, layout, joinId };
        try { localStorage.setItem(DRAFT, JSON.stringify(all)); } catch { try { localStorage.setItem(DRAFT, JSON.stringify({ ...all, cover: { kind: "none", src: "" } })); } catch { /* storage unavailable */ } }
    }, [step, type, orgName, country, d, goal, gifts, endDate, showGoal, alloc, story, cover, coverTab, title, slug, causes, layout, joinId]); // eslint-disable-line react-hooks/exhaustive-deps

    const t = PAGE_TYPES.find((x) => x.id === type)!;
    const L = LAYOUTS.find((x) => x.id === layout)!;
    const address = slug || slugify(title) || "your-page";
    const path = `${PREFIX[type]}/${address}`;
    const live = step === 8;
    const rate = CURRENCIES[currency];
    const hasStory = story.replace(/<[^>]*>/g, "").trim().length > 0;
    const hasCover = cover.kind === "image" || cover.kind === "video" || (cover.kind === "youtube" && !!youtubeId(cover.src));
    /** What a step still needs before Continue; empty when it is complete. */
    const needs = (n: number): string => {
        if (n === 2) {
            if (type === "team" && !d["Team name"]?.trim()) return "Add the team name.";
            if (type === "memory" && !d["In memory of"]?.trim()) return "Add the name of the person this page remembers.";
            if (type === "challenge" && !(Number(d.Target) > 0)) return "Set a target for the challenge.";
            if (type === "event" && !d.When) return "Add the date and time of the event.";
            if (!orgName.trim()) return "Add the charity the gifts go to.";
        }
        if (n === 3 && !(goal > 0)) return "Set a goal above zero.";
        if (n === 5 && !title.trim()) return "Add a title for the page.";
        return "";
    };
    const firstGap = (upTo: number) => [2, 3, 5].find((n) => n < upTo && needs(n)) ?? 0;
    const missing = [!title.trim() && "a title", !agree && "your agreement to the terms", !user && !isDemo && "a sign-in"].filter(Boolean) as string[];
    const page: PageData = { type, slug: address, title: title.trim() || "[Your title]", org: orgName.trim() || "[Your charity]", country, goal, raised: 0, supporters: 0, story, cover: hasCover ? cover : { kind: "none", src: "" }, layout, isSample: false, causes, details: { ...d, Charity: orgName.trim() }, gifts, endDate, showGoal, created: Date.now(), donations: [], updates: [], allocation: alloc.filter(([l, v]) => l.trim() && v > 0) };
    const url = `${window.location.origin}${href({ name: "page", key: key || path })}`;
    /** Saves the page: uploads the cover, then one page_create call. The address comes back with a suffix if it was taken. */
    const publish = async () => {
        if (!org) return;
        setBusy(true); setPublishError("");
        try {
            const c = await persistCover(db, page.cover, `covers/${org.id}/${address}`);
            const row = await db.rpc<PageRow>("page_create", { p: { org_id: org.id, parent_id: parentRow?.id ?? (type === "team" && joinId ? joinId : null) ?? (parent && /^[0-9a-f-]{36}$/.test(parent) ? parent : null), type, slug: address, title: page.title, org_name: orgName.trim() || org.name, country, story, cover: c, layout, goal_cents: Math.round(goal * rate * 100), currency, end_date: endDate, show_goal: showGoal, causes, details: page.details, gifts, allocation: page.allocation, allow_fundraisers: d["Supporter fundraisers"] !== "Not allowed" } });
            track("page-published", { type: row.type, layout: row.layout });
            setKey(`${PREFIX[row.type]}/${row.slug}`); try { localStorage.removeItem(DRAFT); } catch { /* ignore */ }
            setStep(8); window.scrollTo(0, 0);
        } catch (e) { setPublishError((e as Error).message); toast((e as Error).message); } finally { setBusy(false); }
    };

    const next = () => {
        if (needs(step)) { setTried(step); return; }
        setTried(0);
        if (step === 7) { if (missing.length) return; publish(); return; }
        setStep((s) => Math.min(7, s + 1));
        window.scrollTo(0, 0);
    };
    /** The sidebar can go back anywhere, and forward only past complete steps. */
    const jump = (n: number) => { const gap = firstGap(n); if (gap) { setStep(gap); setTried(gap); } else { setStep(n); setTried(0); } };
    const toggleCause = (c: string) => setCauses((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : cs.length < 3 ? [...cs, c] : cs));
    const toggleGift = (g: number) => setGifts((gs) => (gs.includes(g) ? (gs.length > 1 ? gs.filter((x) => x !== g) : gs) : gs.length < 4 ? [...gs, g].sort((a, b) => a - b) : gs));
    const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); } };
    const setDetail = (k: string, v: string) => { setD((o) => ({ ...o, [k]: v })); if (tried) setTried(0); };
    const pickImage = async (files: FileList) => {
        setCoverError("");
        try { setCover({ kind: "image", src: await readImage(files[0]) }); } catch (e) { setCoverError((e as Error).message); }
    };
    const pickVideo = (files: FileList) => { setCoverError(""); setCover({ kind: "video", src: URL.createObjectURL(files[0]) }); };
    const setLink = (v: string) => { setCover({ kind: "youtube", src: v }); setCoverError(v && !youtubeId(v) ? "That doesn't look like a YouTube link." : ""); };

    const I = (label: string, k: string, props: { placeholder?: string; type?: string; isRequired?: boolean } = {}) => <Input label={label} value={d[k] ?? ""} onChange={(v) => setDetail(k, v)} {...props} />;
    const Sel = (label: string, k: string, opts: string[]) => <NativeSelect label={label} value={d[k] ?? opts[0]} onChange={(e) => setD((o) => ({ ...o, [k]: e.target.value }))} options={opts.map((o) => ({ label: o, value: o }))} />;
    const charity = <Input label={type === "team" ? "Charity the team raises for" : "Charity"} isRequired placeholder={org?.name} value={orgName} onChange={(v) => { setOrg(v); if (tried) setTried(0); }} hint={parentRow ? `Part of ${parentRow.title}` : undefined} />;
    const joinSel = <NativeSelect label="Campaign or challenge to join" value={parentRow?.id ?? joinId} onChange={(e) => setJoinId(e.target.value)} options={[{ label: joinable.length ? "None, a standalone team" : "No live campaigns or challenges yet", value: "" }, ...joinable.map((r) => ({ label: `${r.title} · ${PAGE_TYPES.find((x) => x.id === r.type)!.label}`, value: r.id }))]} />;
    const countrySel = <NativeSelect label="Country" options={COUNTRIES} value={country} onChange={(e) => setCountry(e.target.value)} />;

    return (
        <div className="flex min-h-dvh flex-col bg-primary lg:h-dvh lg:overflow-hidden">
            <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-hairline px-5 md:px-8">
                <Logo onClick={() => go({ name: "home" })} />
                <span className="text-sm font-semibold whitespace-nowrap text-primary lg:hidden">{live ? "Published" : <>Step {step} of 7 <span className="font-medium text-ink-3 max-sm:hidden">· {STEPS[step - 1]}</span></>}</span>
                <div className="flex items-center gap-1"><ThemeToggle /><Button color="secondary" size="md" className="rounded-full" onPress={() => go({ name: "home" })}><span className="max-sm:hidden">Save and exit</span><span className="sm:hidden">Exit</span></Button></div>
            </header>

            <div className="flex min-h-0 flex-1">
                <nav aria-label="Steps" className="hidden w-72 shrink-0 flex-col gap-1 overflow-y-auto border-r border-hairline p-6 lg:flex">
                    <span className="px-3 pb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{live ? "Published" : "Create a page"}</span>
                    {STEPS.map((name, i) => {
                        const n = i + 1; const done = live || n < step; const here = n === step && !live;
                        return (
                            <button key={name} type="button" aria-current={here ? "step" : undefined} disabled={live} onClick={() => jump(n)} className={cx("flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-left outline-focus-ring transition duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-2 disabled:cursor-default", here ? "bg-tint-2" : "hover:bg-tint-1")}>
                                <span className={cx("flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold", done ? "bg-tint-2 text-ink-2" : here ? "bg-ink text-ink-inverse" : "bg-tint-1 text-ink-3")}>{done ? <Check className="size-4 stroke-[3px]" /> : n}</span>
                                <span className="min-w-0"><span className={cx("block text-md font-semibold", here ? "text-ink" : "text-ink-2")}>{name}</span><span className="block truncate text-xs text-ink-3">{STEP_HINTS[i]}</span></span>
                            </button>
                        );
                    })}
                </nav>

            <main className="flex min-h-0 min-w-0 flex-1 flex-col">
                <div className="flex gap-1.5 px-5 pt-3 lg:hidden">{STEPS.map((s, i) => <span key={s} className={cx("h-1.5 flex-1 rounded-full", i + 1 <= step ? "bg-ink" : "bg-tint-3")} />)}</div>
                <div className="flex-1 px-5 py-8 md:px-12 md:py-12 lg:min-h-0 lg:overflow-y-auto"><div className="form-xl mx-auto flex max-w-2xl flex-col gap-8">
                    {step === 1 && <>
                        <StepHead title="What are you setting up?" sub="Every type uses the same seven steps. Only step 2 changes." />
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{PAGE_TYPES.map((pt) => {
                            const on = pt.id === type;
                            return (
                                <button key={pt.id} type="button" aria-pressed={on} onClick={() => setType(pt.id)} className={cx("flex cursor-pointer flex-col gap-2.5 rounded-3xl bg-tint-1 p-2 text-left outline-focus-ring transition duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-2 focus-visible:outline-offset-2", on ? "ring-2 ring-ink" : "hover:bg-tint-2")}>
                                    <span className={cx("relative flex h-[4.5rem] items-center justify-center rounded-2xl sm:h-24", pt.tile)}><pt.icon className="size-9 text-gray-900" />{on && <Tick className="absolute top-2 right-2" />}</span>
                                    <span className="flex flex-col gap-0.5 px-2 pb-2"><span className="text-md font-semibold text-ink">{pt.label}</span><span className="text-sm text-ink-3">{pt.desc}</span></span>
                                </button>
                            );
                        })}</div>
                    </>}

                    {step === 2 && <>
                        <StepHead title={t.detailTitle} sub="This is the only step that differs between page types." />
                        {type === "fundraiser" && <>{charity}<Row>{Sel("Occasion", "Occasion", ["Just because", "Birthday", "Wedding", "Sporting event", "Religious giving"])}{countrySel}</Row></>}
                        {type === "campaign" && <>{charity}<Row>{I("Registration number", "Registration number", { placeholder: "From your national regulator" })}{countrySel}</Row><Checkbox size="md" isSelected={d["Supporter fundraisers"] !== "Not allowed"} onChange={(v) => setD((o) => ({ ...o, "Supporter fundraisers": v ? "Allowed" : "Not allowed" }))} label="Let supporters start their own fundraisers for this campaign" /></>}
                        {type === "team" && <>{I("Team name", "Team name", { placeholder: "e.g. Harbour Runners", isRequired: true })}{charity}<Row>{joinSel}{I("Members you are aiming for", "Target members", { placeholder: "10", type: "number" })}</Row>{countrySel}</>}
                        {type === "challenge" && <><Row>{Sel("Activity", "Activity", ["Walk", "Run", "Cycle", "Swim", "Fast", "Something else"])}<div className="grid grid-cols-2 gap-3">{I("Target", "Target", { placeholder: "100", type: "number", isRequired: true })}{Sel("Unit", "Unit", ["km", "miles", "steps", "days", "hours"])}</div></Row><Row>{I("Starts", "Starts", { type: "date" })}{I("Ends", "Ends", { type: "date" })}</Row>{charity}{countrySel}</>}
                        {type === "event" && <><Row>{I("Date and time", "When", { type: "datetime-local", isRequired: true })}{Sel("Where", "Format", ["In person", "Online", "Both"])}</Row>{I("Venue or link", "Venue", { placeholder: "Address or stream link" })}<Row>{Sel("Tickets", "Tickets", ["Free, donations welcome", "Paid tickets", "No tickets"])}{I("Capacity", "Capacity", { placeholder: "120", type: "number" })}</Row>{charity}{countrySel}</>}
                        {type === "memory" && <>{I("Who is this in memory of?", "In memory of", { placeholder: "Their name", isRequired: true })}<Row>{I("Born", "Born", { type: "date" })}{I("Died", "Died", { type: "date" })}</Row>{charity}{countrySel}</>}
                    </>}

                    {step === 3 && <>
                        <StepHead title="What are you aiming to raise?" sub="Shown as a progress bar on your page. You can change it later." />
                        <div className="flex flex-col gap-3 rounded-3xl bg-tint-1 p-5 md:p-6">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Your goal</span>
                            <label className="flex items-baseline gap-1"><span className="font-bubble text-display-md font-bold text-ink-3">{money(0).replace(/[\d.,\s]/g, "")}</span>
                                <input aria-label={`Goal in ${currency}`} inputMode="numeric" value={Math.round(goal * rate).toLocaleString("en")} onChange={(e) => { const n = Number(e.target.value.replace(/[^\d]/g, "")); setGoal(n > 0 ? Math.max(1, Math.round(n / rate)) : 0); if (tried) setTried(0); }} className="w-full min-w-0 bg-transparent font-bubble text-display-lg font-bold text-ink tabular-nums outline-hidden md:text-display-xl" /></label>
                            <div className="flex flex-wrap gap-2">{GOALS.map((g) => <button key={g} type="button" aria-pressed={goal === g} onClick={() => setGoal(g)} className={chip(goal === g)}>{money(g)}</button>)}</div>
                        </div>
                        <Row><NativeSelect label="Currency" options={Object.keys(CURRENCIES).map((c) => ({ label: c, value: c }))} value={currency} onChange={(e) => setCurrency(e.target.value)} /><Input label="Goal end date (optional)" type="date" value={endDate} onChange={setEndDate} /></Row>
                        <div className="flex flex-col gap-2"><div><span className="text-sm font-semibold text-ink-2">Suggested gift amounts</span><p className="text-sm text-tertiary">Pick up to 4. These are the buttons on your donate card.</p></div>
                            <div className="flex flex-wrap gap-2">{GIFT_CHOICES.map((g) => <button key={g} type="button" aria-pressed={gifts.includes(g)} onClick={() => toggleGift(g)} className={chip(gifts.includes(g))}>{money(g)}</button>)}</div></div>
                        <div className="flex flex-col gap-3"><div><span className="text-sm font-semibold text-ink-2">Where the money goes</span><p className="text-sm text-tertiary">Donors trust a page that says how gifts are spent. Shown as a bar on your page.</p></div>
                            {alloc.map(([label, v], i) => <div key={i} className="grid grid-cols-[1fr_6.5rem_auto] items-center gap-2"><Input aria-label={`Use ${i + 1}`} placeholder="What it pays for" value={label} onChange={(x) => setAlloc((a) => a.map((r, j) => (j === i ? [x, r[1]] : r)))} /><Input aria-label={`Percent ${i + 1}`} type="number" value={String(v)} onChange={(x) => setAlloc((a) => a.map((r, j) => (j === i ? [r[0], Math.min(100, Math.max(0, Number(x) || 0))] : r)))} /><Button size="md" color="tertiary" aria-label={`Remove use ${i + 1}`} iconLeading={XClose} isDisabled={alloc.length === 1} onPress={() => setAlloc((a) => a.filter((_, j) => j !== i))} /></div>)}
                            {alloc.length < 6 && <Button size="sm" color="secondary" className="w-fit" iconLeading={Plus} onPress={() => setAlloc((a) => [...a, ["", 0]])}>Add a line</Button>}
                            <p className={cx("text-sm", alloc.reduce((n, [, v]) => n + v, 0) === 100 ? "text-tertiary" : "text-warning-primary")}>Adds up to {alloc.reduce((n, [, v]) => n + v, 0)}%{alloc.reduce((n, [, v]) => n + v, 0) === 100 ? "" : ". We scale it to 100% on your page."}</p></div>
                        <Checkbox size="md" isSelected={showGoal} onChange={setShowGoal} label="Show the goal and progress bar on my page" />
                    </>}

                    {step === 4 && <>
                        <StepHead title="Add a cover and tell the story" sub="A photo or video catches the eye. The story is why someone should give." />
                        <div className="flex flex-col gap-3">
                            <span className="text-sm font-semibold text-ink-2">Cover</span>
                            <Seg label="Cover type" value={coverTab} onChange={(v) => { setCoverTab(v as typeof coverTab); setCoverError(""); if (cover.kind !== v) setCover({ kind: "none", src: "" }); }} items={[["image", "Image"], ["video", "Video"], ["youtube", "YouTube link"]]} />
                            {coverTab === "image" && cover.kind !== "image" && <FileUpload.DropZone className="min-h-64 justify-center" hint="JPG, PNG or WebP. Large photos are shrunk for you." accept="image/*" allowsMultiple={false} onDropFiles={pickImage} onDropUnacceptedFiles={() => setCoverError("Choose an image file.")} />}
                            {coverTab === "video" && cover.kind !== "video" && <FileUpload.DropZone className="min-h-64 justify-center" hint="MP4 or WebM, up to 150 MB" accept="video/mp4,video/webm,video/quicktime" allowsMultiple={false} maxSize={MAX_VIDEO} onDropFiles={pickVideo} onDropUnacceptedFiles={() => setCoverError("Choose an MP4 or WebM video.")} onSizeLimitExceed={() => setCoverError("That video is over 150 MB.")} />}
                            {coverTab === "youtube" && <Input aria-label="YouTube link" placeholder="https://www.youtube.com/watch?v=..." value={cover.kind === "youtube" ? cover.src : ""} onChange={setLink} isInvalid={!!coverError} hint={coverError || "Paste a youtube.com or youtu.be link."} />}
                            {coverError && coverTab !== "youtube" && <p className="text-sm text-error-primary">{coverError}</p>}
                            {hasCover && (
                                <div className="flex flex-col gap-2"><CoverMedia cover={cover} className="aspect-video w-full" />
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-tertiary"><span>{cover.kind === "video" ? "Videos from your computer play until you close this tab. Use a YouTube link to keep one." : "This is how it will look on your page."}</span><Button size="sm" color="secondary" className="rounded-full" iconLeading={Trash01} onPress={() => { setCover({ kind: "none", src: "" }); setCoverError(""); }}>Remove</Button></div></div>
                            )}
                        </div>
                        <div className="flex flex-col gap-1.5"><span className="text-sm font-semibold text-ink-2">Description</span>
                            <DescriptionEditor value={story} onChange={setStory} />
                            <p className="text-sm text-tertiary">Type / for headings, lists, quotes, images and links. A strong story says who is helped, what a gift buys and why now.</p></div>
                    </>}

                    {step === 5 && <>
                        <StepHead title="What should we call it?" sub="Shown wherever your page is shared." />
                        <Input label="Title" isRequired placeholder="e.g. Clean water for 40 villages" value={title} onChange={(v) => { setTitle(v); if (tried) setTried(0); }} isInvalid={tried === 5 && !title.trim()} />
                        <Input label="Page address" placeholder={slugify(title) || "your-page"} value={slug} onChange={(v) => setSlug(slugify(v))} hint={`${window.location.host}${href({ name: "page", key: path })}`} />
                        <div className="flex flex-col gap-2"><div><span className="text-sm font-semibold text-ink-2">Causes</span><p className="text-sm text-ink-3">Up to three. They tag the page in search and on the board. {causes.length}/3 chosen.</p></div>
                            <div role="group" aria-label="Causes" className="flex flex-wrap gap-2">{CAUSES.map((c) => { const on = causes.includes(c); return <button key={c} type="button" aria-pressed={on} disabled={!on && causes.length >= 3} onClick={() => toggleCause(c)} className={pill(on)}>{c}</button>; })}</div>
                        </div>
                    </>}

                    {step === 6 && <>
                        <StepHead title="Choose a layout" sub="All 12 layouts hold the same sections. Only the arrangement changes, and you can switch any time." />
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{LAYOUTS.map((l) => {
                            const on = l.id === layout;
                            return (
                                <button key={l.id} type="button" aria-pressed={on} onClick={() => setLayout(l.id)} className={cx("flex cursor-pointer flex-col gap-2 rounded-3xl bg-tint-1 p-2.5 text-left outline-focus-ring transition duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-2 focus-visible:outline-offset-2", on ? "ring-2 ring-ink" : "hover:bg-tint-2")}>
                                    <span className="relative block"><LayoutThumb id={l.id} />{on && <Tick className="absolute top-1.5 right-1.5 size-5" />}</span>
                                    <span className="flex flex-wrap items-center justify-between gap-1.5"><span className="font-semibold text-ink">{l.name}</span>{l.types.includes(type) && <Badge type="pill-color" color="gray" size="sm">Suggested</Badge>}</span>
                                    <span className="text-xs text-ink-3">{l.desc}</span>
                                </button>
                            );
                        })}</div>
                    </>}

                    {step === 7 && <>
                        <StepHead title="Review and publish" sub="Check each part, then publish." />
                        <div className="rounded-3xl bg-tint-1 px-1">{([["Type", t.label, 1, true], ["Charity", orgName || "Not added", 2, !!orgName], ["Country", country, 2, true], ...(type === "team" && (parentRow || joinId) ? [["Joins", parentRow?.title ?? joinable.find((r) => r.id === joinId)?.title ?? "", 2, true]] : []), ["Goal", `${money(goal)}${endDate ? ` by ${endDate}` : ""}${showGoal ? "" : " (hidden)"}`, 3, true], ["Gift buttons", gifts.map((g) => money(g)).join(", "), 3, true], ["Cover", !hasCover ? "No cover yet" : cover.kind === "youtube" ? "YouTube video" : cover.kind === "video" ? "Video" : "Image", 4, hasCover], ["Story", hasStory ? `${story.replace(/<[^>]*>/g, " ").trim().split(/\s+/).length} words` : "Not written yet", 4, hasStory], ["Title", title || "Missing", 5, !!title], ["Address", `/${path}`, 5, true], ["Causes", causes.join(", ") || "None chosen", 5, true], ["Layout", L.name, 6, true]] as [string, string, number, boolean][]).map(([label, value, n, ok]) => (
                            <div key={label} className="flex items-center gap-3 border-b border-hairline px-4 py-3 last:border-b-0">
                                <span className="w-20 shrink-0 text-sm text-ink-3">{label}</span>
                                <span className="min-w-0 flex-1 truncate font-medium text-ink">{value}</span>
                                {!ok && <Badge type="pill-color" color={label === "Title" || label === "Charity" ? "error" : "gray"} size="sm">{label === "Title" || label === "Charity" ? "Required" : "Optional"}</Badge>}
                                <Button size="sm" color="secondary" className="rounded-full" onPress={() => setStep(n)}>Edit</Button>
                            </div>
                        ))}</div>
                        <Checkbox size="md" isSelected={agree} onChange={setAgree} label={<>I agree to the Outgive <a href="/terms" target="_blank" rel="noopener" className="underline underline-offset-2">terms</a> and <a href="/privacy" target="_blank" rel="noopener" className="underline underline-offset-2">privacy policy</a></>} />
                        {!user && !isDemo && <div className="rounded-3xl bg-tint-1 p-5"><SignIn next={window.location.pathname + window.location.search} title="Sign in to publish" sub="Your draft is saved in this browser. After signing in you come straight back here." /></div>}
                        {missing.length > 0 && <p className="text-sm text-error-primary">To publish, add {missing.join(" and ")}.</p>}
                        {publishError && <p className="text-sm text-error-primary">{publishError}</p>}
                    </>}

                    {live && <>
                        <StepHead title={`Your ${t.label.toLowerCase()} page is live`} sub="Share it to get your first gift." />
                        <div className="flex flex-wrap items-center gap-4 rounded-3xl bg-tint-1 p-5">
                            <FeaturedIcon icon={Check} color="brand" theme="dark" size="lg" />
                            <div className="min-w-0 flex-1"><div className="truncate text-lg font-semibold text-ink">{url.replace(/^https?:\/\//, "")}</div><div className="text-sm text-ink-3">Published just now · {L.name} layout</div></div>
                            <Button size="md" color="secondary" className="rounded-full" iconLeading={Copy01} onPress={copy}>{copied ? "Copied" : "Copy link"}</Button>
                            <Button size="md" color="primary" className="rounded-full" iconLeading={Eye} onPress={() => go({ name: "page", key })}>View page</Button>
                        </div>
                        <div className="flex flex-col gap-2.5">{([[Share07, "Share your page", "A link, a QR code and your social apps", "Share", () => setShareOpen(true)], [Users01, "Invite fundraisers or a team", "Each one gets a page under yours", "Invite", () => setShareOpen(true)], [Trophy01, "Climb the leaderboard", "Every gift on this page counts toward your rank", "View leaderboard", () => go({ name: "home" })]] as const).map(([icon, a, b, cta, act]) => (
                            <div key={a} className="flex flex-wrap items-center gap-3 rounded-3xl bg-tint-1 p-4">
                                <FeaturedIcon icon={icon} color="gray" theme="modern" size="md" />
                                <div className="min-w-48 flex-1"><div className="font-semibold text-ink">{a}</div><div className="text-sm text-ink-3">{b}</div></div>
                                <Button size="sm" color="secondary" className="rounded-full" onPress={act}>{cta}</Button>
                            </div>
                        ))}</div>
                    </>}
                </div></div>

                <div className="z-10 shrink-0 border-t border-hairline bg-primary px-5 py-4 md:px-12"><div className="mx-auto flex max-w-2xl items-center gap-3">
                    {step > 1 && !live && <>
                        <Button size="xl" color="secondary" iconLeading={ArrowLeft} className="rounded-full max-sm:hidden" onPress={() => setStep((s) => s - 1)}>Back</Button>
                        <Button size="xl" color="secondary" iconLeading={ArrowLeft} aria-label="Back" className="rounded-full sm:hidden" onPress={() => setStep((s) => s - 1)} />
                    </>}
                    {tried === step && needs(step) ? <p role="alert" className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-medium text-error-primary"><AlertCircle className="size-4 shrink-0" />{needs(step)}</p> : <span className="flex-1 max-sm:hidden" />}
                    {step === 4 && <Button size="xl" color="tertiary" className="rounded-full" onPress={next}><span className="max-sm:hidden">Skip for now</span><span className="sm:hidden">Skip</span></Button>}
                    {!live && <Button size="xl" color="primary" iconTrailing={step === 7 ? undefined : ArrowRight} isDisabled={(step === 7 && missing.length > 0) || busy} onPress={next} className="rounded-full max-sm:flex-1">{step === 7 ? (busy ? "Publishing…" : "Publish") : "Continue"}</Button>}
                    {live && <Button size="xl" color="secondary" className="rounded-full" onPress={() => go({ name: "home" })}>Go to the leaderboard</Button>}
                </div></div>
            </main>

            <aside className="hidden w-[26rem] shrink-0 flex-col justify-center overflow-y-auto bg-tint-1 p-8 xl:flex 2xl:w-[30rem]">
                <div className="mx-auto flex w-full max-w-md flex-col gap-4">
                    <div className="flex items-center justify-between"><span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Live preview</span><span className="text-sm font-semibold text-ink-2">{L.name} layout</span></div>
                    <div className="overflow-hidden rounded-3xl bg-raised shadow-lift">
                        <div className="flex items-center gap-1.5 border-b border-hairline px-4 py-3"><span className="size-2.5 rounded-full bg-tint-3" /><span className="size-2.5 rounded-full bg-tint-3" /><span className="size-2.5 rounded-full bg-tint-3" /><span className="ml-2 flex-1 truncate rounded-full bg-tint-2 px-3 py-1 text-xs text-ink-3">{window.location.host}{href({ name: "page", key: key || path })}</span></div>
                        <div className="flex flex-col gap-3.5 p-5">
                            {hasCover ? <CoverMedia cover={cover} className="aspect-video w-full" /> : <LayoutThumb id={layout} className="h-56" />}
                            <div className="flex flex-wrap gap-2"><Badge type="pill-color" color="gray" size="sm">{t.label}</Badge>{causes.map((c) => <Badge key={c} type="pill-color" color="gray" size="sm">{c}</Badge>)}</div>
                            <div className="text-display-xs leading-[0.95] font-extrabold tracking-[-0.045em] text-ink">{page.title}</div>
                            {showGoal && <><div><span className="font-bubble text-lg font-bold text-ink tabular-nums">{money(0)}</span> <span className="text-ink-3">raised of {money(goal)}</span></div><ProgressBarBase value={0} /></>}
                            <div className="rounded-full bg-cta shadow-press hover:bg-cta-hover py-2.5 text-center font-semibold text-cta-ink">{t.cta}</div>
                        </div>
                    </div>
                    <div className="rounded-2xl bg-raised px-4 py-3.5 shadow-edge"><div className="font-semibold text-ink">{TIPS[step - 1][0]}</div><div className="text-sm text-ink-3">{TIPS[step - 1][1]}</div></div>
                </div>
            </aside>
            </div>
            <ShareDialog isOpen={shareOpen} onClose={() => setShareOpen(false)} url={url} title={page.title} />
        </div>
    );
};
