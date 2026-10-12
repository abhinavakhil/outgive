import { type ReactNode, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Copy01, Eye, Share07, Trash01, Trophy01, Users01 } from "@untitledui/icons";
import { FileUpload } from "@/components/application/file-upload/file-upload-base";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import { ProgressBarBase } from "@/components/base/progress-indicators/progress-indicators";
import { NativeSelect } from "@/components/base/select/select-native";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { ShareDialog } from "@/components/outgive/dialogs";
import { CoverMedia, DescriptionEditor, readImage, youtubeId } from "@/components/outgive/media";
import { LayoutThumb, Logo, ThemeToggle, useApp } from "@/components/outgive/shared";
import { CAUSES, CURRENCIES, DEFAULT_ALLOCATION, type Cover, LAYOUTS, PAGE_TYPES, PREFIX, type LayoutId, type PageData, type PageType } from "@/data";
import { cx } from "@/utils/cx";

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
const chip = (on: boolean) => cx("h-11 cursor-pointer rounded-full px-5 text-md font-semibold ring-1 ring-inset outline-focus-ring focus-visible:outline-2", on ? "bg-brand-solid text-white ring-transparent" : "bg-primary text-secondary ring-primary hover:bg-secondary");

const Tick = ({ className }: { className?: string }) => (<span className={cx("flex size-6 items-center justify-center rounded-full bg-brand-solid text-white", className)}><Check className="size-3.5 stroke-[3px]" /></span>);
const StepHead = ({ title, sub }: { title: string; sub: string }) => (<div><h1 className="text-display-xs font-semibold tracking-tight text-primary md:text-display-md">{title}</h1><p className="mt-2 text-lg text-tertiary">{sub}</p></div>);
const Row = ({ children }: { children: ReactNode }) => <div className="grid gap-5 sm:grid-cols-2">{children}</div>;
const Seg = ({ items, value, onChange, label }: { items: [string, string][]; value: string; onChange: (v: string) => void; label: string }) => (
    <div role="group" aria-label={label} className="flex w-full gap-1 rounded-full bg-secondary p-1 ring-1 ring-secondary ring-inset sm:w-fit">
        {items.map(([id, name]) => <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)} className={cx("h-11 flex-1 cursor-pointer rounded-full px-5 text-md font-semibold outline-focus-ring transition focus-visible:outline-2 sm:flex-none", value === id ? "bg-brand-solid text-white shadow-xs" : "text-tertiary hover:text-primary")}>{name}</button>)}
    </div>
);

export const CreateFlow = ({ onPublish }: { onPublish: (p: PageData) => string }) => {
    const { go, money, currency, setCurrency } = useApp();
    const [step, setStep] = useState(1); // 1 to 7, then 8 = live
    const [type, setType] = useState<PageType>("fundraiser");
    const [org, setOrg] = useState("");
    const [country, setCountry] = useState("India");
    const [d, setD] = useState<Record<string, string>>({});
    const [goal, setGoal] = useState(5000);
    const [gifts, setGifts] = useState([10, 25, 50, 100]);
    const [endDate, setEndDate] = useState("");
    const [showGoal, setShowGoal] = useState(true);
    const [alloc, setAlloc] = useState<[string, number][]>(DEFAULT_ALLOCATION);
    const [autoGoal, setAutoGoal] = useState(false);
    const [story, setStory] = useState("");
    const [cover, setCover] = useState<Cover>({ kind: "none", src: "" });
    const [coverTab, setCoverTab] = useState<"image" | "video" | "youtube">("image");
    const [coverError, setCoverError] = useState("");
    const [title, setTitle] = useState("");
    const [slug, setSlug] = useState("");
    const [causes, setCauses] = useState<string[]>([]);
    const [layout, setLayout] = useState<LayoutId>("classic");
    const [agree, setAgree] = useState(false);
    const [copied, setCopied] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);
    const [key, setKey] = useState("");

    const t = PAGE_TYPES.find((x) => x.id === type)!;
    const L = LAYOUTS.find((x) => x.id === layout)!;
    const address = slug || slugify(title) || "your-page";
    const path = `${PREFIX[type]}/${address}`;
    const live = step === 8;
    const rate = CURRENCIES[currency];
    const hasStory = story.replace(/<[^>]*>/g, "").trim().length > 0;
    const hasCover = cover.kind === "image" || cover.kind === "video" || (cover.kind === "youtube" && !!youtubeId(cover.src));
    const missing = [!title.trim() && "a title", !agree && "your agreement to the terms"].filter(Boolean) as string[];
    const page: PageData = { type, slug: address, title: title.trim() || "[Your title]", org: org.trim() || "[Your charity]", country, goal, raised: 0, supporters: 0, story, cover: hasCover ? cover : { kind: "none", src: "" }, layout, isSample: false, causes, details: { ...d, Charity: org.trim() }, gifts, endDate, showGoal, created: Date.now(), donations: [], updates: [], allocation: alloc.filter(([l, v]) => l.trim() && v > 0) };
    const url = `${window.location.origin}/${key || path}`;

    const next = () => {
        if (step === 7) { if (missing.length) return; setKey(onPublish({ ...page, org: org.trim() || "Independent organiser" })); }
        setStep((s) => Math.min(8, s + 1));
        window.scrollTo(0, 0);
    };
    const toggleCause = (c: string) => setCauses((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : cs.length < 3 ? [...cs, c] : cs));
    const toggleGift = (g: number) => setGifts((gs) => (gs.includes(g) ? (gs.length > 1 ? gs.filter((x) => x !== g) : gs) : gs.length < 4 ? [...gs, g].sort((a, b) => a - b) : gs));
    const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); } };
    const pickImage = async (files: FileList) => {
        setCoverError("");
        try { setCover({ kind: "image", src: await readImage(files[0]) }); } catch (e) { setCoverError((e as Error).message); }
    };
    const pickVideo = (files: FileList) => { setCoverError(""); setCover({ kind: "video", src: URL.createObjectURL(files[0]) }); };
    const setLink = (v: string) => { setCover({ kind: "youtube", src: v }); setCoverError(v && !youtubeId(v) ? "That doesn't look like a YouTube link." : ""); };

    const I = (label: string, k: string, props: { placeholder?: string; type?: string } = {}) => <Input label={label} value={d[k] ?? ""} onChange={(v) => setD((o) => ({ ...o, [k]: v }))} {...props} />;
    const Sel = (label: string, k: string, opts: string[]) => <NativeSelect label={label} value={d[k] ?? opts[0]} onChange={(e) => setD((o) => ({ ...o, [k]: e.target.value }))} options={opts.map((o) => ({ label: o, value: o }))} />;
    const charity = <Input label={type === "team" ? "Charity the team raises for" : "Charity"} placeholder="Search registered charities" value={org} onChange={setOrg} />;
    const countrySel = <NativeSelect label="Country" options={COUNTRIES} value={country} onChange={(e) => setCountry(e.target.value)} />;

    return (
        <div className="flex min-h-dvh flex-col bg-primary lg:h-dvh lg:overflow-hidden">
            <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-secondary px-5 md:px-8">
                <Logo onClick={() => go({ name: "home" })} />
                <span className="text-sm font-semibold whitespace-nowrap text-primary lg:hidden">{live ? "Published" : <>Step {step} of 7 <span className="font-medium text-tertiary max-sm:hidden">· {STEPS[step - 1]}</span></>}</span>
                <div className="flex items-center gap-1"><ThemeToggle /><Button color="secondary" size="md" className="rounded-full" onPress={() => go({ name: "home" })}><span className="max-sm:hidden">Save and exit</span><span className="sm:hidden">Exit</span></Button></div>
            </header>

            <div className="flex min-h-0 flex-1">
                <nav aria-label="Steps" className="hidden w-72 shrink-0 flex-col gap-1 overflow-y-auto border-r border-secondary p-6 lg:flex">
                    <span className="px-3 pb-3 text-xs font-semibold tracking-widest text-tertiary uppercase">{live ? "Published" : "Create a page"}</span>
                    {STEPS.map((name, i) => {
                        const n = i + 1; const done = live || n < step; const here = n === step && !live;
                        return (
                            <button key={name} type="button" aria-current={here ? "step" : undefined} disabled={live} onClick={() => setStep(n)} className={cx("flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left outline-focus-ring transition focus-visible:outline-2 disabled:cursor-default", here ? "bg-brand-primary" : "hover:bg-secondary")}>
                                <span className={cx("flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold", done ? "bg-brand-solid text-white" : here ? "bg-primary text-brand-secondary ring-2 ring-brand" : "bg-secondary text-tertiary ring-1 ring-secondary ring-inset")}>{done ? <Check className="size-4 stroke-[3px]" /> : n}</span>
                                <span className="min-w-0"><span className={cx("block text-md font-semibold", here ? "text-primary" : "text-secondary")}>{name}</span><span className="block truncate text-xs text-tertiary">{STEP_HINTS[i]}</span></span>
                            </button>
                        );
                    })}
                </nav>

            <main className="flex min-h-0 min-w-0 flex-1 flex-col">
                <div className="flex gap-1.5 px-5 pt-3 lg:hidden">{STEPS.map((s, i) => <span key={s} className={cx("h-1.5 flex-1 rounded-full", i + 1 <= step ? "bg-brand-solid" : "bg-tertiary")} />)}</div>
                <div className="flex-1 px-5 py-8 md:px-12 md:py-12 lg:min-h-0 lg:overflow-y-auto"><div className="form-xl mx-auto flex max-w-2xl flex-col gap-8">
                    {step === 1 && <>
                        <StepHead title="What are you setting up?" sub="Every type uses the same seven steps. Only step 2 changes." />
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{PAGE_TYPES.map((pt) => {
                            const on = pt.id === type;
                            return (
                                <button key={pt.id} type="button" aria-pressed={on} onClick={() => setType(pt.id)} className={cx("flex cursor-pointer flex-col gap-2.5 rounded-2xl bg-primary p-2 text-left outline-focus-ring transition focus-visible:outline-2 focus-visible:outline-offset-2", on ? "shadow-md ring-2 ring-brand" : "ring-1 ring-secondary hover:bg-primary_hover")}>
                                    <span className={cx("relative flex h-[4.5rem] items-center justify-center rounded-lg sm:h-24", pt.tile)}><pt.icon className="size-9 text-gray-900" />{on && <Tick className="absolute top-2 right-2" />}</span>
                                    <span className="flex flex-col gap-0.5 px-2 pb-2"><span className="text-md font-semibold text-primary">{pt.label}</span><span className="text-sm text-tertiary">{pt.desc}</span></span>
                                </button>
                            );
                        })}</div>
                    </>}

                    {step === 2 && <>
                        <StepHead title={t.detailTitle} sub="This is the only step that differs between page types." />
                        {type === "fundraiser" && <>{charity}<Row>{Sel("Occasion", "Occasion", ["Just because", "Birthday", "Wedding", "Sporting event", "Religious giving"])}{countrySel}</Row></>}
                        {type === "campaign" && <>{charity}<Row>{I("Registration number", "Registration number", { placeholder: "From your national regulator" })}{countrySel}</Row><Checkbox size="md" isSelected={d["Supporter fundraisers"] !== "Not allowed"} onChange={(v) => setD((o) => ({ ...o, "Supporter fundraisers": v ? "Allowed" : "Not allowed" }))} label="Let supporters start their own fundraisers for this campaign" /></>}
                        {type === "team" && <>{I("Team name", "Team name", { placeholder: "e.g. Harbour Runners" })}{charity}<Row>{I("Campaign or challenge to join", "Joins", { placeholder: "Search by name" })}{I("Members you are aiming for", "Target members", { placeholder: "10", type: "number" })}</Row>{countrySel}</>}
                        {type === "challenge" && <><Row>{Sel("Activity", "Activity", ["Walk", "Run", "Cycle", "Swim", "Fast", "Something else"])}<div className="grid grid-cols-2 gap-3">{I("Target", "Target", { placeholder: "100", type: "number" })}{Sel("Unit", "Unit", ["km", "miles", "steps", "days", "hours"])}</div></Row><Row>{I("Starts", "Starts", { type: "date" })}{I("Ends", "Ends", { type: "date" })}</Row>{charity}{countrySel}</>}
                        {type === "event" && <><Row>{I("Date and time", "When", { type: "datetime-local" })}{Sel("Where", "Format", ["In person", "Online", "Both"])}</Row>{I("Venue or link", "Venue", { placeholder: "Address or stream link" })}<Row>{Sel("Tickets", "Tickets", ["Free, donations welcome", "Paid tickets", "No tickets"])}{I("Capacity", "Capacity", { placeholder: "120", type: "number" })}</Row>{charity}{countrySel}</>}
                        {type === "memory" && <>{I("Who is this in memory of?", "In memory of", { placeholder: "Their name" })}<Row>{I("Born", "Born", { type: "date" })}{I("Died", "Died", { type: "date" })}</Row>{charity}{countrySel}</>}
                    </>}

                    {step === 3 && <>
                        <StepHead title="What are you aiming to raise?" sub="Shown as a progress bar on your page. You can change it later." />
                        <div className="flex flex-col gap-3 rounded-2xl bg-brand-primary p-5">
                            <span className="text-xs font-semibold tracking-widest text-brand-secondary uppercase">Your goal</span>
                            <label className="flex items-baseline gap-2"><span className="text-display-sm font-semibold text-tertiary">{currency}</span>
                                <input aria-label={`Goal in ${currency}`} type="number" min={1} inputMode="numeric" value={Math.round(goal * rate)} onChange={(e) => { const n = Number(e.target.value); if (n > 0) setGoal(Math.max(1, Math.round(n / rate))); }} className="w-full min-w-0 bg-transparent text-display-lg font-semibold tracking-tight text-brand-secondary tabular-nums outline-hidden md:text-display-xl" /></label>
                            <div className="flex flex-wrap gap-2">{GOALS.map((g) => <button key={g} type="button" aria-pressed={goal === g} onClick={() => setGoal(g)} className={chip(goal === g)}>{money(g)}</button>)}</div>
                        </div>
                        <Row><NativeSelect label="Currency" options={Object.keys(CURRENCIES).map((c) => ({ label: c, value: c }))} value={currency} onChange={(e) => setCurrency(e.target.value)} /><Input label="Goal end date (optional)" type="date" value={endDate} onChange={setEndDate} /></Row>
                        <div className="flex flex-col gap-2"><div><span className="text-sm font-medium text-secondary">Suggested gift amounts</span><p className="text-sm text-tertiary">Pick up to 4. These are the buttons on your donate card.</p></div>
                            <div className="flex flex-wrap gap-2">{GIFT_CHOICES.map((g) => <button key={g} type="button" aria-pressed={gifts.includes(g)} onClick={() => toggleGift(g)} className={chip(gifts.includes(g))}>{money(g)}</button>)}</div></div>
                        <div className="flex flex-col gap-3"><div><span className="text-sm font-medium text-secondary">Where the money goes</span><p className="text-sm text-tertiary">Donors trust a page that says how gifts are spent. Shown as a bar on your page.</p></div>
                            {alloc.map(([label, v], i) => <div key={i} className="grid grid-cols-[1fr_8rem] gap-3"><Input aria-label={`Use ${i + 1}`} value={label} onChange={(x) => setAlloc((a) => a.map((r, j) => (j === i ? [x, r[1]] : r)))} /><Input aria-label={`Percent ${i + 1}`} type="number" value={String(v)} onChange={(x) => setAlloc((a) => a.map((r, j) => (j === i ? [r[0], Math.max(0, Number(x) || 0)] : r)))} /></div>)}
                            <p className={cx("text-sm", alloc.reduce((n, [, v]) => n + v, 0) === 100 ? "text-tertiary" : "text-warning-primary")}>Adds up to {alloc.reduce((n, [, v]) => n + v, 0)}%{alloc.reduce((n, [, v]) => n + v, 0) === 100 ? "" : ". We scale it to 100% on your page."}</p></div>
                        <div className="flex flex-col gap-3"><Checkbox size="md" isSelected={showGoal} onChange={setShowGoal} label="Show the goal and progress bar on my page" /><Checkbox size="md" isSelected={autoGoal} onChange={setAutoGoal} label="Raise the goal automatically when it is reached" /></div>
                    </>}

                    {step === 4 && <>
                        <StepHead title="Add a cover and tell the story" sub="A photo or video catches the eye. The story is why someone should give." />
                        <div className="flex flex-col gap-3">
                            <span className="text-sm font-medium text-secondary">Cover</span>
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
                        <div className="flex flex-col gap-1.5"><span className="text-sm font-medium text-secondary">Description</span>
                            <DescriptionEditor value={story} onChange={setStory} />
                            <p className="text-sm text-tertiary">Type / for headings, lists, quotes, images and links. A strong story says who is helped, what a gift buys and why now.</p></div>
                    </>}

                    {step === 5 && <>
                        <StepHead title="What should we call it?" sub="Shown wherever your page is shared." />
                        <Input label="Title" isRequired placeholder="e.g. Clean water for 40 villages" value={title} onChange={setTitle} />
                        <Input label="Page address" placeholder={slugify(title) || "your-page"} value={slug} onChange={(v) => setSlug(slugify(v))} hint={`outgive.org/${path}`} />
                        <div className="flex flex-col gap-2"><span className="text-sm font-medium text-secondary">Causes · choose up to 3 ({causes.length}/3)</span>
                            <div className="flex flex-wrap gap-2">{CAUSES.slice(0, 10).map((c) => <Button key={c} size="lg" color={causes.includes(c) ? "primary" : "secondary"} className="rounded-full" onPress={() => toggleCause(c)}>{c}</Button>)}</div>
                        </div>
                    </>}

                    {step === 6 && <>
                        <StepHead title="Choose a layout" sub="All 12 layouts hold the same sections. Only the arrangement changes, and you can switch any time." />
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{LAYOUTS.map((l) => {
                            const on = l.id === layout;
                            return (
                                <button key={l.id} type="button" aria-pressed={on} onClick={() => setLayout(l.id)} className={cx("flex cursor-pointer flex-col gap-2 rounded-2xl bg-primary p-2.5 text-left outline-focus-ring transition focus-visible:outline-2 focus-visible:outline-offset-2", on ? "shadow-md ring-2 ring-brand" : "ring-1 ring-secondary hover:bg-primary_hover")}>
                                    <span className="relative block"><LayoutThumb id={l.id} />{on && <Tick className="absolute top-1.5 right-1.5 size-5" />}</span>
                                    <span className="flex flex-wrap items-center justify-between gap-1.5"><span className="font-semibold text-primary">{l.name}</span>{l.types.includes(type) && <Badge type="pill-color" color="brand" size="sm">Suggested</Badge>}</span>
                                    <span className="text-xs text-tertiary">{l.desc}</span>
                                </button>
                            );
                        })}</div>
                    </>}

                    {step === 7 && <>
                        <StepHead title="Review and publish" sub="Check each part, then publish." />
                        <div className="rounded-2xl ring-1 ring-secondary ring-inset">{([["Type", t.label, 1, true], ["Charity", org || "Not added", 2, !!org], ["Goal", `${money(goal)}${endDate ? ` by ${endDate}` : ""}`, 3, true], ["Cover", !hasCover ? "No cover yet" : cover.kind === "youtube" ? "YouTube video" : cover.kind === "video" ? "Video" : "Image", 4, hasCover], ["Story", hasStory ? `${story.replace(/<[^>]*>/g, " ").trim().split(/\s+/).length} words` : "Not written yet", 4, hasStory], ["Title", title || "Missing", 5, !!title], ["Address", `/${path}`, 5, true], ["Layout", L.name, 6, true]] as [string, string, number, boolean][]).map(([label, value, n, ok]) => (
                            <div key={label} className="flex items-center gap-3 border-b border-secondary px-4 py-3 last:border-b-0">
                                <span className="w-20 shrink-0 text-sm text-tertiary">{label}</span>
                                <span className="min-w-0 flex-1 truncate font-medium text-primary">{value}</span>
                                {!ok && <Badge type="pill-color" color={label === "Title" ? "error" : "warning"} size="sm">{label === "Title" ? "Required" : "Optional"}</Badge>}
                                <Button size="sm" color="secondary" className="rounded-full" onPress={() => setStep(n)}>Edit</Button>
                            </div>
                        ))}</div>
                        <Checkbox size="md" isSelected={agree} onChange={setAgree} label={<>I agree to the Outgive <a href="/terms" target="_blank" rel="noopener" className="underline underline-offset-2">terms</a> and <a href="/privacy" target="_blank" rel="noopener" className="underline underline-offset-2">privacy policy</a></>} />
                        {missing.length > 0 && <p className="text-sm text-error-primary">To publish, add {missing.join(" and ")}.</p>}
                    </>}

                    {live && <>
                        <StepHead title={`Your ${t.label.toLowerCase()} page is live`} sub="Share it to get your first gift." />
                        <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-brand-primary p-5">
                            <FeaturedIcon icon={Check} color="brand" theme="dark" size="lg" />
                            <div className="min-w-0 flex-1"><div className="truncate text-lg font-semibold text-primary">outgive.org/{key}</div><div className="text-sm text-tertiary">Published just now · {L.name} layout</div></div>
                            <Button size="md" color="secondary" className="rounded-full" iconLeading={Copy01} onPress={copy}>{copied ? "Copied" : "Copy link"}</Button>
                            <Button size="md" color="primary" className="rounded-full" iconLeading={Eye} onPress={() => go({ name: "page", key })}>View page</Button>
                        </div>
                        <div className="flex flex-col gap-2.5">{([[Share07, "Share your page", "A link, a QR code and your social apps", "Share", () => setShareOpen(true)], [Users01, "Invite fundraisers or a team", "Each one gets a page under yours", "Invite", () => setShareOpen(true)], [Trophy01, "Climb the leaderboard", "Every gift on this page counts toward your rank", "View leaderboard", () => go({ name: "home" })]] as const).map(([icon, a, b, cta, act]) => (
                            <div key={a} className="flex flex-wrap items-center gap-3 rounded-2xl bg-primary p-4 shadow-xs ring-1 ring-secondary ring-inset">
                                <FeaturedIcon icon={icon} color="gray" theme="modern" size="md" />
                                <div className="min-w-48 flex-1"><div className="font-semibold text-primary">{a}</div><div className="text-sm text-tertiary">{b}</div></div>
                                <Button size="sm" color="secondary" className="rounded-full" onPress={act}>{cta}</Button>
                            </div>
                        ))}</div>
                    </>}
                </div></div>

                <div className="z-10 shrink-0 border-t border-secondary bg-primary px-5 py-4 md:px-12"><div className="mx-auto flex max-w-2xl items-center gap-3">
                    {step > 1 && !live && <>
                        <Button size="xl" color="secondary" iconLeading={ArrowLeft} className="rounded-full max-sm:hidden" onPress={() => setStep((s) => s - 1)}>Back</Button>
                        <Button size="xl" color="secondary" iconLeading={ArrowLeft} aria-label="Back" className="rounded-full sm:hidden" onPress={() => setStep((s) => s - 1)} />
                    </>}
                    <span className="flex-1 max-sm:hidden" />
                    {step === 4 && <Button size="xl" color="tertiary" className="rounded-full" onPress={next}><span className="max-sm:hidden">Skip for now</span><span className="sm:hidden">Skip</span></Button>}
                    {!live && <Button size="xl" color="primary" iconTrailing={step === 7 ? undefined : ArrowRight} isDisabled={step === 7 && missing.length > 0} onPress={next} className="rounded-full max-sm:flex-1">{step === 7 ? "Publish" : "Continue"}</Button>}
                    {live && <Button size="xl" color="secondary" className="rounded-full" onPress={() => go({ name: "home" })}>Go to the leaderboard</Button>}
                </div></div>
            </main>

            <aside className="hidden w-[26rem] shrink-0 flex-col justify-center overflow-y-auto border-l border-secondary bg-secondary p-8 xl:flex 2xl:w-[30rem]">
                <div className="mx-auto flex w-full max-w-md flex-col gap-4">
                    <div className="flex items-center justify-between"><span className="text-xs font-semibold tracking-widest text-brand-secondary uppercase">Live preview</span><span className="text-sm font-medium text-secondary">{L.name} layout</span></div>
                    <div className="overflow-hidden rounded-2xl bg-primary shadow-xl ring-1 ring-secondary">
                        <div className="flex items-center gap-1.5 bg-secondary px-4 py-3"><span className="size-2.5 rounded-full bg-quaternary" /><span className="size-2.5 rounded-full bg-quaternary" /><span className="size-2.5 rounded-full bg-quaternary" /><span className="ml-2 flex-1 truncate rounded-full bg-primary px-3 py-1 text-xs text-tertiary">outgive.org/{key || path}</span></div>
                        <div className="flex flex-col gap-3.5 p-5">
                            {hasCover ? <CoverMedia cover={cover} className="aspect-video w-full" /> : <LayoutThumb id={layout} className="h-56" />}
                            <div className="flex flex-wrap gap-2"><Badge type="pill-color" color="brand" size="sm">{t.label}</Badge>{causes.map((c) => <Badge key={c} type="pill-color" color="gray" size="sm">{c}</Badge>)}</div>
                            <div className="text-display-xs font-semibold tracking-tight text-primary">{page.title}</div>
                            {showGoal && <><div><span className="text-lg font-semibold text-brand-secondary">{money(0)}</span> <span className="text-tertiary">raised of {money(goal)}</span></div><ProgressBarBase value={0} /></>}
                            <div className="rounded-full bg-brand-solid py-2.5 text-center font-semibold text-white">{t.cta}</div>
                        </div>
                    </div>
                    <div className="rounded-xl bg-primary/70 px-4 py-3.5"><div className="font-semibold text-primary">{TIPS[step - 1][0]}</div><div className="text-sm text-tertiary">{TIPS[step - 1][1]}</div></div>
                </div>
            </aside>
            </div>
            <ShareDialog isOpen={shareOpen} onClose={() => setShareOpen(false)} url={url} title={page.title} />
        </div>
    );
};
