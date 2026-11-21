/**
 * Feature flags. A flag's value comes from, in order:
 *   1. the address: ?checkout_layout=pledge (also remembered in this browser, so it survives navigation; ?checkout_layout= forgets it)
 *   2. this browser's remembered override
 *   3. the build: VITE_FF_CHECKOUT_LAYOUT=ticket in Vercel's environment variables (redeploy to change)
 *   4. the default in FLAGS
 * ponytail: build-time default only; move to GrowthBook or Unleash (both open source) for remote switching or percentage splits.
 */
export const FLAGS = {
    checkout_layout: { values: ["hero", "pledge", "ticket"], fallback: "hero" },
    /** Which amounts the checkout offers (features/checkout/presets.ts): the campaign's own, scaled and anchored, or anchored one step up. */
    checkout_presets: { values: ["control", "smart", "ask-up"], fallback: "smart" },
} as const;
export type FlagName = keyof typeof FLAGS;
export type FlagValue<N extends FlagName> = (typeof FLAGS)[N]["values"][number];

const KEY = (n: string) => `ff.${n}`;

export const resolveFlag = <N extends FlagName>(name: N, src: { search?: string; stored?: string | null; env?: string }): FlagValue<N> => {
    const { values, fallback } = FLAGS[name];
    const ok = (v?: string | null): v is FlagValue<N> => !!v && (values as readonly string[]).includes(v);
    const q = new URLSearchParams(src.search ?? "").get(name);
    if (ok(q)) return q;
    if (ok(src.stored)) return src.stored;
    if (ok(src.env)) return src.env;
    return fallback;
};

/** The flag's value in this browser right now; a valid ?name=value in the address is remembered. */
export const flag = <N extends FlagName>(name: N): FlagValue<N> => {
    const search = typeof location === "undefined" ? "" : location.search;
    let stored: string | null = null;
    try {
        const q = new URLSearchParams(search);
        // A preview (the home page's embedded donate page) shows a layout without remembering it for this browser.
        if (q.has(name) && !q.has("preview")) { const v = q.get(name)!; if ((FLAGS[name].values as readonly string[]).includes(v)) localStorage.setItem(KEY(name), v); else localStorage.removeItem(KEY(name)); }
        stored = localStorage.getItem(KEY(name));
    } catch { /* storage unavailable: the address and build still work */ }
    const env = (import.meta.env as Record<string, string | undefined>)[`VITE_FF_${name.toUpperCase()}`];
    return resolveFlag(name, { search, stored, env });
};
