import { useEffect, useState } from "react";
import { Penna } from "@abhinavakhil/penna-react";
import type { Cover } from "@/data";
import { cx } from "@/utils/cx";

/** Tracks the `dark-mode` class the theme toggle puts on <html>. */
export const useDark = () => {
    const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark-mode"));
    useEffect(() => {
        const el = document.documentElement;
        const obs = new MutationObserver(() => setDark(el.classList.contains("dark-mode")));
        obs.observe(el, { attributes: true, attributeFilter: ["class"] });
        return () => obs.disconnect();
    }, []);
    return dark;
};

/** The video id from a youtube.com/watch, youtu.be, /shorts, /embed or /live link, or "" if the link isn't one. */
export const youtubeId = (url: string) => {
    try {
        const u = new URL(/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`);
        const host = u.hostname.replace(/^(www|m)\./, "");
        let id = "";
        if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
        else if (host === "youtube.com" || host === "youtube-nocookie.com") id = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1] ?? "";
        return /^[\w-]{11}$/.test(id) ? id : "";
    } catch { return ""; }
};

/** Reads an image file and shrinks it so a published page stays small enough to keep in the browser. */
export const readImage = (file: File, max = 1600) =>
    new Promise<string>((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const k = Math.min(1, max / Math.max(img.width, img.height));
            const c = document.createElement("canvas");
            c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
            c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
            URL.revokeObjectURL(url);
            resolve(c.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file could not be read as an image.")); };
        img.src = url;
    });

/** The description editor: Penna with its toolbar, slash menu and bubble menu. */
export const DescriptionEditor = ({ value, onChange }: { value: string; onChange: (html: string) => void }) => {
    const dark = useDark();
    return (
        <div className="overflow-hidden rounded-2xl ring-1 ring-primary ring-inset focus-within:ring-2 focus-within:ring-brand [&_.pn-editor]:min-h-64">
            <Penna value={value} onChange={({ html }) => onChange(html)} theme={dark ? "dark" : "light"} placeholder="We support [who you help] in [place]. Your gift pays for [what it buys]." statusBar={false} />
        </div>
    );
};

/** A saved description, shown read-only with the same typography it was written in. */
export const DescriptionView = ({ html, className }: { html: string; className?: string }) => {
    const dark = useDark();
    return <div className={className}><Penna value={html} readonly toolbar={false} bubbleMenu={false} slashMenu={false} dragHandle={false} statusBar={false} borderless theme={dark ? "dark" : "light"} /></div>;
};

/** The cover as the visitor sees it: the photo, the uploaded video, the YouTube player, or a soft placeholder. */
export const CoverMedia = ({ cover, className }: { cover: Cover; className?: string }) => {
    const box = cx("relative overflow-hidden rounded-2xl bg-secondary ring-1 ring-secondary ring-inset", className);
    if (cover.kind === "image" && cover.src) return <div className={box}><img src={cover.src} alt="" className="size-full object-cover" /></div>;
    if (cover.kind === "video" && cover.src) return <div className={box}><video src={cover.src} controls playsInline className="size-full bg-black object-cover" /></div>;
    if (cover.kind === "youtube" && youtubeId(cover.src)) return <div className={box}><iframe title="Video" src={`https://www.youtube-nocookie.com/embed/${youtubeId(cover.src)}`} allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="size-full border-0" /></div>;
    return (
        <div aria-hidden="true" className={cx(box, "flex items-end bg-gradient-to-br from-brand-100 via-brand-50 to-secondary dark:from-brand-800 dark:via-brand-900 dark:to-brand-950")}>
            <div className="absolute -top-10 -right-10 size-48 rounded-full bg-brand-200/70" /><div className="absolute right-16 -bottom-12 size-32 rounded-full bg-brand-300/50" />
            <span className="relative m-4 rounded-full bg-primary/80 px-3 py-1 text-xs font-medium text-tertiary">No cover yet</span>
        </div>
    );
};
