export const initials = (n: string) => n.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
export const ago = (t: number) => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? "just now" : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} hrs` : `${Math.round(m / 1440)} d`; };
/** Rows as CSV text, headed by the first row's keys. */
export const csv = (rows: Record<string, unknown>[]) => { if (!rows.length) return ""; const keys = Object.keys(rows[0]); const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`; return [keys.join(","), ...rows.map((r) => keys.map((k) => q(r[k])).join(","))].join("\n"); };
export const download = (name: string, text: string) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" })); a.download = name; a.click(); URL.revokeObjectURL(a.href); };
export const dateOf =(t: number | string) => new Date(t).toLocaleDateString("en", { day: "numeric", month: "long", year: "numeric" });
