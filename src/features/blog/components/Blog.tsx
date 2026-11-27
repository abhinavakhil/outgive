import { useEffect, useState } from "react";
import { Check, LinkSimple, LinkedinLogo, XLogo } from "@phosphor-icons/react";
import { Loading, OgMark, SitePage } from "@/shared/ui";
import { SITE, metaFor, setMeta } from "@/shared/lib/seo";
import { DEFAULT_BRAND } from "@/shared/domain/model";
import { AUDIENCES, POSTS, type Audience, type Post, docTitle } from "../posts";
import { CMS_ON, mergePosts, useCmsPosts } from "../cms";
import "./blog.css";

/**
 * The blog: an index at /blog and one article per /blog/<slug>. Posts come from code (posts/) and from Sanity (cms.tsx).
 * Deliberately plain: type, hairlines and white space. Images appear only when a Sanity post has a real cover.
 * Layout from Mobbin's editorial references (Quartz, The New York Times): the latest post large beside a headline column, then the archive.
 */

export const dateOf = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const label = (a: Audience) => AUDIENCES.find(([x]) => x === a)![1];
const JOIN = "#demo";

const Meta = ({ post, who }: { post: Post; who?: boolean }) => (
    <p className="bl-meta">{who && <>{label(post.audience)}<span aria-hidden="true">·</span></>}<time dateTime={post.published}>{dateOf(post.published)}</time><span aria-hidden="true">·</span>{post.minutes} min read</p>
);
const Cover = ({ post }: { post: Post }) => post.cover ? <img className="bl-cover" src={`${post.cover}?w=1400&auto=format`} alt={post.coverAlt ?? ""} /> : null;

const Cta = () => (
    <aside className="bl-cta">
        <p><b>Raising money for a cause?</b> Outgive gives charities donation pages, team fundraising and live leaderboards, free.</p>
        <a href={JOIN} className="bl-btn">Book a demo</a>
    </aside>
);

const Index = ({ posts }: { posts: Post[] }) => {
    const [only, setOnly] = useState<Audience | null>(null);
    const [lead, ...next] = posts;
    const list = posts.filter((p) => !only || p.audience === only);
    return (
        <>
            <header className="bl-hero">
                <h1>Blog</h1>
                <p>Practical, sourced guides for charities, fundraisers and donors.</p>
            </header>

            {lead && (
                <section className="bl-top" aria-label="Latest">
                    <a href={`/blog/${lead.slug}`} className="bl-lead">
                        <Cover post={lead} />
                        <Meta post={lead} who />
                        <h2>{lead.title}</h2>
                        <p>{lead.description}</p>
                    </a>
                    {!!next.length && (
                        <ol className="bl-next">{next.slice(0, 4).map((p) => (
                            <li key={p.slug}><a href={`/blog/${p.slug}`}><Meta post={p} who /><b>{p.title}</b></a></li>
                        ))}</ol>
                    )}
                </section>
            )}

            <section className="bl-all" aria-labelledby="all">
                <div className="bl-all-head">
                    <h2 id="all">All posts</h2>
                    <div className="bl-tabs" role="group" aria-label="Filter posts">
                        <button type="button" aria-pressed={!only} onClick={() => setOnly(null)}>All</button>
                        {AUDIENCES.map(([a, t]) => <button key={a} type="button" aria-pressed={only === a} onClick={() => setOnly(a)}>{t}</button>)}
                    </div>
                </div>
                <ul className="bl-list">{list.map((p) => (
                    <li key={p.slug}><a href={`/blog/${p.slug}`}>
                        <span><b>{p.title}</b><span className="bl-desc">{p.description}</span></span>
                        <Meta post={p} who />
                    </a></li>
                ))}</ul>
            </section>

            <Cta />
        </>
    );
};

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** "On this page": the body's h2s, read after it renders (posts in code and in Sanity both just write h2s), with the one in view marked. */
const useContents = (key: string) => {
    const [items, setItems] = useState<[string, string][]>([]);
    const [active, setActive] = useState("");
    useEffect(() => {
        const hs = [...document.querySelectorAll<HTMLHeadingElement>(".bl-article h2")];
        hs.forEach((h) => { h.id ||= slugify(h.textContent ?? ""); });
        setItems(hs.map((h) => [h.id, h.textContent ?? ""]));
        const io = new IntersectionObserver((es) => { const e = es.find((x) => x.isIntersecting); if (e) setActive(e.target.id); }, { rootMargin: "0px 0px -70% 0px" });
        hs.forEach((h) => io.observe(h));
        return () => io.disconnect();
    }, [key]);
    return [items, active] as const;
};

/** Copy link, LinkedIn and X: the three places charity people share a guide. */
const Share = ({ post }: { post: Post }) => {
    const [copied, setCopied] = useState(false);
    const url = `${SITE.url}/blog/${post.slug}`;
    const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ } };
    return (
        <div className="bl-share">
            <button type="button" onClick={copy}>{copied ? <Check size={16} weight="bold" aria-hidden="true" /> : <LinkSimple size={16} weight="bold" aria-hidden="true" />}{copied ? "Copied" : "Copy link"}</button>
            <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} target="_blank" rel="noopener" aria-label="Share on LinkedIn"><LinkedinLogo size={18} weight="fill" aria-hidden="true" /></a>
            <a href={`https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(post.title)}`} target="_blank" rel="noopener" aria-label="Share on X"><XLogo size={16} weight="bold" aria-hidden="true" /></a>
        </div>
    );
};

/** An article, after Quartz and The New York Times: a centred header with the summary and a byline row, then the text in one centred column with the contents in the left margin. */
const Article = ({ post, posts }: { post: Post; posts: Post[] }) => {
    const related = [...posts.filter((p) => p !== post && p.audience === post.audience), ...posts.filter((p) => p !== post && p.audience !== post.audience)].slice(0, 3);
    const [contents, active] = useContents(post.slug);
    return (
        <>
            <header className="bl-head">
                <p className="bl-crumb"><a href="/blog">Blog</a><span aria-hidden="true">/</span>{label(post.audience)}</p>
                <h1>{post.title}</h1>
                {post.description && <p className="bl-dek">{post.description}</p>}
                <div className="bl-byline">
                    <span className="bl-by">
                        <span className="bl-avatar" aria-hidden="true"><OgMark size={11} tone="dark" /></span>
                        <span><b>{post.author ?? `${SITE.name} team`}</b><span>Updated <time dateTime={post.updated}>{dateOf(post.updated)}</time> · {post.minutes} min read</span></span>
                    </span>
                    <Share post={post} />
                </div>
                <Cover post={post} />
            </header>

            <div className="bl-page">
                {contents.length > 2 ? (
                    <nav aria-label="On this page" className="bl-toc">
                        <p>On this page</p>
                        <ol>{contents.map(([id, t]) => <li key={id}><a href={`#${id}`} aria-current={active === id ? "location" : undefined}>{t}</a></li>)}</ol>
                    </nav>
                ) : <span />}

                <article className="bl-article">
                    {post.answer && <p className="bl-answer">{post.answer}</p>}
                    {!!post.takeaways.length && (
                        <section className="bl-takeaways" aria-labelledby="takeaways">
                            <h2 id="takeaways">Key takeaways</h2>
                            <ul>{post.takeaways.map((t) => <li key={t}>{t}</li>)}</ul>
                        </section>
                    )}

                    <div className="bl-prose prose max-w-none">{post.body}</div>

                    {!!post.faq.length && (
                        <section aria-labelledby="faq" className="bl-faq">
                            <h2 id="faq">Questions</h2>
                            {post.faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
                        </section>
                    )}

                    {!!post.sources.length && (
                        <section aria-labelledby="sources" className="bl-sources">
                            <h2 id="sources">Sources</h2>
                            <ol>{post.sources.map(([name, url]) => <li key={url}><a href={url} rel="noopener" target="_blank">{name}</a></li>)}</ol>
                            <p>Checked {dateOf(post.updated)}. Fees and rules change, so confirm on the source before relying on a figure.</p>
                        </section>
                    )}
                </article>
            </div>

            {!!related.length && (
                <section aria-labelledby="more" className="bl-more">
                    <h2 id="more">Keep reading</h2>
                    <ul className="bl-list">{related.map((p) => <li key={p.slug}><a href={`/blog/${p.slug}`}><span><b>{p.title}</b></span><Meta post={p} who /></a></li>)}</ul>
                </section>
            )}
            <Cta />
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

export const Blog = ({ slug }: { slug?: string }) => {
    const cms = useCmsPosts();
    const posts = mergePosts(cms, POSTS);
    const post = slug ? posts.find((p) => p.slug === slug) : undefined;
    const waiting = !!slug && !post && CMS_ON && cms === null;
    useEffect(() => {
        if (waiting) return;
        if (!slug) return setMeta(...metaFor("blog", DEFAULT_BRAND));
        if (post) return setMeta(docTitle(post), post.description);
        setMeta("Post not found | Outgive", "This post does not exist. Read the Outgive blog.");
        document.querySelector('meta[name="robots"]')?.setAttribute("content", "noindex");
    }, [slug, post, waiting]);
    return <SitePage narrow={false}>{!slug ? <Index posts={posts} /> : post ? <Article post={post} posts={posts} /> : waiting ? <Loading /> : <Missing />}</SitePage>;
};
