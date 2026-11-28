/**
 * Gifts from other tools as CSV (LaunchGood, Donorbox, or Outgive's own export), parsed in the browser into the rows revenue_import
 * takes. Flow: parseImport(text) shows what will happen (rows, errors, unmapped columns), revenue_import(..., dry = true) counts
 * duplicates against the database, then dry = false keeps them as one batch (undo with revenue_import_undo).
 * Headers are matched loosely (case, spaces and punctuation ignored), so small changes in a tool's export do not break the import.
 */
export type Tool = "launchgood" | "donorbox" | "csv";
export type ImportRow = {
    external_id?: string; created_at: string; amount_cents: number; currency: string;
    fund?: string; campaign?: string; donor_name?: string; donor_email?: string; anonymous?: boolean; recurring?: boolean;
    cover_cents?: number; processing_fee_cents?: number; state?: string; zip?: string; utm_source?: string; utm_medium?: string; utm_campaign?: string;
};
type Field = keyof ImportRow | "first_name" | "last_name";

/** RFC 4180: quoted fields, doubled quotes, newlines inside quotes. */
export const parseCsv = (text: string): string[][] => {
    const rows: string[][] = []; let row: string[] = [], f = "", q = false;
    const s = text.replace(/^﻿/, "");
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (q) { if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
        if (c === '"') q = true;
        else if (c === ",") { row.push(f); f = ""; }
        else if (c === "\n" || c === "\r") { if (c === "\r" && s[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
        else f += c;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    return rows.filter((r) => r.some((x) => x.trim()));
};

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");
/** Each field and the headers it may appear under, most specific first. */
const COMMON: Partial<Record<Field, string[]>> = {
    currency: ["currency", "donationcurrency"],
    donor_email: ["email", "donoremail", "emailaddress", "supporteremail"],
    first_name: ["firstname", "donorfirstname"], last_name: ["lastname", "donorlastname"],
    state: ["state", "stateprovince", "region", "province"], zip: ["zip", "zipcode", "postalcode", "postcode"],
    utm_source: ["utmsource"], utm_medium: ["utmmedium"], utm_campaign: ["utmcampaign"],
};
export const MAPS: Record<Tool, Partial<Record<Field, string[]>>> = {
    launchgood: {
        ...COMMON,
        external_id: ["donationid", "transactionid", "id", "contributionid"], created_at: ["date", "donationdate", "createdat", "datetime", "created"],
        amount_cents: ["amount", "donationamount", "amountusd", "total"], fund: ["designation", "fund", "category"], campaign: ["campaign", "campaignname", "campaigntitle", "project"],
        donor_name: ["name", "donorname", "fullname", "supportername"], anonymous: ["anonymous", "isanonymous", "hidename"], recurring: ["recurring", "isrecurring", "type", "frequency"],
        processing_fee_cents: ["processingfee", "fee", "fees"], cover_cents: ["coveredfee", "feecovered", "tip"],
    },
    donorbox: {
        ...COMMON,
        external_id: ["stripechargeid", "paypaltransactionid", "donationid", "id"], created_at: ["donatedat", "donationdate", "date"],
        amount_cents: ["amount", "donationamount"], fund: ["designation", "fund"], campaign: ["campaign", "campaignname"],
        donor_name: ["name", "donorname"], anonymous: ["makedonationanonymous", "anonymousdonation", "anonymous"], recurring: ["recurringdonation", "donationtype", "recurring"],
        processing_fee_cents: ["processingfee", "totalfee"], cover_cents: ["feecovered", "processingfeecovered"],
    },
    // Outgive's own export (revenue_export + toCsv), so a charity can move gifts between orgs.
    csv: {
        ...COMMON, external_id: ["id", "externalid"], created_at: ["createdat", "date"], amount_cents: ["amountcents", "amount"], fund: ["fund"], campaign: ["campaign"],
        donor_name: ["donorname", "name"], anonymous: ["anonymous"], recurring: ["rhythm", "recurring"], cover_cents: ["covercents"], processing_fee_cents: ["processingfeecents"],
    },
};

/** The tool a header row most likely came from. */
export const detectTool = (headers: string[]): Tool => {
    const h = new Set(headers.map(norm));
    if (h.has("donatedat") || h.has("makedonationanonymous") || h.has("stripechargeid") || h.has("donorfirstname")) return "donorbox";
    if (h.has("amountcents") || h.has("covercents")) return "csv";
    return "launchgood";
};

const money = (s: string, cents: boolean) => {
    const t = s.replace(/[^0-9.\-]/g, "");
    if (!t || isNaN(+t)) return null;
    return Math.round(cents ? +t : +t * 100);
};
const yes = (s: string) => /^(y|yes|true|1|anonymous|recurring|monthly|weekly|yearly|annual)$/i.test(s.trim());
/** ISO for "2027-03-05 21:14:00 UTC", "2027-03-05T21:14Z", "03/05/2027 9:14 PM" (US month first), "Mar 5, 2027". Null if unreadable. */
export const parseDate = (s: string): string | null => {
    const t = s.trim(); if (!t) return null;
    const us = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]m)?)?$/i);
    if (us) {
        const [, mo, d, y, h = "12", mi = "0", sec = "0", ap] = us;
        let hr = +h % (ap ? 12 : 24); if (ap?.toLowerCase() === "pm") hr += 12;
        const yr = y.length === 2 ? 2000 + +y : +y;
        const dt = new Date(Date.UTC(yr, +mo - 1, +d, hr, +mi, +sec));
        return dt.getUTCMonth() === +mo - 1 ? dt.toISOString() : null;
    }
    const v = Date.parse(t.replace(/ UTC$/, "Z").replace(/^(\d{4}-\d{2}-\d{2}) (\d)/, "$1T$2"));
    return isNaN(v) ? null : new Date(v).toISOString();
};

export type Parsed = { tool: Tool; rows: ImportRow[]; errors: { line: number; why: string }[]; mapped: Partial<Record<Field, string>>; unmapped: string[] };

/** Text to import rows. `tool` defaults to detectTool on the header row. */
export const parseImport = (text: string, tool?: Tool, defaultCurrency = "USD"): Parsed => {
    const [head = [], ...body] = parseCsv(text);
    const t = tool ?? detectTool(head), map = MAPS[t], keys = head.map(norm);
    const col: Partial<Record<Field, number>> = {}, mapped: Parsed["mapped"] = {};
    for (const [field, names] of Object.entries(map) as [Field, string[]][]) {
        const i = names.map((n) => keys.indexOf(n)).find((x) => x >= 0);
        if (i !== undefined) { col[field] = i; mapped[field] = head[i]; }
    }
    const used = new Set(Object.values(col));
    const unmapped = head.filter((_, i) => !used.has(i));
    const errors: Parsed["errors"] = [];
    if (col.amount_cents === undefined) errors.push({ line: 1, why: "No amount column" });
    if (col.created_at === undefined) errors.push({ line: 1, why: "No date column" });
    if (errors.length) return { tool: t, rows: [], errors, mapped, unmapped };
    const inCents = t === "csv" && keys[col.amount_cents!] === "amountcents";
    const rows: ImportRow[] = [];
    body.forEach((r, i) => {
        const get = (f: Field) => (col[f] === undefined ? "" : (r[col[f]!] ?? "").trim());
        const amount = money(get("amount_cents"), inCents), at = parseDate(get("created_at"));
        if (!amount || amount <= 0) return void errors.push({ line: i + 2, why: `Amount "${get("amount_cents")}" is not a positive number` });
        if (!at) return void errors.push({ line: i + 2, why: `Date "${get("created_at")}" is not readable` });
        const name = get("donor_name") || [get("first_name"), get("last_name")].filter(Boolean).join(" ");
        const fee = (f: Field) => { const v = get(f); return v ? money(v, t === "csv") ?? undefined : undefined; };
        const row: ImportRow = {
            external_id: get("external_id") || undefined, created_at: at, amount_cents: amount, currency: (get("currency") || defaultCurrency).toUpperCase().slice(0, 3),
            fund: get("fund") || undefined, campaign: get("campaign") || undefined, donor_name: name || undefined, donor_email: get("donor_email").toLowerCase() || undefined,
            anonymous: yes(get("anonymous")), recurring: yes(get("recurring")),
            cover_cents: fee("cover_cents"), processing_fee_cents: fee("processing_fee_cents") !== undefined ? Math.abs(fee("processing_fee_cents")!) : undefined,
            state: get("state") || undefined, zip: get("zip") || undefined,
            utm_source: get("utm_source") || undefined, utm_medium: get("utm_medium") || undefined, utm_campaign: get("utm_campaign") || undefined,
        };
        for (const k of Object.keys(row) as (keyof ImportRow)[]) if (row[k] === undefined) delete row[k];
        rows.push(row);
    });
    return { tool: t, rows, errors, mapped, unmapped };
};
