// Donation receipts through Resend. Nothing is sent until RESEND_API_KEY is set; the webhook then marks receipt_sent_at.

export interface Receipt { to: string; donorName: string; orgName: string; orgRegistration: string; orgCountry: string; amount: string; tip: string; total: string; date: string; donationId: string; pageTitle: string; pageUrl: string; recurring: boolean; dedication: string; brandColor: string }

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Plain, printable receipt. Charities add their own tax wording through the registration line; nothing here claims deductibility. */
export const receiptHtml = (r: Receipt) => `<!doctype html><html><body style="margin:0;background:#f6f5f4;font-family:ui-sans-serif,system-ui,sans-serif;color:#1f1714">
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden">
  <div style="background:${esc(r.brandColor)};padding:24px 28px;color:#fff"><div style="font-size:13px;opacity:.85">Receipt from</div><div style="font-size:22px;font-weight:600">${esc(r.orgName)}</div></div>
  <div style="padding:28px">
    <p style="margin:0 0 16px;font-size:16px">Thank you${r.donorName && r.donorName !== "Anonymous" ? `, ${esc(r.donorName.split(" ")[0])}` : ""}. Your ${r.recurring ? "monthly " : ""}gift to <b>${esc(r.pageTitle)}</b> has been received.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:8px 0;color:#6b6460">Gift</td><td style="padding:8px 0;text-align:right;font-weight:600">${esc(r.amount)}</td></tr>
      ${r.tip ? `<tr><td style="padding:8px 0;color:#6b6460">Tip to Outgive</td><td style="padding:8px 0;text-align:right">${esc(r.tip)}</td></tr>` : ""}
      <tr><td style="padding:8px 0;border-top:1px solid #eee;color:#6b6460">Charged</td><td style="padding:8px 0;border-top:1px solid #eee;text-align:right;font-weight:600">${esc(r.total)}</td></tr>
      <tr><td style="padding:8px 0;color:#6b6460">Date</td><td style="padding:8px 0;text-align:right">${esc(r.date)}</td></tr>
      <tr><td style="padding:8px 0;color:#6b6460">Reference</td><td style="padding:8px 0;text-align:right;font-family:ui-monospace,monospace;font-size:12px">${esc(r.donationId)}</td></tr>
      ${r.dedication ? `<tr><td style="padding:8px 0;color:#6b6460">Dedication</td><td style="padding:8px 0;text-align:right">${esc(r.dedication)}</td></tr>` : ""}
    </table>
    <p style="margin:20px 0 0;font-size:13px;color:#6b6460">${esc(r.orgName)}${r.orgRegistration ? `, registered ${esc(r.orgRegistration)}` : ""}${r.orgCountry ? ` in ${esc(r.orgCountry)}` : ""}. The gift was paid to ${esc(r.orgName)} through Stripe. Keep this email as your record; whether a gift is tax-deductible depends on the charity and where you live.</p>
    <p style="margin:16px 0 0;font-size:13px"><a href="${esc(r.pageUrl)}" style="color:${esc(r.brandColor)}">See the page</a></p>
  </div>
</div></body></html>`;

export const sendReceipt = async (r: Receipt) => {
    const key = Deno.env.get("RESEND_API_KEY"); if (!key) return false;
    const from = Deno.env.get("RECEIPT_FROM") ?? "Outgive <receipts@outgive.org>";
    const res = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [r.to], subject: `Your gift to ${r.orgName}: ${r.amount}`, html: receiptHtml(r) }) });
    if (!res.ok) { console.error("resend", res.status, await res.text()); return false; }
    return true;
};
