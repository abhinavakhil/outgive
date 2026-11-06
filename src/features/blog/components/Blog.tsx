import { useEffect } from "react";
import { ArrowLeft, ArrowRight, CheckCircle } from "@untitledui/icons";
import { Container, Logo, ThemeToggle } from "@/shared/ui";
import { SITE, metaFor, setMeta } from "@/shared/lib/seo";
import { DEFAULT_BRAND } from "@/shared/domain/model";
import { AUDIENCES, POSTS, type Post, docTitle } from "../posts";

/** The blog: an index at /blog and one article per /blog/<slug>. Rendered without the app's data, so it is plain links throughout. */

export const dateOf = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const label = (p: Post) => AUDIENCES.find(([a]) => a === p.audience)![1];
const JOIN = "/#join";

const Header = () => (
    <header className="border-b border-secondary">
        <Container className="flex h-16 items-center justify-between gap-3">
            <Logo href="/" />
            <nav aria-label="Main" className="flex items-center gap-1 text-sm font-medium text-tertiary">
                <a href="/blog" className="rounded-full px-3 py-2 transition hover:bg-secondary hover:text-primary">Blog</a>
                <ThemeToggle />
                <a href={JOIN} className="ml-1 inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-solid px-4 font-semibold whitespace-nowrap text-white transition hover:bg-brand-solid_hover">
                    <span className="max-sm:hidden">Join the waitlist</span><span className="sm:hidden">Join</span>
                </a>
            </nav>
        </Container>
    </header>
);

const Footer = () => (
    <footer className="mt-24 border-t border-secondary py-10 text-sm text-tertiary">
        <Container className="flex flex-wrap items-center justify-between gap-4">
            <span>© {new Date().getFullYear()} {SITE.name}. Crowdfunding built for charities.</span>
            <nav aria-label="Footer" className="flex gap-5"><a href="/" className="hover:text-primary">Home</a><a href="/blog" className="hover:text-primary">Blog</a><a href={JOIN} className="hover:text-primary">Waitlist</a></nav>
        </Container>
    </footer>
);

const Card = ({ post }: { post: Post }) => (
    <a href={`/blog/${post.slug}`} className="group flex flex-col gap-3 rounded-2xl bg-primary p-6 ring-1 ring-secondary transition ring-inset hover:-translate-y-0.5 hover:shadow-lg hover:ring-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">
        <span className="text-xs font-semibold tracking-wide text-brand-secondary uppercase">{label(post)}</span>
        <h3 className="text-lg leading-snug font-semibold text-primary text-balance">{post.title}</h3>
        <p className="line-clamp-3 text-sm text-tertiary">{post.description}</p>
        <span className="mt-auto flex items-center gap-1 pt-2 text-sm font-semibold text-brand-secondary">Read the guide<ArrowRight className="size-4 transition group-hover:translate-x-0.5" /></span>
    </a>
);

const Cta = () => (
    <aside className="flex flex-col items-start gap-4 rounded-3xl bg-brand-solid p-8 text-white md:p-10">
        <h2 className="text-2xl font-bold tracking-tight text-balance md:text-3xl">Raising money for a cause?</h2>
        <p className="max-w-xl text-white/85">Outgive is crowdfunding built for charities and the people who raise for them: live leaderboards, team races and big-screen giving moments. It's free for charities, and gifts are paid straight to the charity's own Stripe account.</p>
        <a href={JOIN} className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 font-semibold text-brand-700 transition hover:-translate-y-0.5">Join the waitlist<ArrowRight className="size-4" /></a>
    </aside>
);

const Index = () => (
    <>
        <section className="py-16 md:py-24">
            <p className="text-sm font-semibold tracking-wide text-brand-secondary uppercase">The Outgive blog</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-primary text-balance md:text-6xl">Fundraising guides for charities, fundraisers and donors</h1>
            <p className="mt-5 max-w-2xl text-lg text-tertiary">Practical answers with the sources linked: what platforms really cost, how to plan GivingTuesday, how to start and grow a fundraiser, and how to give safely and tax-smart in the US and Europe.</p>
        </section>
        <div className="flex flex-col gap-14">
            {AUDIENCES.map(([a, title]) => (
                <section key={a} aria-labelledby={`for-${a}`}>
                    <h2 id={`for-${a}`} className="mb-5 text-xl font-semibold text-primary">{title}</h2>
                    <div className="grid gap-5 md:grid-cols-2">{POSTS.filter((p) => p.audience === a).map((p) => <Card key={p.slug} post={p} />)}</div>
                </section>
            ))}
        </div>
        <div className="mt-20"><Cta /></div>
    </>
);

const Article = ({ post }: { post: Post }) => {
    const related = [...POSTS.filter((p) => p !== post && p.audience === post.audience), ...POSTS.filter((p) => p.audience !== post.audience)].slice(0, 2);
    return (
        <>
            <article className="mx-auto max-w-3xl pt-10 md:pt-16">
                <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-tertiary">
                    <a href="/blog" className="inline-flex items-center gap-1 hover:text-primary"><ArrowLeft className="size-4" />Blog</a><span aria-hidden="true">/</span><span>{label(post)}</span>
                </nav>
                <h1 className="mt-5 text-3xl leading-tight font-bold tracking-tight text-primary text-balance md:text-5xl">{post.title}</h1>
                <p className="mt-4 text-sm text-tertiary">
                    By the {SITE.name} team · Updated <time dateTime={post.updated}>{dateOf(post.updated)}</time> · {post.minutes} min read
                </p>

                <div className="mt-8 rounded-2xl bg-brand-primary p-6 ring-1 ring-brand ring-inset">
                    <p className="text-xs font-semibold tracking-wide text-brand-secondary uppercase">The short answer</p>
                    <p className="mt-2 text-lg text-primary">{post.answer}</p>
                </div>

                <div className="mt-6 rounded-2xl bg-secondary p-6">
                    <h2 className="text-md font-semibold text-primary">Key takeaways</h2>
                    <ul className="mt-3 flex flex-col gap-2.5">
                        {post.takeaways.map((t) => <li key={t} className="flex gap-2.5 text-tertiary"><CheckCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-secondary" /><span>{t}</span></li>)}
                    </ul>
                </div>

                <div className="prose mt-10 max-w-none prose-headings:tracking-tight prose-headings:text-balance prose-a:text-brand-secondary prose-a:underline prose-a:underline-offset-2 prose-strong:text-primary">
                    {post.body}
                </div>

                <section aria-labelledby="faq" className="mt-14">
                    <h2 id="faq" className="text-2xl font-bold tracking-tight text-primary">Frequently asked questions</h2>
                    <div className="mt-5 divide-y divide-secondary rounded-2xl ring-1 ring-secondary ring-inset">
                        {post.faq.map(([q, a]) => (
                            <details key={q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-primary">{q}<span aria-hidden="true" className="text-xl text-tertiary transition group-open:rotate-45">+</span></summary>
                                <p className="mt-3 text-tertiary">{a}</p>
                            </details>
                        ))}
                    </div>
                </section>

                <section aria-labelledby="sources" className="mt-14">
                    <h2 id="sources" className="text-lg font-semibold text-primary">Sources</h2>
                    <p className="mt-1 text-sm text-tertiary">Checked on {dateOf(post.updated)}. Fees and rules change, so confirm on the source before you rely on a figure.</p>
                    <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-tertiary">
                        {post.sources.map(([name, url]) => <li key={url}><a href={url} rel="noopener" target="_blank" className="underline underline-offset-2 hover:text-primary">{name}</a></li>)}
                    </ol>
                </section>

                <div className="mt-16"><Cta /></div>
            </article>

            <section aria-labelledby="more" className="mx-auto mt-16 max-w-3xl">
                <h2 id="more" className="mb-5 text-xl font-semibold text-primary">Keep reading</h2>
                <div className="grid gap-5 md:grid-cols-2">{related.map((p) => <Card key={p.slug} post={p} />)}</div>
            </section>
        </>
    );
};

const Missing = () => (
    <section className="py-24 text-center">
        <h1 className="text-3xl font-bold text-primary">This post doesn't exist</h1>
        <p className="mt-3 text-tertiary">It may have moved. Everything we've published is on the blog.</p>
        <a href="/blog" className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-brand-solid px-5 font-semibold text-white">Go to the blog<ArrowRight className="size-4" /></a>
    </section>
);

export const Blog = ({ slug }: { slug?: string }) => {
    const post = slug ? POSTS.find((p) => p.slug === slug) : undefined;
    useEffect(() => {
        if (!slug) return setMeta(...metaFor("blog", DEFAULT_BRAND));
        if (post) return setMeta(docTitle(post), post.description);
        setMeta("Post not found | Outgive", "This post does not exist. Read the Outgive blog.");
        document.querySelector('meta[name="robots"]')?.setAttribute("content", "noindex");
    }, [slug, post]);
    return (
        <div className="min-h-dvh bg-primary">
            <Header />
            <main><Container>{!slug ? <Index /> : post ? <Article post={post} /> : <Missing />}</Container></main>
            <Footer />
        </div>
    );
};
