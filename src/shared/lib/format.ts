export const initials = (n: string) => n.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
export const ago = (t: number) => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? "just now" : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} hrs` : `${Math.round(m / 1440)} d`; };
export const dateOf = (t: number | string) => new Date(t).toLocaleDateString("en", { day: "numeric", month: "long", year: "numeric" });
