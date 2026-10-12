// Runs after `vite build`. Writes one HTML file per indexable page into dist/, plus sitemap.xml, robots.txt and a 404.html fallback,
// so the site works on any static host and crawlers get content without running JavaScript.
import fs from "node:fs";
import path from "node:path";
import { createServer } from "vite";

const dist = path.resolve("dist");
const shell = fs.readFileSync(path.join(dist, "index.html"), "utf8");
const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

try {
    const { pages, site } = await vite.ssrLoadModule("/src/prerender.tsx");
    const built = pages();
    for (const p of built) {
        const url = site.url + (p.path === "/" ? "/" : p.path);
        const head = [
            `<link rel="canonical" href="${url}" />`,
            `<meta property="og:url" content="${url}" />`,
            `<meta property="og:image" content="${site.url}/og.png" />`,
            `<meta name="twitter:image" content="${site.url}/og.png" />`,
            ...p.jsonLd.map((ld) => `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`),
        ].join("\n    ");
        const html = shell
            .replace(/<title>[^<]*<\/title>/, `<title>${esc(p.title)}</title>`)
            .replace(/(<meta name="description" content=")[^"]*"/, `$1${esc(p.description)}"`)
            .replace(/(<meta property="og:title" content=")[^"]*"/, `$1${esc(p.title)}"`)
            .replace(/(<meta property="og:description" content=")[^"]*"/, `$1${esc(p.description)}"`)
            .replace(/(<meta name="twitter:title" content=")[^"]*"/, `$1${esc(p.title)}"`)
            .replace(/(<meta name="twitter:description" content=")[^"]*"/, `$1${esc(p.description)}"`)
            .replace('<meta name="robots" content="index, follow" />', `<meta name="robots" content="${p.noindex ? "noindex" : "index, follow"}" />`)
            .replace("</head>", `    ${head}\n  </head>`)
            .replace('<div id="root"></div>', () => `<div id="root">${p.html}</div>`)
            // The no-JavaScript fallback is only for the bare shell; a prerendered page already carries its content.
            .replace(/\s*<noscript>[\s\S]*?<\/noscript>/, "");
        if (!html.includes(p.html)) throw new Error(`Could not place the page into the shell for ${p.path}`);
        const file = p.path === "/" ? path.join(dist, "index.html") : path.join(dist, p.path, "index.html");
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, html);
        console.log(`prerendered ${p.path} (${Math.round(html.length / 1024)} KB)`);
    }
    // Fundraising pages and the create flow are rendered in the browser; hosts that serve 404.html for unknown paths load the app from it.
    fs.writeFileSync(path.join(dist, "404.html"), shell);
    // The same bare shell under a name the rewrite rules in public/_redirects and vercel.json point at.
    fs.writeFileSync(path.join(dist, "app.html"), shell);
    const today = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(path.join(dist, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${built.filter((p) => !p.noindex).map((p) => `  <url><loc>${site.url}${p.path === "/" ? "/" : p.path}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`);
    fs.writeFileSync(path.join(dist, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /dashboard\n\nSitemap: ${site.url}/sitemap.xml\n`);
} finally {
    await vite.close();
}
