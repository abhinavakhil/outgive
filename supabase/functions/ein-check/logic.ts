// The EIN check without the network or the database, so the function, the Engage screen and the tests share it. Import-free.
// Live source: ProPublica Nonprofit Explorer (projects.propublica.org/nonprofits/api/v2/organizations/<ein>.json), free and keyless,
// which serves the IRS Exempt Organizations Business Master File. The BMF drops revoked charities, and ein_revocations (the IRS
// auto-revocation list) catches the rest. Sandbox: the two sample records below, so the flow works with no network.

export type EinStatus = "verified" | "review" | "failed" | "revoked";
export interface EinRecord {
    found: boolean; name: string; city: string; state: string;
    /** 3 = 501(c)(3). */ subsection: number | null;
    /** 1 = contributions are deductible. */ deductibility: number | null;
    /** BMF exempt status: 1 = unconditional exemption. */ status_code?: number | null;
    revoked: boolean;
}
export interface EinResult { ein: string; status: EinStatus; record: EinRecord | null; steps: { label: string; ok: boolean }[]; message: string }

/** Prefixes the IRS has never issued; anything else with nine digits is a possible EIN. */
const NEVER_ISSUED = new Set(["00", "07", "08", "09", "17", "18", "19", "28", "29", "49", "69", "70", "78", "79", "89", "96", "97"]);
/** Nine digits ("12-3456789" or "123456789") from a real prefix, as stored (no dash), or null. */
export const parseEin = (s: string) => { const t = (s ?? "").trim(); return /^\d{2}-?\d{7}$/.test(t) && !NEVER_ISSUED.has(t.slice(0, 2)) ? t.replace("-", "") : null; };

export const SANDBOX: Record<string, EinRecord> = {
    "123456789": { found: true, name: "Hope Foundation Inc.", city: "Plainfield", state: "NJ", subsection: 3, deductibility: 1, status_code: 1, revoked: false },
    "987654321": { found: true, name: "Crescent Relief Inc.", city: "Dearborn", state: "MI", subsection: 3, deductibility: 1, status_code: 1, revoked: true },
};

/** ProPublica's organization JSON (or a 404: null) as a record. */
export const fromProPublica = (j: { organization?: Record<string, unknown> } | null): EinRecord => {
    const o = j?.organization;
    if (!o) return { found: false, name: "", city: "", state: "", subsection: null, deductibility: null, status_code: null, revoked: false };
    const n = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
    return { found: true, name: String(o.name ?? ""), city: String(o.city ?? ""), state: String(o.state ?? ""), subsection: n(o.subsection_code), deductibility: n(o.deductibility_code), status_code: n(o.exempt_organization_status_code), revoked: false };
};

const STOP = /\b(inc|incorporated|corp|corporation|co|llc|ltd|the|of|and|a|an)\b/g;
const norm = (s: string) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, " ").replace(STOP, " ").replace(/\s+/g, " ").trim();
/** Same charity name, ignoring case, punctuation and "Inc."; IRS names are often shortened, so one containing the other counts. */
export const nameMatches = (a: string, b: string) => { const x = norm(a), y = norm(b); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)); };

/**
 * The verdict. verified: found, 501(c)(3), deductible, not revoked, and the legal name matches (when the charity gave one).
 * review: everything but the name matched, so a person looks. Payments open only on verified.
 */
export const verdict = (ein: string, rec: EinRecord | null, legalName = ""): EinResult => {
    const steps = [{ label: "Format: nine digits", ok: true }];
    if (!rec?.found) return { ein, status: "failed", record: rec, steps: [...steps, { label: "Found in IRS exempt organization records", ok: false }], message: "No exempt organization has this EIN. Check the number on your IRS determination letter." };
    const c3 = rec.subsection === 3, deduct = rec.deductibility === null || rec.deductibility === 1, name = !legalName || nameMatches(legalName, rec.name);
    steps.push({ label: "Found in IRS exempt organization records", ok: true }, { label: "501(c)(3) status current", ok: c3 && deduct && !rec.revoked }, { label: "Not on the auto-revocation list", ok: !rec.revoked });
    if (legalName) steps.push({ label: "Legal name matches", ok: name });
    if (rec.revoked) return { ein, status: "revoked", record: rec, steps, message: `${rec.name}'s tax exemption has been revoked. Payments stay off until the IRS reinstates it.` };
    if (!c3 || !deduct) return { ein, status: "failed", record: rec, steps, message: `${rec.name} is exempt, but not as a 501(c)(3) charity whose gifts are deductible.` };
    if (!name) return { ein, status: "review", record: rec, steps, message: `The IRS lists this EIN as "${rec.name}". Outgive will check it matches "${legalName}" and switch payments on.` };
    return { ein, status: "verified", record: rec, steps, message: `${rec.name}, ${[rec.city, rec.state].filter(Boolean).join(", ")}: a 501(c)(3) public charity. Payments can go live.` };
};

/** A cached answer older than this is looked up again. */
export const CACHE_DAYS = 30;
