import type { ReactNode } from "react";

/** Building blocks for article bodies. Bodies are rendered inside the blog's `prose` container. */

/** An outside link, opened in a new tab. */
export const A = ({ href, children }: { href: string; children: ReactNode }) => <a href={href} rel="noopener" target="_blank">{children}</a>;

/** A table that scrolls sideways on a phone instead of squashing. */
export const Table = ({ head, rows }: { head: ReactNode[]; rows: ReactNode[][] }) => (
    <div className="overflow-x-auto">
        <table>
            <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
        </table>
    </div>
);

/** A highlighted aside: a tip, a caveat or a worked example. */
export const Note = ({ title, children }: { title: string; children: ReactNode }) => (
    <div className="not-prose my-8 rounded-2xl border-l-4 border-brand bg-secondary p-5 text-tertiary">
        <p className="mb-1 font-semibold text-primary">{title}</p>
        <div className="flex flex-col gap-2">{children}</div>
    </div>
);
