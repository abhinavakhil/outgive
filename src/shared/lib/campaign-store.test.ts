import { beforeEach, expect, test } from "vitest";

// A minimal browser: a cookie jar that honours Max-Age=0, and localStorage.
const jar = new Map<string, string>();
const store = new Map<string, string>();
Object.assign(globalThis, {
    document: {
        get cookie() { return [...jar].map(([k, v]) => `${k}=${v}`).join("; "); },
        set cookie(s: string) { const [kv, ...attrs] = s.split("; "); const i = kv.indexOf("="); const k = kv.slice(0, i); if (attrs.includes("Max-Age=0")) jar.delete(k); else jar.set(k, kv.slice(i + 1)); },
    },
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
    location: { protocol: "http:" },
});
const { campaigns } = await import("./campaign-store");

beforeEach(() => { jar.clear(); store.clear(); });
const base = { type: "fundraiser" as const, slug: "help-priya", title: "Help Priya walk again", charity: "Clearwell Trust", goal: 2500, lead: "Priya is 9.", body: "", gifts: [10, 25], details: {}, photos: ["data:image/jpeg;base64,AAA"] };

test("creates, finds and lists a campaign; photos stay out of the cookies", async () => {
    const c = await campaigns.create(base);
    expect(await campaigns.get("fundraiser", "help-priya")).toMatchObject({ id: c.id, title: base.title, photos: base.photos });
    expect((await campaigns.list()).map((x) => x.id)).toEqual([c.id]);
    expect([...jar.values()].join("")).not.toContain("base64");
});

test("only the ids ride in the cookie, however long the story; a long story with ₹ and emoji survives", async () => {
    const body = "₹2,50,000 for surgery 🙏 ".repeat(400);
    const c = await campaigns.create({ ...base, body });
    expect([...jar.keys()]).toEqual(["og_cs"]);
    expect(jar.get("og_cs")).toBe(c.id);
    expect((await campaigns.get("fundraiser", "help-priya"))!.body).toBe(body);
    await campaigns.update(c.id, { body: "short" });
    expect((await campaigns.get("fundraiser", "help-priya"))!.body).toBe("short");
});

test("a record from the old chunked-cookie format is moved into localStorage", async () => {
    const old = { id: "abc12345", type: "team", slug: "old-team", title: "Old team", charity: "", goal: 10, lead: "", body: "", gifts: [5], details: {}, createdAt: 1, raised: 0, donations: [] };
    const raw = encodeURIComponent(JSON.stringify(old));
    jar.set("og_cs", "abc12345"); jar.set("og_c_abc12345", "2"); jar.set("og_c_abc12345_0", raw.slice(0, 50)); jar.set("og_c_abc12345_1", raw.slice(50));
    expect(await campaigns.get("team", "old-team")).toMatchObject({ title: "Old team" });
    expect([...jar.keys()]).toEqual(["og_cs"]);
});

test("slugs stay unique, gifts add up, and removing cleans up", async () => {
    await campaigns.create(base);
    const second = await campaigns.create(base);
    expect(second.slug).toBe("help-priya-2");
    const after = await campaigns.donate(second.id, { name: "Sam", usd: 25, message: "Go Priya", at: 1 });
    expect(after).toMatchObject({ raised: 25, donations: [{ name: "Sam" }] });
    await campaigns.remove(second.id);
    expect(await campaigns.get("fundraiser", "help-priya-2")).toBeNull();
    expect(store.has(`og_p_${second.id}`)).toBe(false);
});
