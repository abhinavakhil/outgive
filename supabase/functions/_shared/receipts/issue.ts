// Issuing and sending receipts against the database. Used by stripe-webhook (the moment a gift is paid), receipt-send and year-end-statements.
import { admin, env } from "../deps.ts";
import { send } from "../notify/index.ts";
import { fromRow, giftReceipt, type Receipt, receiptHtml, receiptNumber, receiptPrefix, receiptText, type ReceiptGift, type ReceiptOrg, type ReceiptRow, subject, toRow, yearEndStatement } from "./receipt.ts";

type DB = ReturnType<typeof admin>;
export const ORG_COLS = "id, name, legal_name, ein, address, receipt_prefix, receipt_goods_line, receipt_now, receipt_year_end, color, registration_number";
type Org = ReceiptOrg & { id: string; receipt_now: boolean; receipt_year_end: boolean };

/** The org as printed on its receipts: only the fields a receipt keeps. */
const issuer = (o: Org): ReceiptOrg => ({ name: o.name, legal_name: o.legal_name, ein: o.ein, address: o.address, receipt_prefix: o.receipt_prefix, receipt_goods_line: o.receipt_goods_line, color: o.color, registration_number: o.registration_number });

/** The PDF link in emails. receipt-send is deployed with --no-verify-jwt, so a plain link works; the receipt id is the key. */
export const pdfUrl = (id: string) => `${env("SUPABASE_URL")}/functions/v1/receipt-send?receipt=${id}`;

/** The receipt for a paid gift: the one already issued, or a new one with the next number. Null when the gift is not paid. */
export const issueGift = async (db: DB, donationId: string): Promise<{ row: ReceiptRow; doc: Receipt; org: Org } | null> => {
    const { data: d } = await db.from("donations").select("*").eq("id", donationId).maybeSingle();
    if (!d) return null;
    const { data: org } = await db.from("orgs").select(ORG_COLS).eq("id", d.org_id).single();
    const found = async () => (await db.from("receipts").select("*").eq("donation_id", donationId).maybeSingle()).data as ReceiptRow | null;
    const had = await found();
    if (had) return { row: had, doc: fromRow(had), org: org as Org };
    if (d.status !== "succeeded") return null;
    const year = new Date(d.created_at).getUTCFullYear();
    const { data: n, error: e } = await db.rpc("receipt_next", { org: d.org_id, yr: year, k: "gift" });
    if (e) throw e;
    const doc = giftReceipt(issuer(org as Org), d as ReceiptGift, receiptNumber(receiptPrefix(org as Org), year, Number(n)));
    const { error } = await db.from("receipts").insert(toRow(doc, d.org_id, d.id));
    const row = await found(); // a webhook racing us may have issued it first; theirs wins and our number is a gap
    if (!row) throw error ?? new Error("Could not issue the receipt");
    return { row, doc: fromRow(row), org: org as Org };
};

/** Emails a receipt and records the outcome. True only when an email really went out (the console stand-in does not count). */
export const deliver = async (db: DB, row: ReceiptRow, doc: Receipt) => {
    if (!doc.donor_email) return false;
    const out = await send({ to: doc.donor_email, channel: "email", subject: subject(doc), body: `${receiptText(doc)}\n\nPDF: ${pdfUrl(row.id)}`, html: receiptHtml(doc, pdfUrl(row.id)), orgId: row.org_id });
    const ok = out.ok && out.provider !== "console";
    await db.from("receipts").update(ok ? { sent_at: new Date().toISOString(), send_error: null } : { send_error: out.error ?? `not sent (${out.provider})` }).eq("id", row.id);
    return ok;
};

/**
 * The webhook's hook: issue the gift's receipt and email it when the charity sends receipts right away, or always for a US gift of
 * $250 or more (the IRS acknowledgment). Returns whether it was emailed, which is what sets donations.receipt_sent_at.
 */
export const receiptOnPaid = async (db: DB, donationId: string) => {
    const r = await issueGift(db, donationId);
    if (!r || r.row.sent_at) return !!r?.row.sent_at;
    return r.org.receipt_now || r.doc.irs_ack ? deliver(db, r.row, r.doc) : false;
};

/** A gift as year_end_donors() lists it. */
export interface YearEndGift { donation_id: string; date: string; amount_cents: number; cover_cents: number; tip_cents: number; fund: string; number: string | null }

/** One donor's statement for a year: the one already issued, or a new one. */
export const issueYearEnd = async (db: DB, org: Org, year: number, donor: { donor_email: string; donor_name: string; currency: string; gifts: YearEndGift[] }) => {
    const found = async () => (await db.from("receipts").select("*").eq("org_id", org.id).eq("kind", "year_end").eq("year", year).eq("donor_email", donor.donor_email).maybeSingle()).data as ReceiptRow | null;
    const had = await found();
    if (had) return { row: had, doc: fromRow(had), fresh: false };
    const { data: n, error: e } = await db.rpc("receipt_next", { org: org.id, yr: year, k: "year_end" });
    if (e) throw e;
    const gifts = donor.gifts.map((g) => ({ ...g, id: g.donation_id, created_at: g.date, currency: donor.currency, donor_name: donor.donor_name }));
    const doc = yearEndStatement(issuer(org), { name: donor.donor_name, email: donor.donor_email }, year, gifts, receiptNumber(receiptPrefix(org), year, Number(n), "year_end"));
    const { error } = await db.from("receipts").insert(toRow(doc, org.id, null));
    const row = await found();
    if (!row) throw error ?? new Error("Could not issue the statement");
    return { row, doc: fromRow(row), fresh: true };
};
