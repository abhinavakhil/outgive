import { describe, expect, it } from "vitest";
import { DEFAULT_FRAUD, evaluate, type FraudEvent, fromProPublica, GOODS_LINE, giftReceipt, isDisposable, parseEin, pdf, receiptHtml, receiptNumber, receiptPdf, receiptPrefix, receiptText, type ReceiptGift, type ReceiptOrg, SANDBOX, verdict, yearEndStatement, fromRow, toRow, type ReceiptRow } from "./model";

const HOPE: ReceiptOrg = { name: "Hope Foundation", legal_name: "Hope Foundation Inc.", ein: "123456789", address: "410 Park Ave, Plainfield, NJ 07060", receipt_prefix: "", receipt_goods_line: true };
const gift = (p: Partial<ReceiptGift> = {}): ReceiptGift => ({ id: "d1", created_at: "2027-03-06T21:00:00Z", amount_cents: 126000, cover_cents: 2862, tip_cents: 0, currency: "USD", fund: "Zakat", donor_name: "Aisha Khan", donor_email: "aisha@example.com", ...p });

describe("receipts", () => {
    it("numbers per charity and year from the legal name's initials", () => {
        expect(receiptPrefix(HOPE)).toBe("HF");
        expect(receiptPrefix({ ...HOPE, receipt_prefix: "HOPE" })).toBe("HOPE");
        expect(receiptPrefix({ ...HOPE, legal_name: "", name: "The Islamic Center of Greater Austin" })).toBe("ICGA");
        expect(receiptPrefix({ ...HOPE, legal_name: "", name: "!!" })).toBe("OG");
        expect(receiptNumber("HF", 2027, 4411)).toBe("HF-2027-04411");
        expect(receiptNumber("HF", 2027, 12, "year_end")).toBe("HF-2027-YE00012");
    });

    it("keeps the zakat amount exact: split lines, fees and the tip each on their own line", () => {
        const r = giftReceipt(HOPE, gift({ details: { split: { zakat: 120000, "zakat-al-fitr": 6000 } }, tip_cents: 500 }), "HF-2027-04411");
        expect(r.lines).toEqual([
            { label: "Zakat", amount_cents: 120000, deductible: true, kind: "gift" },
            { label: "Zakat al fitr", amount_cents: 6000, deductible: true, kind: "gift" },
            { label: "Fees covered by donor", amount_cents: 2862, deductible: true, kind: "fees" },
            { label: "Tip to Outgive (not a gift to Hope Foundation Inc.)", amount_cents: 500, deductible: false, kind: "tip" },
        ]);
        expect(r).toMatchObject({ deductible_cents: 128862, total_cents: 129362, irs_ack: true, year: 2027 });
        // A split that does not add up to the gift is ignored rather than trusted.
        expect(giftReceipt(HOPE, gift({ details: { split: { zakat: 1 } } }), "x").lines[0]).toEqual({ label: "Zakat", amount_cents: 126000, deductible: true, kind: "gift" });
        expect(giftReceipt(HOPE, gift({ details: { lines: [{ label: "Iftar, 30 nights", amount_cents: 126000 }] } }), "x").lines[0].label).toBe("Iftar, 30 nights");
    });

    it("marks the IRS acknowledgment at $250 of deductible money, for US gifts only", () => {
        expect(giftReceipt(HOPE, gift({ amount_cents: 24999, cover_cents: 0, tip_cents: 5000 }), "x").irs_ack).toBe(false);
        expect(giftReceipt(HOPE, gift({ amount_cents: 24000, cover_cents: 1000 }), "x").irs_ack).toBe(true);
        expect(giftReceipt({ ...HOPE, ein: "" }, gift(), "x").irs_ack).toBe(false);
        expect(giftReceipt(HOPE, gift({ currency: "GBP" }), "x").irs_ack).toBe(false);
    });

    it("prints the legal name, EIN, address, date, fund and the goods line (when on)", () => {
        const r = giftReceipt(HOPE, gift(), "HF-2027-04411"), t = receiptText(r);
        for (const s of ["Hope Foundation Inc.", "EIN 12-3456789", "410 Park Ave, Plainfield, NJ 07060", "Receipt HF-2027-04411", "Received from Aisha Khan on March 6, 2027 (Zakat)", "Zakat: $1,260.00", "Fees covered by donor: $28.62", "Total tax-deductible: $1,288.62", GOODS_LINE]) expect(t).toContain(s);
        expect(receiptText(giftReceipt({ ...HOPE, receipt_goods_line: false }, gift(), "x"))).not.toContain(GOODS_LINE);
        const uk = receiptText(giftReceipt({ ...HOPE, ein: "", registration_number: "1100001" }, gift({ currency: "GBP" }), "x"));
        expect(uk).toContain("Total gift: £1,288.62"); expect(uk).not.toContain("501(c)(3)");
        expect(receiptHtml({ ...r, donor_name: "<b>x</b>" }, "https://x/y")).toContain("&lt;b&gt;x&lt;/b&gt;");
    });

    it("year-end statement: one line per gift, tips left out, in date order", () => {
        const s = yearEndStatement(HOPE, { name: "Aisha Khan", email: "aisha@example.com" }, 2027, [
            { ...gift({ id: "b", created_at: "2027-04-01T10:00:00Z", amount_cents: 5000, cover_cents: 0, fund: "Sadaqah" }), number: "HF-2027-00002" },
            { ...gift({ id: "a", tip_cents: 900 }), number: "HF-2027-00001" },
        ], "HF-2027-YE00001", "2028-01-15T12:00:00Z");
        expect(s.lines.map((l) => [l.label, l.amount_cents])).toEqual([["Mar 6, 2027 · HF-2027-00001 · Zakat", 128862], ["Apr 1, 2027 · HF-2027-00002 · Sadaqah", 5000]]);
        expect(s).toMatchObject({ kind: "year_end", deductible_cents: 133862, total_cents: 133862 });
        expect(receiptText(s)).toContain("Total tax-deductible giving in 2027: $1,338.62");
    });

    it("a stored receipt reads back exactly as issued", () => {
        const r = giftReceipt(HOPE, gift(), "HF-2027-04411");
        expect(fromRow({ ...toRow(r, "o", "d1"), id: "r", sent_at: null, send_error: null, created_at: "" } as ReceiptRow)).toEqual(r);
    });

    it("writes a valid PDF, breaking pages when the table runs long", () => {
        const one = receiptPdf(giftReceipt(HOPE, gift(), "HF-2027-04411"));
        expect(one.startsWith("%PDF-1.4")).toBe(true); expect(one).toContain("/Count 1"); expect(one).toContain("(Hope Foundation Inc.)");
        const many = pdf("T", [], Array.from({ length: 80 }, (_, i): [string, string] => [`Night ${i + 1}`, "$10.00"]), ["foot"]);
        expect(many).toMatch(/\/Count [3-9]/);
        // Every xref offset points at its object.
        const offs = [...many.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
        offs.forEach((o, i) => expect(many.slice(o, o + 12)).toMatch(new RegExp(`^${i + 1} 0 obj`)));
        expect(Number(many.match(/startxref\n(\d+)/)![1])).toBe(many.indexOf("xref\n0 "));
    });
});

describe("EIN check", () => {
    it("parses nine digits, with or without the dash, from issued prefixes", () => {
        expect(parseEin("12-3456789")).toBe("123456789");
        expect(parseEin(" 123456789 ")).toBe("123456789");
        for (const bad of ["12-345678", "1234567890", "AB-3456789", "00-1234567", "07-1234567", ""]) expect(parseEin(bad)).toBeNull();
    });

    it("sandbox: 12-3456789 passes, 98-7654321 is revoked, others are not found", () => {
        expect(verdict("123456789", SANDBOX["123456789"], "Hope Foundation Inc.").status).toBe("verified");
        const rev = verdict("987654321", SANDBOX["987654321"]);
        expect(rev.status).toBe("revoked"); expect(rev.steps.find((s) => s.label.includes("auto-revocation"))?.ok).toBe(false);
        expect(verdict("111111111", SANDBOX["111111111"] ?? null).status).toBe("failed");
    });

    it("reads ProPublica's record; only an exempt, deductible 501(c)(3) with a matching name is verified", () => {
        const red = fromProPublica({ organization: { name: "American National Red Cross", city: "Washington", state: "DC", subsection_code: 3, deductibility_code: 1, exempt_organization_status_code: 1 } });
        expect(verdict("530196605", red, "The American National Red Cross").status).toBe("verified");
        expect(verdict("530196605", red, "Red Crescent Relief").status).toBe("review");
        expect(verdict("530196605", { ...red, subsection: 4 }).status).toBe("failed");
        expect(verdict("530196605", { ...red, deductibility: 2 }).status).toBe("failed");
        expect(verdict("530196605", fromProPublica(null)).status).toBe("failed");
    });
});

describe("fraud rules", () => {
    const now = "2027-03-06T02:14:00Z", ago = (min: number) => new Date(Date.parse(now) - min * 60_000).toISOString();
    const ev = (kind: FraudEvent["kind"], min: number, p: Partial<FraudEvent> = {}): FraudEvent => ({ kind, at: ago(min), attempt_key: `k${Math.random()}`, ip_hash: "ip1", ...p });
    const a = (p = {}) => ({ amount_cents: 2500, email: "donor@gmail.com", ip_hash: "ip1", attempt_key: "this", now, ...p });

    it("blocks gifts under the minimum and disposable emails", () => {
        expect(evaluate(DEFAULT_FRAUD, a({ amount_cents: 499 }), [])).toEqual({ action: "block", reason: "below_minimum" });
        expect(evaluate(DEFAULT_FRAUD, a({ email: "x@Mailinator.com" }), [])).toEqual({ action: "block", reason: "disposable_email" });
        expect(evaluate({ ...DEFAULT_FRAUD, block_disposable: false }, a({ email: "x@mailinator.com" }), [])).toEqual({ action: "allow" });
        expect(isDisposable("a@sub.yopmail.com")).toBe(true); expect(isDisposable("a@gmail.com")).toBe(false); expect(isDisposable(null)).toBe(false);
    });

    it("allows 5 attempts per IP in 10 minutes; a retry of the same attempt does not count", () => {
        const four = [1, 2, 3, 4].map((m) => ev("attempt", m));
        expect(evaluate(DEFAULT_FRAUD, a(), four).action).toBe("allow");
        expect(evaluate(DEFAULT_FRAUD, a(), [...four, ev("block", 5)])).toEqual({ action: "block", reason: "ip_rate" });
        expect(evaluate(DEFAULT_FRAUD, a(), [...four, ev("attempt", 11)]).action).toBe("allow");
        expect(evaluate(DEFAULT_FRAUD, a(), [...four, ev("attempt", 5, { attempt_key: "this" })]).action).toBe("allow");
        expect(evaluate(DEFAULT_FRAUD, a(), [...four, ev("attempt", 5, { ip_hash: "ip2" })]).action).toBe("allow");
        expect(evaluate(DEFAULT_FRAUD, a({ ip_hash: null }), [...four, ev("attempt", 5)]).action).toBe("allow");
    });

    it("allows 3 attempts per card in an hour", () => {
        const card = [10, 20, 30].map((m) => ev("attempt", m, { ip_hash: `x${m}`, card_fp: "fp" }));
        expect(evaluate(DEFAULT_FRAUD, a({ card_fp: "fp" }), card)).toEqual({ action: "block", reason: "card_rate" });
        expect(evaluate(DEFAULT_FRAUD, a({ card_fp: "fp" }), card.slice(1)).action).toBe("allow");
    });

    it("challenges after 2 declines from the IP; a passed challenge goes ahead, a failed one is blocked", () => {
        const d = [ev("decline", 3), ev("decline", 30)];
        expect(evaluate(DEFAULT_FRAUD, a(), d.slice(1)).action).toBe("allow");
        expect(evaluate(DEFAULT_FRAUD, a(), d)).toEqual({ action: "challenge" });
        expect(evaluate(DEFAULT_FRAUD, a(), d, true)).toEqual({ action: "allow" });
        expect(evaluate(DEFAULT_FRAUD, a(), d, false)).toEqual({ action: "block", reason: "challenge_failed" });
        expect(evaluate({ ...DEFAULT_FRAUD, challenge_after: 0 }, a(), d).action).toBe("allow");
        expect(evaluate(DEFAULT_FRAUD, a(), [ev("decline", 70), ev("decline", 80)]).action).toBe("allow");
    });
});
