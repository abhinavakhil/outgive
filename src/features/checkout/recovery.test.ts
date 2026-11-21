import { describe, expect, it } from "vitest";
import { DRAFT_TTL, canEmailRecovery, clearDraft, fromDraft, fromServer, keepDraft, loadDraft, recoveryRequest, resumeId, resumeLink, saveDraft, toDraft } from "./recovery";

const fake = () => { const m = new Map<string, string>(); return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };
/** A checkout state mid-payment, with everything sensitive filled in. */
const state = {
    step: 3, amount: 50, amountText: "50", freq: "monthly", picks: { cover: true, tribute: false }, fund: "water", ga: true, recover: true,
    first: " Amara ", last: "Okafor", email: "amara@example.org", postcode: "LS9 7AB", address: "1 High St",
    card: "4242 4242 4242 4242", exp: "12/30", cvc: "123", holder: "A OKAFOR", ddName: "A Okafor", sort: "20-00-00", acct: "55779911", bank: "monzo",
};
const NOW = 1_800_000_000_000;

describe("checkout draft", () => {
    it("keeps only the non-sensitive fields", () => {
        const d = toDraft("sample", state, null, NOW);
        expect(Object.keys(d).sort()).toEqual(["amount", "campaign", "consent", "email", "extras", "first", "freq", "fund", "ga", "id", "savedAt", "step"]);
        expect(d).toMatchObject({ amount: 50, freq: "monthly", extras: ["cover"], fund: "water", ga: true, first: "Amara", email: "amara@example.org", step: 3, consent: true });
        const json = JSON.stringify({ ...d, id: "t" }); // the random id could spell a "secret" by chance
        for (const secret of ["4242", "123", "12/30", "20-00-00", "55779911", "LS9", "High St", "Okafor", "OKAFOR", "monzo"]) expect(json).not.toContain(secret);
    });
    it("saves per campaign, keeps its id across saves, and restores", () => {
        const s = fake();
        const a = saveDraft("sample", state, s, NOW)!; const b = saveDraft("sample", { ...state, amount: 75 }, s, NOW + 1000)!;
        saveDraft("f/other", { ...state, amount: 10 }, s, NOW);
        expect(b.id).toBe(a.id);
        expect(loadDraft("sample", null, s, NOW + 2000)?.amount).toBe(75);
        expect(loadDraft("f/other", null, s, NOW)?.amount).toBe(10);
        expect(loadDraft("sample", "someone-elses-id", s, NOW)).toBeNull();
        expect(loadDraft("sample", a.id, s, NOW)?.id).toBe(a.id);
        clearDraft("sample", s); expect(loadDraft("sample", null, s, NOW)).toBeNull();
    });
    it("restores to the details step at most, with the payment typed again", () => {
        const r = fromDraft(toDraft("sample", state, null, NOW));
        expect(r).toEqual({ amount: 50, amountText: "50", amountSource: "resumed", freq: "monthly", picks: { cover: true }, fund: "water", ga: true, first: "Amara", email: "amara@example.org", recover: true, step: 2 });
    });
    it("expires after seven days and is removed", () => {
        const s = fake(); saveDraft("sample", state, s, NOW);
        expect(loadDraft("sample", null, s, NOW + DRAFT_TTL - 1)).not.toBeNull();
        expect(loadDraft("sample", null, s, NOW + DRAFT_TTL + 1)).toBeNull();
        expect(s.m.size).toBe(0);
    });
    it("a finished gift is not saved; broken or missing storage is survived", () => {
        const s = fake();
        expect(saveDraft("sample", { ...state, step: 4 }, s, NOW)).toBeNull(); expect(s.m.size).toBe(0);
        s.m.set("outgive.checkout.draft.sample", "{not json"); expect(loadDraft("sample", null, s, NOW)).toBeNull();
        expect(saveDraft("sample", state, null, NOW)?.amount).toBe(50);
        expect(saveDraft("sample", state, { getItem: () => null, removeItem: () => {}, setItem: () => { throw new Error("full"); } }, NOW)?.amount).toBe(50);
    });
});

describe("recovery email consent", () => {
    const d = toDraft("sample", state, null, NOW);
    it("needs the explicit opt-in", () => {
        expect(canEmailRecovery(d, NOW)).toBe(true);
        expect(canEmailRecovery({ ...d, consent: false }, NOW)).toBe(false);
        expect(canEmailRecovery(toDraft("sample", { ...state, recover: undefined }, null, NOW), NOW)).toBe(false);
        expect(canEmailRecovery({ ...d, consent: "yes" as unknown as boolean }, NOW)).toBe(false);
        expect(recoveryRequest({ ...d, consent: false }, NOW)).toBeNull();
    });
    it("needs an email address, an unfinished gift and a draft in date", () => {
        expect(canEmailRecovery({ ...d, email: "amara@" }, NOW)).toBe(false);
        expect(canEmailRecovery({ ...d, step: 4 }, NOW)).toBe(false);
        expect(canEmailRecovery(d, NOW + DRAFT_TTL + 1)).toBe(false);
        expect(canEmailRecovery(null, NOW)).toBe(false);
    });
    it("the request carries the token, the consent and no more than the draft", () => {
        expect(recoveryRequest(d, NOW)).toEqual({ p: { token: d.id, email: "amara@example.org", campaign: "sample", consent: true, draft: { amount: 50, freq: "monthly", extras: ["cover"], fund: "water", ga: true, first: "Amara", step: 3 } } });
    });
    it("a server draft restores in another browser", () => {
        const back = fromServer(d.id, { campaign: "sample", email: d.email, created_at: new Date(NOW).toISOString(), draft: { amount: 50, freq: "monthly", extras: ["cover"], first: "Amara", step: 3 } });
        expect(back).toMatchObject({ id: d.id, amount: 50, freq: "monthly", extras: ["cover"], fund: "", ga: false, consent: true, savedAt: NOW });
        expect(fromServer(d.id, null)).toBeNull();
    });
});

describe("resume links", () => {
    const o = "https://www.outgive.tech";
    it("point at the checkout for that campaign", () => {
        expect(resumeLink("sample", "abc", o)).toBe(`${o}/checkout?resume=abc`);
        expect(resumeLink("f/help-priya", "abc", o)).toBe(`${o}/checkout?campaign=f%2Fhelp-priya&resume=abc`);
        expect(resumeLink("org/mangrove", "abc", o)).toBe(`${o}/o/mangrove/checkout?resume=abc`);
        expect(resumeLink("org/clearwell", "abc", o)).toBe(`${o}/demo/checkout?resume=abc`);
        expect(resumeLink("ramadan-2027", "abc", o, "/appeals/ramadan?x=1")).toBe(`${o}/appeals/ramadan?x=1&resume=abc`);
    });
    it("round-trip the draft id", () => {
        const u = new URL(resumeLink("f/help-priya", "id-1", o));
        expect(resumeId(u.search)).toBe("id-1"); expect(u.searchParams.get("campaign")).toBe("f/help-priya"); expect(resumeId("?x=1")).toBeNull();
    });
    it("keep a draft fetched from the server under its own id, so the same link opens it again", () => {
        const s = fake(), d = fromServer("tok-9", { campaign: "sample", email: "a@example.org", draft: { amount: 40, step: 2 }, created_at: new Date().toISOString() })!;
        keepDraft(d, s);
        expect(loadDraft("sample", "tok-9", s)).toMatchObject({ id: "tok-9", amount: 40, consent: true });
        expect(saveDraft("sample", { ...state, step: 1 }, s)?.id).toBe("tok-9"); // later saves keep the token
    });
});
