// What a receipt says: its lines, totals, number and the IRS wording, and the email, text and PDF versions of it.
// Import-free, so the receipt-send function, the year-end run, the webhook and the Engage screens share it.
// Money is integer cents. The zakat (or any fund) amount stays exact: covered fees and the tip are lines of their own, never mixed in.

/** The receipt fields of an orgs row. */
export interface ReceiptOrg { name: string; legal_name: string; ein: string; address: string; receipt_prefix: string; receipt_goods_line: boolean; color?: string; registration_number?: string }
/** The fields of a donations row a receipt needs. */
export interface ReceiptGift {
    id: string; created_at: string; amount_cents: number; cover_cents: number; tip_cents: number; currency: string;
    fund?: string | null; details?: Record<string, unknown> | null; donor_name: string; donor_email?: string | null; recurring?: boolean; pay_method?: string | null;
}
export interface Line { label: string; amount_cents: number; deductible: boolean; kind: "gift" | "fees" | "tip" }
export interface Receipt {
    kind: "gift" | "year_end"; number: string; year: number; date: string; currency: string;
    org: ReceiptOrg; donor_name: string; donor_email: string | null; fund: string;
    lines: Line[]; deductible_cents: number; total_cents: number;
    /** A single gift of $250 or more: the IRS's contemporaneous written acknowledgment. Always sent, whatever the "receipt now" setting. */
    irs_ack: boolean;
}

/** IRS: a written acknowledgment is needed for any single contribution of $250 or more (26 U.S.C. 170(f)(8)). */
export const IRS_ACK_CENTS = 25_000;
export const GOODS_LINE = "No goods or services were provided in exchange for this contribution.";

const STOP = new Set(["inc", "incorporated", "the", "of", "and", "for", "llc", "corp", "corporation", "co", "ltd", "a", "an"]);
/** The receipt number's prefix: the charity's own, or the initials of its legal name ("Hope Foundation Inc." → HF). */
export const receiptPrefix = (o: Pick<ReceiptOrg, "receipt_prefix" | "legal_name" | "name">) =>
    o.receipt_prefix || ((o.legal_name || o.name).normalize("NFKD").replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w.toLowerCase())).map((w) => w[0]).join("").toUpperCase().slice(0, 6) || "OG");
/** HF-2027-04411 for a gift, HF-2027-YE00012 for a year-end statement. */
export const receiptNumber = (prefix: string, year: number, n: number, kind: Receipt["kind"] = "gift") => `${prefix}-${year}-${kind === "year_end" ? "YE" : ""}${String(n).padStart(5, "0")}`;

export const money = (cents: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);
// ponytail: dates are printed in UTC, and year-end statements cut the year at UTC midnight; use the charity's time zone if a gift at 11pm on Dec 31 lands on the wrong statement.
export const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
export const formatEin = (ein: string) => (ein.length === 9 ? `${ein.slice(0, 2)}-${ein.slice(2)}` : ein);
/** A split key as a line label: an id ("zakat-al-fitr") reads "Zakat al fitr"; a key that is already words keeps its own punctuation. */
const human = (k: string) => { const t = (/s/.test(k.trim()) ? k : k.replace(/[-_]+/g, " ")).trim(); return t ? t[0].toUpperCase() + t.slice(1) : "Gift"; };

/**
 * The lines of one gift. The gift itself comes from details.lines ([{label, amount_cents}]) or details.split ({item: cents}, the give
 * flow's), when they add up to the gift exactly; otherwise it is one line named after the fund. Covered fees are a gift to the charity
 * (deductible); the tip goes to Outgive, so it is shown but is not part of the gift.
 */
export const giftLines = (g: ReceiptGift, orgName: string): Line[] => {
    const d = g.details ?? {}, fund = (g.fund ?? "").trim();
    const given = Array.isArray(d.lines) ? (d.lines as { label?: unknown; amount_cents?: unknown }[]).map((l) => ({ label: String(l.label ?? ""), cents: Number(l.amount_cents) }))
        : d.split && typeof d.split === "object" ? Object.entries(d.split as Record<string, unknown>).map(([k, v]) => ({ label: human(k), cents: Number(v) })) : [];
    const ok = given.length > 0 && given.every((l) => Number.isInteger(l.cents) && l.cents > 0) && given.reduce((n, l) => n + l.cents, 0) === g.amount_cents;
    const lines: Line[] = ok ? given.map((l) => ({ label: l.label || fund || "Gift", amount_cents: l.cents, deductible: true, kind: "gift" })) : [{ label: fund || (g.recurring ? "Monthly gift" : "Gift"), amount_cents: g.amount_cents, deductible: true, kind: "gift" }];
    if (g.cover_cents > 0) lines.push({ label: "Fees covered by donor", amount_cents: g.cover_cents, deductible: true, kind: "fees" });
    if (g.tip_cents > 0) lines.push({ label: `Tip to Outgive (not a gift to ${orgName})`, amount_cents: g.tip_cents, deductible: false, kind: "tip" });
    return lines;
};

const sums = (lines: Line[]) => ({ deductible_cents: lines.filter((l) => l.deductible).reduce((n, l) => n + l.amount_cents, 0), total_cents: lines.reduce((n, l) => n + l.amount_cents, 0) });
const isUS = (o: ReceiptOrg, currency: string) => !!o.ein && currency.toUpperCase() === "USD";

export const giftReceipt = (org: ReceiptOrg, g: ReceiptGift, number: string): Receipt => {
    const lines = giftLines(g, org.legal_name || org.name), t = sums(lines);
    return { kind: "gift", number, year: new Date(g.created_at).getUTCFullYear(), date: g.created_at, currency: g.currency, org, donor_name: g.donor_name, donor_email: g.donor_email ?? null, fund: (g.fund ?? "").trim(), lines, ...t, irs_ack: isUS(org, g.currency) && t.deductible_cents >= IRS_ACK_CENTS };
};

/** One statement per donor for the year: one line per gift (its date, receipt number and fund), fees covered counted in, tips left out. */
export const yearEndStatement = (org: ReceiptOrg, donor: { name: string; email: string }, year: number, gifts: (ReceiptGift & { number?: string | null })[], number: string, now = new Date().toISOString()): Receipt => {
    const lines: Line[] = [...gifts].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((g) => ({
        label: [new Date(g.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }), g.number, (g.fund ?? "").trim() || "Gift"].filter(Boolean).join(" · "),
        amount_cents: g.amount_cents + g.cover_cents, deductible: true, kind: "gift" as const,
    }));
    return { kind: "year_end", number, year, date: now, currency: gifts[0]?.currency ?? "USD", org, donor_name: donor.name, donor_email: donor.email, fund: "", lines, ...sums(lines), irs_ack: false };
};

// ---------------------------------------------------------------- the words
const header = (r: Receipt) => {
    const o = r.org;
    return [o.ein ? `EIN ${formatEin(o.ein)}` : o.registration_number ? `Registered ${o.registration_number}` : "", o.address].filter(Boolean).join(" · ");
};
const totalLabel = (r: Receipt) => (isUS(r.org, r.currency) ? (r.kind === "year_end" ? `Total tax-deductible giving in ${r.year}` : "Total tax-deductible") : "Total gift");
/** The small print under the table, in order. */
export const footNotes = (r: Receipt) => {
    const o = r.org, name = o.legal_name || o.name, us = isUS(o, r.currency);
    const out: string[] = [];
    if (us && o.receipt_goods_line) out.push(GOODS_LINE);
    if (us) out.push(`${name} is a tax-exempt organization under Section 501(c)(3) of the Internal Revenue Code, EIN ${formatEin(o.ein)}. Keep this ${r.kind === "year_end" ? "statement" : "receipt"} for your tax records.`);
    if (r.lines.some((l) => l.kind === "tip")) out.push("The tip went to Outgive, the platform, and is not a contribution to the charity.");
    if (r.kind === "year_end") out.push("This statement lists every gift you made in the year with this email address. Refunded gifts are not included.");
    if (!us) out.push("Keep this as your record; whether a gift is tax-deductible depends on the charity and where you live.");
    return out;
};

export const subject = (r: Receipt) => r.kind === "year_end" ? `Your ${r.year} giving statement from ${r.org.legal_name || r.org.name}` : `Your receipt from ${r.org.legal_name || r.org.name}: ${money(r.deductible_cents, r.currency)}`;

export const receiptText = (r: Receipt) => [
    `${r.org.legal_name || r.org.name}`, header(r), `${r.kind === "year_end" ? `Giving statement ${r.year}` : "Receipt"} ${r.number}`, "",
    `${r.kind === "year_end" ? "Prepared for" : "Received from"} ${r.donor_name} on ${longDate(r.date)}${r.fund ? ` (${r.fund})` : ""}`, "",
    ...r.lines.map((l) => `${l.label}: ${money(l.amount_cents, r.currency)}`), `${totalLabel(r)}: ${money(r.deductible_cents, r.currency)}`, "",
    ...footNotes(r),
].join("\n");

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const receiptHtml = (r: Receipt, pdfUrl?: string) => {
    const c = /^#[0-9a-fA-F]{6}$/.test(r.org.color ?? "") ? r.org.color! : "#1f1714", row = (k: string, v: string, b = false) => `<tr><td style="padding:8px 0;border-top:1px solid #eee;color:${b ? "#1f1714" : "#6b6460"}${b ? ";font-weight:600" : ""}">${esc(k)}</td><td style="padding:8px 0;border-top:1px solid #eee;text-align:right;font-weight:600">${esc(v)}</td></tr>`;
    return `<!doctype html><html><body style="margin:0;background:#f6f5f4;font-family:ui-sans-serif,system-ui,sans-serif;color:#1f1714">
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden">
  <div style="background:${c};padding:24px 28px;color:#fff"><div style="font-size:13px;opacity:.85">${r.kind === "year_end" ? `Giving statement ${r.year}` : "Receipt"} ${esc(r.number)}</div><div style="font-size:22px;font-weight:600">${esc(r.org.legal_name || r.org.name)}</div><div style="font-size:13px;opacity:.85">${esc(header(r))}</div></div>
  <div style="padding:28px">
    <p style="margin:0 0 16px;font-size:16px">${r.kind === "year_end" ? "Prepared for" : "Received from"} <b>${esc(r.donor_name)}</b> on ${esc(longDate(r.date))}${r.fund ? ` (${esc(r.fund)})` : ""}.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">${r.lines.map((l) => row(l.label, money(l.amount_cents, r.currency))).join("")}${row(totalLabel(r), money(r.deductible_cents, r.currency), true)}</table>
    ${footNotes(r).map((f) => `<p style="margin:14px 0 0;font-size:13px;color:#6b6460">${esc(f)}</p>`).join("")}
    ${pdfUrl ? `<p style="margin:16px 0 0;font-size:13px"><a href="${esc(pdfUrl)}" style="color:${c}">Download the PDF</a></p>` : ""}
  </div>
</div></body></html>`;
};

export const receiptPdf = (r: Receipt) => pdf(r.org.legal_name || r.org.name, [header(r), `${r.kind === "year_end" ? `Giving statement ${r.year}` : "Receipt"} ${r.number}`, `${r.kind === "year_end" ? "Prepared for" : "Received from"} ${r.donor_name} on ${longDate(r.date)}${r.fund ? ` (${r.fund})` : ""}`].filter(Boolean),
    [...r.lines.map((l): [string, string] => [l.label, money(l.amount_cents, r.currency)]), [totalLabel(r), money(r.deductible_cents, r.currency)]], footNotes(r));

// ---------------------------------------------------------------- the PDF
// Written by hand: the project has no PDF library and a receipt is a title and a table. Generalised from receiptPdf in
// src/features/launch/give/model.ts: pages break when the table runs long (a year-end statement can list every night of Ramadan).

// ponytail: built-in Helvetica covers Latin-1 only, so other scripts print as "?". Embed a font when donors need non-Latin names on receipts.
export const pdf = (title: string, sub: string[], rows: [string, string][], foot: string[]): string => {
    const esc = (t: string) => t.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?").replace(/[\\()]/g, "\\$&");
    const wrap = (t: string, n: number) => t.split(" ").reduce<string[]>((l, w) => { const last = l.length - 1, next = `${l[last]} ${w}`.trim(); if (next.length > n && l[last]) l.push(w); else l[last] = next; return l; }, [""]);
    const pages: string[] = [""]; let y = 772;
    const text = (x: number, size: number, font: string, grey: number, t: string) => { pages[pages.length - 1] += `BT /${font} ${size} Tf ${grey} g ${x} ${y} Td (${esc(t)}) Tj ET\n`; };
    const room = (h: number) => { if (y - h < 60) { pages.push(""); y = 790; } };
    text(56, 20, "F2", 0.1, title); y -= 26;
    for (const l of sub) { room(16); text(56, 11, "F1", 0.4, l); y -= 16; }
    y -= 14;
    for (const [k, v] of rows) {
        const kl = wrap(k, 40), vl = wrap(v, 34);
        room(Math.max(kl.length, vl.length) * 15 + 11);
        pages[pages.length - 1] += `0.9 G 0.5 w 56 ${y + 16} m 539 ${y + 16} l S\n`;
        const top = y;
        for (const l of kl) { text(56, 11, "F1", 0.4, l); y -= 15; }
        const after = y; y = top;
        for (const l of vl) { text(330, 11, "F2", 0.1, l); y -= 15; }
        y = Math.min(y, after) - 11;
    }
    y -= 12;
    for (const f of foot) for (const l of wrap(f, 95)) { room(14); text(56, 9.5, "F1", 0.4, l); y -= 14; }

    const n = pages.length, font = (name: string) => `<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`;
    // 1 catalog, 2 pages, 3-4 fonts, then a page and its content stream per page.
    const objs = ["<< /Type /Catalog /Pages 2 0 R >>", `<< /Type /Pages /Kids [${pages.map((_, i) => `${5 + i * 2} 0 R`).join(" ")}] /Count ${n} >>`, font("Helvetica"), font("Helvetica-Bold")];
    pages.forEach((body, i) => objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`, `<< /Length ${body.length} >>\nstream\n${body}endstream`));
    let out = "%PDF-1.4\n"; const at: number[] = [];
    objs.forEach((o, i) => { at.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xref = out.length;
    return `${out}xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${at.map((x) => `${String(x).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
};

/** The Latin-1 string as bytes, for a Response body or an email attachment. */
export const pdfBytes = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));

// ---------------------------------------------------------------- the receipts table
/** A receipts row, as stored (supabase/migrations/20261128200000_receipts_ein_fraud.sql). */
export interface ReceiptRow {
    id: string; org_id: string; donation_id: string | null; kind: Receipt["kind"]; year: number; number: string; donor_name: string; donor_email: string | null;
    currency: string; dated: string; fund: string; issuer: ReceiptOrg; lines: Line[]; deductible_cents: number; total_cents: number; irs_ack: boolean;
    sent_at: string | null; send_error: string | null; created_at: string;
}
export const toRow = (r: Receipt, org_id: string, donation_id: string | null) => ({
    org_id, donation_id, kind: r.kind, year: r.year, number: r.number, donor_name: r.donor_name, donor_email: r.donor_email, currency: r.currency, dated: r.date,
    fund: r.fund, issuer: r.org, lines: r.lines, deductible_cents: r.deductible_cents, total_cents: r.total_cents, irs_ack: r.irs_ack,
});
/** The receipt exactly as it was issued, from its row. */
export const fromRow = (x: ReceiptRow): Receipt => ({
    kind: x.kind, number: x.number, year: x.year, date: typeof x.dated === "string" ? x.dated : new Date(x.dated).toISOString(), currency: x.currency, org: x.issuer,
    donor_name: x.donor_name, donor_email: x.donor_email, fund: x.fund, lines: x.lines, deductible_cents: Number(x.deductible_cents), total_cents: Number(x.total_cents), irs_ack: x.irs_ack,
});
