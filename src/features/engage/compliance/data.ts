/**
 * The Receipts and safety screen's data. Live: the SQL API and edge functions through ./api. Demo (ws.sample): the prototype's
 * Hope Foundation, kept in memory, so every action works and nothing is sent; the EIN check runs the sandbox verdict in the browser.
 * The Overview's "Receipts to send" and "EINs to verify" read useComplianceTodos below, so they agree with this screen.
 */
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/shared/lib/app-context";
import { SUPABASE_URL } from "@/shared/lib/db";
import { useWorkspace } from "../shell/workspace";
import * as api from "./api";
import { type Compliance, type ComplianceInput, DEFAULT_FRAUD, type EinResult, type FraudLog, type FraudSettings, type ReceiptGift, type ReceiptOrg, type ReceiptRow, SANDBOX, fromRow, giftReceipt, parseEin, receiptNumber, receiptPdf, receiptPrefix, toRow, verdict } from "./model";

// ---------------------------------------------------------------- the sample
const ORG: ReceiptOrg = { name: "Hope Foundation", legal_name: "Hope Foundation Inc.", ein: "123456789", address: "410 Park Ave, Plainfield, NJ 07060", receipt_prefix: "", receipt_goods_line: true };
const sampleCompliance = (): Compliance => ({
    legal_name: ORG.legal_name, ein: ORG.ein, address: ORG.address, contact_email: "", ein_status: "unverified", ein_checked_at: null, ein_check: null,
    receipt_prefix: "", receipt_now: true, receipt_year_end: true, receipt_goods_line: true, receipts_unsent: 3, payments_ready: false, fraud: { ...DEFAULT_FRAUD },
});
const NIGHT = (n: number, h = 2) => new Date(Date.UTC(2027, 1, 7 + n - 1, h)).toISOString();
const GIFTS: [string, number, string, number, number, Record<string, number> | null][] = [
    ["Aisha Khan", 27, "Zakat", 126000, 2862, { zakat: 120000, "zakat al-Fitr, 4 people": 6000 }], ["Yusuf Rahman", 27, "Sadaqah", 50000, 0, null],
    ["Omar Siddiqui", 26, "Zakat", 250000, 5660, null], ["Fatima Malik", 25, "Zakat al-Fitr", 6000, 0, null], ["Bilal Ahmed", 25, "Building fund", 100000, 2280, null],
    ["Hana Yusuf", 24, "Sadaqah", 2500, 103, null], ["Ibrahim Patel", 23, "Zakat", 75000, 0, null], ["Maryam Ali", 23, "Fidya", 18000, 0, null],
    ["Zaid Hassan", 22, "Sadaqah", 10000, 320, null], ["Sara Qureshi", 21, "Zakat", 30000, 0, null], ["Khalid Mansour", 21, "Building fund", 25000, 0, null], ["Noor Abbas", 20, "Sadaqah", 5000, 0, null],
];
const sampleReceipts = (): ReceiptRow[] => GIFTS.map(([name, night, fund, amount, cover, split], i) => {
    const g: ReceiptGift = { id: `sample-gift-${i}`, created_at: NIGHT(night), amount_cents: amount, cover_cents: cover, tip_cents: 0, currency: "USD", fund, details: split ? { split } : {}, donor_name: name, donor_email: `${name.toLowerCase().replace(" ", ".")}@example.com` };
    const r = giftReceipt(ORG, g, receiptNumber("HF", 2027, 4411 - i));
    return { ...toRow(r, "sample", g.id), id: `sample-receipt-${i}`, sent_at: i >= 1 && i <= 3 ? null : new Date(Date.parse(g.created_at) + 60_000).toISOString(), send_error: i >= 1 && i <= 3 ? "not sent (sample)" : null, created_at: g.created_at } as ReceiptRow;
});
const at = (day: number, h: number, m: number) => new Date(Date.UTC(2027, 2, day, h + 5, m)).toISOString(); // New York time
const sampleLog = (): FraudLog => ({
    blocked: 412, challenged: 23, declines: 64,
    by_reason: [{ reason: "below_minimum", n: 188, last: at(14, 2, 13) }, { reason: "ip_rate", n: 96, last: at(14, 2, 14) }, { reason: "card_rate", n: 57, last: at(12, 4, 2) }, { reason: "challenge_failed", n: 41, last: at(13, 23, 40) }, { reason: "disposable_email", n: 30, last: at(11, 19, 15) }],
    recent: [
        { at: at(14, 2, 14), kind: "block", reason: "ip_rate", amount_cents: 100, email_domain: "gmail.com" }, { at: at(14, 2, 13), kind: "block", reason: "below_minimum", amount_cents: 100, email_domain: "gmail.com" },
        { at: at(13, 23, 40), kind: "block", reason: "challenge_failed", amount_cents: 2500, email_domain: "outlook.com" }, { at: at(13, 23, 31), kind: "alert", reason: "decline_burst", amount_cents: null, email_domain: null },
        { at: at(12, 4, 2), kind: "block", reason: "card_rate", amount_cents: 2500, email_domain: "gmail.com" }, { at: at(11, 19, 15), kind: "block", reason: "disposable_email", amount_cents: 5000, email_domain: "mailinator.com" },
    ],
    alerts: [{ at: at(13, 23, 31), reason: "decline_burst" }],
});
/** The demo's in-memory state, kept across screens so the Overview sees the same changes. */
const demo: { c?: Compliance; receipts?: ReceiptRow[]; log?: FraudLog } = {};

// ---------------------------------------------------------------- the screen's store
export type Store = {
    state: "loading" | "ready" | "error"; error?: string;
    c: Compliance; receipts: ReceiptRow[]; log: FraudLog; issuer: ReceiptOrg;
    save: (p: ComplianceInput) => Promise<void>;
    checkEin: (ein: string) => Promise<EinResult>;
    saveFraud: (p: Partial<FraudSettings>) => Promise<void>;
    resend: (id: string) => Promise<boolean>;
    yearEnd: (year: number, dry: boolean) => Promise<{ donors: number; issued: number; sent: number }>;
    /** Opens the receipt's PDF: the receipt-send link live, a file made in the browser in the demo. */
    pdf: (r: ReceiptRow) => void;
};

const listeners = new Set<() => void>();
const changed = () => { todos.clear(); listeners.forEach((f) => f()); };
const issuerOf = (c: Compliance, name: string): ReceiptOrg => ({ name, legal_name: c.legal_name, ein: c.ein, address: c.address, receipt_prefix: c.receipt_prefix, receipt_goods_line: c.receipt_goods_line });

export const useCompliance = (): Store => {
    const { db } = useApp();
    const ws = useWorkspace(), org = ws.org.id;
    const [data, setData] = useState<{ c: Compliance; receipts: ReceiptRow[]; log: FraudLog } | null>(null);
    const [state, setState] = useState<Store["state"]>("loading");
    const [error, setError] = useState<string>();

    const load = useCallback(async () => {
        if (ws.sample) { setData({ c: demo.c ??= sampleCompliance(), receipts: demo.receipts ??= sampleReceipts(), log: demo.log ??= sampleLog() }); setState("ready"); return; }
        try {
            const [c, receipts, log] = await Promise.all([api.getCompliance(db, org), api.listReceipts(db, org), api.fraudLog(db, org)]);
            setData({ c, receipts: receipts ?? [], log }); setState("ready");
        } catch (e) { setError((e as Error).message); setState("error"); }
    }, [db, org, ws.sample]);
    useEffect(() => { void load(); }, [load]);

    const c = data?.c ?? sampleCompliance();
    const after = async <T,>(f: () => Promise<T>) => { const r = await f(); changed(); await load(); return r; };
    return {
        state, error, c, receipts: data?.receipts ?? [], log: data?.log ?? sampleLog(), issuer: issuerOf(c, ws.org.name),
        save: async (p) => {
            if (!ws.sample) {
                const { contact_email, ...rest } = p;
                await after(async () => { if (contact_email !== undefined && contact_email !== c.contact_email) await api.saveContactEmail(db, org, contact_email); return api.saveCompliance(db, org, rest); });
                return;
            }
            if (p.contact_email && !/^[^s@]+@[^s@]+.[^s@]+$/.test(p.contact_email)) throw new Error("That contact email does not look right");
            const ein = p.ein === undefined ? c.ein : (parseEin(p.ein) ?? c.ein);
            const reset = ein !== c.ein || (p.legal_name !== undefined && p.legal_name.trim() !== c.legal_name);
            demo.c = { ...c, ...p, ein, legal_name: p.legal_name?.trim() ?? c.legal_name, contact_email: p.contact_email?.trim().toLowerCase() ?? c.contact_email, ...(reset ? { ein_status: "unverified" as const, payments_ready: false } : {}) };
            changed(); await load();
        },
        checkEin: async (raw) => {
            if (!ws.sample) return after(() => api.checkEin(db, org, raw, true));
            const ein = parseEin(raw);
            if (!ein) return { ein: raw, status: "failed", record: null, steps: [{ label: "Format: nine digits", ok: false }], message: "An EIN has nine digits, written 12-3456789." };
            const rec = SANDBOX[ein] ?? { found: false, name: "", city: "", state: "", subsection: null, deductibility: null, revoked: false };
            const out = verdict(ein, rec, c.legal_name);
            demo.c = { ...c, ein, ein_status: out.status, ein_checked_at: new Date().toISOString(), payments_ready: out.status === "verified",
                ein_check: { ein, source: "sandbox", found: rec.found, name: rec.name, city: rec.city, state: rec.state, subsection: rec.subsection, deductibility: rec.deductibility, revoked: rec.revoked, checked_at: new Date().toISOString() } };
            changed(); await load();
            return out;
        },
        saveFraud: async (p) => {
            if (!ws.sample) { await after(() => api.saveFraud(db, org, p)); return; }
            demo.c = { ...c, fraud: { ...c.fraud, ...p } }; await load();
        },
        resend: async (id) => {
            if (!ws.sample) return (await after(() => api.resendReceipt(db, id))).sent;
            demo.receipts = (demo.receipts ?? []).map((r) => (r.id === id ? { ...r, sent_at: new Date().toISOString(), send_error: null } : r));
            demo.c = { ...c, receipts_unsent: demo.receipts.filter((r) => !r.sent_at).length };
            changed(); await load();
            return true;
        },
        yearEnd: async (year, dry) => {
            if (!ws.sample) return after(() => api.runYearEnd(db, org, year, dry));
            return { donors: 3872, issued: dry ? 0 : 3872, sent: 0 };
        },
        pdf: (r) => {
            if (!ws.sample && SUPABASE_URL) { window.open(`${SUPABASE_URL}/functions/v1/receipt-send?receipt=${r.id}`, "_blank", "noopener"); return; }
            const s = receiptPdf(fromRow(r)), url = URL.createObjectURL(new Blob([Uint8Array.from(s, (ch) => ch.charCodeAt(0))], { type: "application/pdf" }));
            const a = document.createElement("a"); a.href = url; a.download = `${r.number}.pdf`; a.click();
            setTimeout(() => URL.revokeObjectURL(url), 10_000);
        },
    };
};

/** The receipt every new gift would get with these settings: the prototype's Night 27 Zakat gift, numbered as the next receipt. */
export const previewOf = (issuer: ReceiptOrg, last?: ReceiptRow) => {
    const next = last ? Number(last.number.match(/(\d+)$/)?.[1] ?? 0) + 1 : 1;
    return giftReceipt(issuer, { id: "preview", created_at: NIGHT(27), amount_cents: 126000, cover_cents: 2862, tip_cents: 0, currency: "USD", fund: "Zakat", details: { split: { zakat: 120000, "zakat al-Fitr, 4 people": 6000 } }, donor_name: "Aisha Khan" },
        receiptNumber(receiptPrefix(issuer), 2027, next));
};

// ---------------------------------------------------------------- the Overview's to-dos
export type ComplianceTodos = { unsent: number; einToVerify: number };
const todos = new Map<string, Promise<ComplianceTodos | null>>();
/** Receipts to send and EINs to verify (0 or 1: one charity). Null until loaded, or when unavailable. */
export const useComplianceTodos = (): ComplianceTodos | null => {
    const { db } = useApp();
    const ws = useWorkspace();
    const [s, setS] = useState<ComplianceTodos | null>(null);
    useEffect(() => {
        let off = false;
        const read = () => {
            if (ws.sample) { const c = demo.c ?? sampleCompliance(); setS({ unsent: c.receipts_unsent, einToVerify: c.payments_ready ? 0 : 1 }); return; }
            if (!todos.has(ws.org.id)) todos.set(ws.org.id, api.getCompliance(db, ws.org.id).then((c) => ({ unsent: c.receipts_unsent, einToVerify: c.payments_ready ? 0 : 1 }), () => null));
            todos.get(ws.org.id)!.then((v) => !off && setS(v));
        };
        read(); listeners.add(read);
        return () => { off = true; listeners.delete(read); };
    }, [db, ws.org.id, ws.sample]);
    return s;
};
