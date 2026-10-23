// Input checks for the checkout function; no Stripe or database, so they run under `deno test`.
import { TIP_CHOICES } from "../_shared/money.ts";

export interface CheckoutInput {
    org_id?: string; page_id?: string; amount_cents: number; currency: string; recurring?: boolean; tip_pct?: number; cover?: boolean;
    donor_name?: string; donor_email?: string; anonymous?: boolean; message?: string; dedication?: string;
    supporter_name?: string; supporter_kind?: string; supporter_tagline?: string; supporter_country?: string; supporter_region?: string; claimed_rank?: number;
    ticket_type_id?: string; ticket_qty?: number; return_to?: string; origin?: string;
}

/** Validation that does not need Stripe or the database, so it can be unit-tested. */
export const validate = (b: CheckoutInput) => {
    if (!b.org_id && !b.page_id) return "org_id or page_id is required";
    if (!Number.isInteger(b.amount_cents) || b.amount_cents < 100) return "The minimum gift is 1.00";
    if (b.amount_cents > 99_999_900) return "That amount is above the card limit";
    if (!/^[A-Za-z]{3}$/.test(b.currency ?? "")) return "currency must be a 3-letter code";
    if (b.tip_pct !== undefined && !(TIP_CHOICES as readonly number[]).includes(b.tip_pct)) return "tip_pct must be 0, 5, 10 or 15";
    if (b.donor_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.donor_email)) return "That email address does not look right";
    if (b.recurring && b.ticket_type_id) return "Tickets cannot be monthly";
    if ((b.message ?? "").length > 500 || (b.dedication ?? "").length > 200 || (b.donor_name ?? "").length > 80 || (b.supporter_name ?? "").length > 80) return "Text is too long";
    return null;
};

