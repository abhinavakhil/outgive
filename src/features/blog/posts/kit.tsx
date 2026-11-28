import type { ReactNode } from "react";

/** Building blocks for article bodies, styled in components/blog.css. Posts in code use them directly; cms.tsx renders Sanity's blocks with the same ones. */

/** An outside link, opened in a new tab. */
export const A = ({ href, children }: { href: string; children: ReactNode }) => <a href={href} rel="noopener" target="_blank">{children}</a>;

/** A table that scrolls sideways on a phone instead of squashing. */
export const Table = ({ head, rows }: { head: ReactNode[]; rows: ReactNode[][] }) => (
    <div className="bl-table">
        <table>
            <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
        </table>
    </div>
);

/** An aside: a tip, a caveat or a worked example. */
export const Note = ({ title, children }: { title: string; children: ReactNode }) => (
    <aside className="bl-note"><p><strong>{title}</strong></p>{children}</aside>
);

/** A pull quote: one line lifted out of the text, set large. */
export const Pull = ({ children }: { children: ReactNode }) => <blockquote className="bl-pull">{children}</blockquote>;

/** One image. `width` and `height` are the file's own pixels: they keep the page from jumping while it loads. */
export type Img = { src: string; alt: string; width: number; height: number };

/** An image across the reading column, with an optional caption under it. Use as many as the post needs. */
export const Figure = ({ caption, ...img }: Img & { caption?: ReactNode }) => (
    <figure><img {...img} loading="lazy" decoding="async" />{caption && <figcaption>{caption}</figcaption>}</figure>
);

/** Two or three images side by side at one height, each as wide as its shape needs, with one caption for the row. */
export const Gallery = ({ images, caption }: { images: Img[]; caption?: ReactNode }) => (
    <figure>
        <div className="bl-gallery">{images.map((i) => <img key={i.src} {...i} loading="lazy" decoding="async" style={{ flex: `${i.width / i.height} 1 0`, aspectRatio: `${i.width} / ${i.height}` }} />)}</div>
        {caption && <figcaption>{caption}</figcaption>}
    </figure>
);
