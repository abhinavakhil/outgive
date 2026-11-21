/**
 * Architecture rules, checked on every `npm test`:
 *  1. shared/ never imports features/ or app/.  2. features/ never import app/.
 *  3. A feature reaches another feature only through its index (`@/features/<name>`).
 *  4. Features take UI only from `@/shared/ui`, never from its files or from react-aria directly.
 */
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

const SRC = path.resolve(__dirname, "..");
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(SRC).filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".test.ts")).map((f) => path.relative(SRC, f).replace(/\\/g, "/"));
const importsOf = (f: string) => [...fs.readFileSync(path.join(SRC, f), "utf8").matchAll(/(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g)].map((m) => m[1]);

export const violations = (file: string, specs: string[]) => {
    const out: string[] = [];
    const own = file.startsWith("features/") ? file.split("/")[1] : null;
    for (const s of specs) {
        if (file.startsWith("shared/") && /^@\/(features|app)(\/|$)/.test(s)) out.push(`${file}: shared code imports ${s}`);
        if (own && /^@\/app(\/|$)/.test(s)) out.push(`${file}: feature imports app code ${s}`);
        const f = s.match(/^@\/features\/([^/]+)(\/.*)?$/);
        if (own && f && f[1] !== own && f[2]) out.push(`${file}: deep import into feature "${f[1]}" (${s}); import from "@/features/${f[1]}"`);
        if (own && /^@\/shared\/ui\/./.test(s)) out.push(`${file}: imports ${s}; import from "@/shared/ui"`);
        if (own && /^(react-aria|react-aria-components|@react-aria\/)/.test(s)) out.push(`${file}: uses ${s} directly; wrap it in shared/ui`);
    }
    return out;
};

test("every import respects the layer boundaries", () => {
    expect(files.flatMap((f) => violations(f, importsOf(f)))).toEqual([]);
});

test("the checker catches each kind of violation", () => {
    expect(violations("shared/lib/x.ts", ["@/features/donate"])).toHaveLength(1);
    expect(violations("features/donate/a.tsx", ["@/app/App"])).toHaveLength(1);
    expect(violations("features/donate/a.tsx", ["@/features/live/components/Live", "@/features/live", "@/features/donate/components/x"])).toHaveLength(1);
    expect(violations("features/donate/a.tsx", ["@/shared/ui/base/buttons/button", "@/shared/ui", "react-aria-components"])).toHaveLength(2);
});
