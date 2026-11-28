// Receipts on demand. Deployed with --no-verify-jwt so the PDF link in a receipt email opens with no sign-in; ids are the keys.
//   GET  ?receipt=<id>                          the PDF of any issued receipt or year-end statement (the email's link)
//   POST {donation_id, format?: "json"|"pdf"}   the thank-you page: the paid gift's receipt, issued now if it was not yet
//   POST {receipt_id | donation_id, action: "send"}  email it again; the caller must be an editor or higher of the charity
import { admin, asUser, CORS, fail, json, serve } from "../_shared/deps.ts";
import { deliver, issueGift, pdfUrl } from "../_shared/receipts/issue.ts";
import { fromRow, pdfBytes, type Receipt, receiptPdf, receiptText, type ReceiptRow } from "../_shared/receipts/receipt.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pdfResponse = (doc: Receipt) => new Response(pdfBytes(receiptPdf(doc)), { headers: { ...CORS, "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${doc.number}.pdf"`, "Cache-Control": "private, max-age=300" } });

serve(async (req) => {
    const db = admin();
    if (req.method === "GET") {
        const id = new URL(req.url).searchParams.get("receipt") ?? "";
        if (!UUID.test(id)) return fail("Receipt not found", 404);
        const { data } = await db.from("receipts").select("*").eq("id", id).maybeSingle();
        return data ? pdfResponse(fromRow(data as ReceiptRow)) : fail("Receipt not found", 404);
    }
    const b = (await req.json().catch(() => ({}))) as { donation_id?: string; receipt_id?: string; format?: "json" | "pdf"; action?: "send" };
    if (b.donation_id !== undefined && !UUID.test(b.donation_id)) return fail("donation_id must be a uuid");
    if (b.receipt_id !== undefined && !UUID.test(b.receipt_id)) return fail("receipt_id must be a uuid");

    let r: { row: ReceiptRow; doc: Receipt } | null = null;
    if (b.receipt_id) { const { data } = await db.from("receipts").select("*").eq("id", b.receipt_id).maybeSingle(); r = data ? { row: data as ReceiptRow, doc: fromRow(data as ReceiptRow) } : null; }
    else if (b.donation_id) r = await issueGift(db, b.donation_id);
    else return fail("donation_id or receipt_id is required");
    if (!r) return fail("There is no receipt for this gift yet: it is not paid.", 404);

    if (b.action === "send") {
        const { data: ok } = await asUser(req).rpc("has_role", { org: r.row.org_id, min: "editor" });
        if (ok !== true) return fail("Only the charity's team can resend receipts", 403);
        const sent = await deliver(db, r.row, r.doc);
        if (sent && r.row.donation_id) await db.from("donations").update({ receipt_sent_at: new Date().toISOString() }).eq("id", r.row.donation_id);
        return json({ sent });
    }
    if (b.format === "pdf") return pdfResponse(r.doc);
    return json({ id: r.row.id, receipt: r.doc, text: receiptText(r.doc), pdf_url: pdfUrl(r.row.id), sent_at: r.row.sent_at });
});
