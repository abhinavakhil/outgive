/**
 * Blog posts written in Sanity (studio/ in this repo, hosted at <name>.sanity.studio). They are read straight from Sanity's
 * public CDN API, so a published post shows on the site at once; the build (scripts/prerender.mjs) also writes them into the
 * static HTML for search engines. With no VITE_SANITY_PROJECT_ID the blog shows only the posts written in code (posts/).
 */
import { useEffect, useState } from "react";
import { PortableText, type PortableTextComponents } from "@portabletext/react";
import type { Audience, Post } from "./posts";
import { A, Note } from "./posts/kit";

const PROJECT = import.meta.env.VITE_SANITY_PROJECT_ID as string | undefined;
const DATASET = (import.meta.env.VITE_SANITY_DATASET as string | undefined) || "production";
export const CMS_ON = !!PROJECT;

const QUERY = `*[_type == "post" && defined(slug.current) && !(_id in path("drafts.**"))] | order(publishedAt desc) {
  "slug": slug.current, title, description, audience, "published": publishedAt, "updated": coalesce(updatedAt, _updatedAt),
  answer, takeaways, "faq": faq[]{question, answer}, "sources": sources[]{name, url}, author,
  "cover": cover.asset->url, "coverAlt": cover.alt,
  body[]{..., _type == "image" => {..., "url": asset->url}}
}`;

type Block = { _type: string; children?: { text?: string }[]; text?: string };
type Doc = {
    slug: string; title: string; description?: string; audience?: Audience; published?: string; updated?: string;
    answer?: string; takeaways?: string[]; faq?: { question: string; answer: string }[]; sources?: { name: string; url: string }[];
    author?: string; cover?: string; coverAlt?: string; body?: Block[];
};

const components: PortableTextComponents = {
    types: {
        image: ({ value }) => value.url ? <figure><img src={`${value.url}?w=1400&auto=format`} alt={value.alt ?? ""} loading="lazy" />{value.caption && <figcaption>{value.caption}</figcaption>}</figure> : null,
        note: ({ value }) => <Note title={value.title ?? "Note"}><p>{value.text}</p></Note>,
    },
    marks: { link: ({ value, children }) => /^https?:\/\//.test(value?.href ?? "") && !value.href.includes("outgive.tech") ? <A href={value.href}>{children}</A> : <a href={value?.href}>{children}</a> },
};

const words = (body: Block[] = []) => body.reduce((n, b) => n + (b.children ?? []).reduce((m, c) => m + (c.text ?? "").split(/\s+/).filter(Boolean).length, 0) + (b.text ?? "").split(/\s+/).filter(Boolean).length, 0);
const day = (iso?: string) => (iso ?? new Date().toISOString()).slice(0, 10);

/** A Sanity document as a Post, the same shape as the posts written in code. */
export const toPost = (d: Doc): Post => ({
    slug: d.slug, title: d.title, description: d.description ?? "", audience: d.audience ?? "charities",
    published: day(d.published), updated: day(d.updated ?? d.published), minutes: Math.max(1, Math.round(words(d.body) / 220)),
    answer: d.answer ?? "", takeaways: d.takeaways ?? [], faq: (d.faq ?? []).map((f) => [f.question, f.answer]), sources: (d.sources ?? []).map((s) => [s.name, s.url]),
    author: d.author, cover: d.cover, coverAlt: d.coverAlt,
    body: <PortableText value={d.body ?? []} components={components} />,
});

export const fetchCmsPosts = async (): Promise<Post[]> => {
    if (!PROJECT) return [];
    const r = await fetch(`https://${PROJECT}.apicdn.sanity.io/v2025-02-19/data/query/${DATASET}?query=${encodeURIComponent(QUERY)}`);
    if (!r.ok) throw new Error(`Sanity ${r.status}`);
    return ((await r.json()).result as Doc[]).map(toPost);
};

let cache: Post[] | null = CMS_ON ? null : [];
let pending: Promise<Post[]> | null = null;
/** The build fills this before prerendering, so the static HTML includes Sanity's posts. */
export const primeCms = async () => { cache = await fetchCmsPosts(); return cache; };
const load = () => (pending ??= fetchCmsPosts().catch(() => []).then((p) => (cache = p)));

/** Sanity's posts: null while loading, [] when Sanity is off or unreachable. */
export const useCmsPosts = () => {
    const [posts, setPosts] = useState(cache);
    useEffect(() => { if (cache === null) void load().then(setPosts); }, []);
    return posts;
};
/** Sanity's posts first (they win on a shared slug), then the posts in code; newest first. */
export const mergePosts = (cms: Post[] | null, code: Post[]) => [...(cms ?? []), ...code.filter((p) => !cms?.some((c) => c.slug === p.slug))].sort((a, b) => b.published.localeCompare(a.published));
export const allPosts = (code: Post[]) => mergePosts(cache, code);
