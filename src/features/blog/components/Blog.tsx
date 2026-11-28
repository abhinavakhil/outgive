import { type ChangeEvent, type ReactNode, useEffect, useState } from "react";
import { CalendarBlank, Check, Clock, LinkSimple, LinkedinLogo, MagnifyingGlass, XLogo } from "@phosphor-icons/react";
import { Loading, OgLogo, OgMark } from "@/shared/ui";
import { DemoRequest } from "@/shared/ui";
import { SITE, metaFor, setMeta } from "@/shared/lib/seo";
import { DEFAULT_BRAND } from "@/shared/domain/model";
import { AUDIENCES, POSTS, type Audience, type Post, docTitle } from "../posts";
import { CMS_ON, mergePosts, useCmsPosts } from "../cms";
import "./blog.css";

/**
 * The blog: an index at /blog and one article per /blog/<slug>. Posts come from code (posts/) and from Sanity (cms.tsx).
 * It looks like Medium, not like the rest of the site: a white page under a thin top bar with a search field, a feed of rows beside a
 * sidebar, and articles in one 680px serif column with a byline, a hairline action bar, topic chips, a "Written by" card and more posts.
 * So it has its own frame (Shell) and its own type (blog.css) instead of the site's. Only Medium's name, logo and sign-up prompts are left out.
 */

export const dateOf = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const label = (a: Audience) => AUDIENCES.find(([x]) => x === a)![1];
const JOIN = "#demo";
const ABOUT = "Outgive gives charities donation pages, team fundraising and live leaderboards, free.";
const LINKS: [string, string][] = [["Home", "/"], ["Leaderboard", "/leaderboard"], ["Blog", "/blog"], ["Contact", "mailto:hello@outgive.tech"]];
const by = (p: Post) => p.author ?? `${SITE.name} team`;
const urlOf = (p: Post) => `${SITE.url}/blog/${p.slug}`;

const Avatar = ({ size }: { size: number }) => <span className="bl-avatar" style={{ width: size, height: size }} aria-hidden="true"><OgMark size={Math.round(size * 0.3)} tone="dark" /></span>;
const Writer = ({ post }: { post: Post }) => <p className="bl-writer"><Avatar size={20} />{by(post)}</p>;
const Meta = ({ post }: { post: Post }) => (
    <p className="bl-meta">
        <span><CalendarBlank size={16} aria-hidden="true" /><time dateTime={post.published}>{dateOf(post.published)}</time></span>
        <span><Clock size={16} aria-hidden="true" />{post.minutes} min read</span>
        <span>{label(post.audience)}</span>
    </p>
);
const thumb = (p: Post, w: number, h: number) => `${p.cover}?w=${w}&h=${h}&fit=crop&auto=format`;
const Foot = () => <p className="bl-foot">{LINKS.map(([l, h]) => <a key={l} href={h}>{l}</a>)}<span>© 2026 {SITE.name}</span></p>;

/** Copies a post's address; the icon turns to a tick for two seconds. */
const Copy = ({ post, text }: { post: Post; text?: boolean }) => {
    const [copied, setCopied] = useState(false);
    const copy = async () => { try { await navigator.clipboard.writeText(urlOf(post)); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ } };
    return <button type="button" onClick={copy} aria-label={text ? undefined : copied ? "Link copied" : `Copy link to ${post.title}`}>{copied ? <Check size={20} aria-hidden="true" /> : <LinkSimple size={20} aria-hidden="true" />}{text && (copied ? "Copied" : "Copy link")}</button>;
};

const Index = ({ posts, q }: { posts: Post[]; q: string }) => {
    const [only, setOnly] = useState<Audience | null>(null);
    // /blog#donors (the topic chip on an article) opens that tab.
    useEffect(() => { const a = AUDIENCES.find(([x]) => x === location.hash.slice(1)); if (a) setOnly(a[0]); }, []);
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = posts.filter((p) => (!only || p.audience === only) && words.every((w) => `${p.title} ${p.description} ${by(p)}`.toLowerCase().includes(w)));
    // ponytail: "Featured" is the newest post for each audience; add a featured flag to Post when someone wants to choose them.
    const featured = AUDIENCES.flatMap(([a]) => posts.find((p) => p.audience === a) ?? []);
    return (
        <div className="bl-feed">
            <div className="bl-main">
                <h1 className="sr-only">{SITE.name} blog</h1>
                <div className="bl-tabs" role="group" aria-label="Filter posts">
                    <button type="button" aria-pressed={!only} onClick={() => setOnly(null)}>All</button>
                    {AUDIENCES.map(([a, t]) => <button key={a} type="button" aria-pressed={only === a} onClick={() => setOnly(a)}>{t}</button>)}
                </div>
                <ul className="bl-rows">{list.map((p) => (
                    <li key={p.slug}>
                        <Writer post={p} />
                        <div className="bl-row">
                            <div>
                                <a href={`/blog/${p.slug}`}><h2>{p.title}</h2><p className="bl-desc">{p.description}</p></a>
                                <div className="bl-row-foot"><Meta post={p} /><Copy post={p} /></div>
                            </div>
                            {p.cover && <a href={`/blog/${p.slug}`} tabIndex={-1} aria-hidden="true"><img src={thumb(p, 320, 214)} alt="" width={160} height={107} loading="lazy" /></a>}
                        </div>
                    </li>
                ))}</ul>
                {!list.length && <p className="bl-none">No posts match{q ? <> “{q}”</> : ""}. Try another word or topic.</p>}
            </div>

            <aside className="bl-side">
                {!!featured.length && (
                    <section aria-labelledby="featured">
                        <h2 id="featured">Featured</h2>
                        <ul className="bl-picks">{featured.map((p) => <li key={p.slug}><a href={`/blog/${p.slug}`}><Writer post={p} /><b>{p.title}</b><time dateTime={p.published}>{dateOf(p.published)}</time></a></li>)}</ul>
                    </section>
                )}
                <section aria-labelledby="topics">
                    <h2 id="topics">Recommended topics</h2>
                    <div className="bl-chips">{AUDIENCES.map(([a, t]) => <button key={a} type="button" onClick={() => { setOnly(a); scrollTo({ top: 0 }); }}>{t}</button>)}</div>
                </section>
                <Foot />
            </aside>
        </div>
    );
};

/** Copy link, LinkedIn and X: the three places charity people share a guide. Sits where Medium's clap and bookmark bar does. */
const Share = ({ post }: { post: Post }) => (
    <div className="bl-bar">
        <Copy post={post} text />
        <span>
            <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(urlOf(post))}`} target="_blank" rel="noopener" aria-label="Share on LinkedIn"><LinkedinLogo size={22} aria-hidden="true" /></a>
            <a href={`https://x.com/intent/post?url=${encodeURIComponent(urlOf(post))}&text=${encodeURIComponent(post.title)}`} target="_blank" rel="noopener" aria-label="Share on X"><XLogo size={20} aria-hidden="true" /></a>
        </span>
    </div>
);

const Article = ({ post, posts }: { post: Post; posts: Post[] }) => {
    const related = [...posts.filter((p) => p !== post && p.audience === post.audience), ...posts.filter((p) => p !== post && p.audience !== post.audience)].slice(0, 4);
    return (
        <>
            <article className="bl-article">
                <header>
                    <h1>{post.title}</h1>
                    {post.description && <p className="bl-dek">{post.description}</p>}
                    <div className="bl-by">
                        <Avatar size={32} />
                        <b>{by(post)}</b>
                        <a href={JOIN}>Book a demo</a>
                        <span>{post.minutes} min read<span aria-hidden="true">·</span><time dateTime={post.updated}>{dateOf(post.updated)}</time></span>
                    </div>
                    <Share post={post} />
                </header>

                <div className="bl-prose">
                    {post.cover && <figure><img src={`${post.cover}?w=1400&auto=format`} alt={post.coverAlt ?? ""} /></figure>}
                    {post.answer && <blockquote>{post.answer}</blockquote>}
                    {!!post.takeaways.length && <><h2>Key takeaways</h2><ul>{post.takeaways.map((t) => <li key={t}>{t}</li>)}</ul></>}
                    {post.body}
                    {!!post.faq.length && (
                        <section aria-labelledby="faq" className="bl-faq">
                            <h2 id="faq">Questions</h2>
                            {post.faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
                        </section>
                    )}
                </div>

                {!!post.sources.length && (
                    <section aria-labelledby="sources" className="bl-sources">
                        <h2 id="sources">Sources</h2>
                        <ol>{post.sources.map(([name, url]) => <li key={url}><a href={url} rel="noopener" target="_blank">{name}</a></li>)}</ol>
                        <p>Checked {dateOf(post.updated)}. Fees and rules change, so confirm on the source before relying on a figure.</p>
                    </section>
                )}

                <div className="bl-chips"><a href={`/blog#${post.audience}`}>{label(post.audience)}</a></div>
                <Share post={post} />
            </article>

            <div className="bl-after">
                <section className="bl-written">
                    <Avatar size={72} />
                    <div><h2>Written by {by(post)}</h2><p>{ABOUT}</p></div>
                    <a href={JOIN} className="bl-btn">Book a demo</a>
                </section>
                {!!related.length && (
                    <section aria-labelledby="more" className="bl-more">
                        <h2 id="more">More from {SITE.name}</h2>
                        <ul>{related.map((p) => (
                            <li key={p.slug}><a href={`/blog/${p.slug}`}>
                                {p.cover && <img src={thumb(p, 660, 330)} alt="" width={330} height={165} loading="lazy" />}
                                <Writer post={p} />
                                <h3>{p.title}</h3>
                                <p className="bl-desc">{p.description}</p>
                                <Meta post={p} />
                            </a></li>
                        ))}</ul>
                        <a href="/blog" className="bl-btn bl-btn-line">See all posts</a>
                    </section>
                )}
                <Foot />
            </div>
        </>
    );
};

const Missing = () => (
    <section className="bl-missing">
        <h1>This post doesn't exist</h1>
        <p>It may have moved. Everything we've published is on the blog.</p>
        <a href="/blog" className="bl-btn">Go to the blog</a>
    </section>
);

/** The blog's own frame: a 57px bar with the logo, a search field and one quiet link. The search is a plain form to /blog?q=, so it works from an article too; on the index it filters as you type. */
const Shell = ({ q, onSearch, children }: { q: string; onSearch?: (q: string) => void; children: ReactNode }) => (
    <div className="bl">
        <header className="bl-top">
            <a href="/" aria-label="Outgive home" className="bl-logo"><OgLogo size={24} /></a>
            <form action="/blog" role="search" onSubmit={onSearch && ((e) => e.preventDefault())}>
                <MagnifyingGlass size={20} aria-hidden="true" />
                <input type="search" name="q" placeholder="Search" aria-label="Search the blog" {...(onSearch && { value: q, onChange: (e: ChangeEvent<HTMLInputElement>) => onSearch(e.target.value) })} />
            </form>
            <a href="/blog" className="bl-top-link">Blog</a>
            <a href={JOIN} className="bl-top-link">Book a demo</a>
        </header>
        <main>{children}</main>
        <DemoRequest />
    </div>
);

export const Blog = ({ slug }: { slug?: string }) => {
    const cms = useCmsPosts();
    const posts = mergePosts(cms, POSTS);
    const post = slug ? posts.find((p) => p.slug === slug) : undefined;
    const waiting = !!slug && !post && CMS_ON && cms === null;
    const [q, setQ] = useState("");
    // /blog?q=word, from the search field on an article.
    useEffect(() => { if (!slug) setQ(new URLSearchParams(location.search).get("q") ?? ""); }, [slug]);
    useEffect(() => {
        if (waiting) return;
        if (!slug) return setMeta(...metaFor("blog", DEFAULT_BRAND));
        if (post) return setMeta(docTitle(post), post.description);
        setMeta("Post not found | Outgive", "This post does not exist. Read the Outgive blog.");
        document.querySelector('meta[name="robots"]')?.setAttribute("content", "noindex");
    }, [slug, post, waiting]);
    return <Shell q={q} onSearch={slug ? undefined : setQ}>{!slug ? <Index posts={posts} q={q} /> : post ? <Article post={post} posts={posts} /> : waiting ? <Loading /> : <Missing />}</Shell>;
};
