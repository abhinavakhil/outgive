// The words of each recovery message. Pure, so `deno test` covers it. Links are /pledge/<token> on the site (the pay-link page).
import { fmt } from "../_shared/money.ts";
import type { Message } from "../_shared/notify/index.ts";

/** A row from pledge_reminders_claim(). */
export interface Due {
    id: string; action: string; channel: string; donor_name: string; donor_email: string | null; donor_phone: string | null; event: string;
    amount_cents: number; paid_cents: number; currency: string; due_date: string | null; pay_token: string; org_name: string;
}

export const payLink = (site: string, token: string, split = false) => `${site}/pledge/${token}${split ? "?split=3" : ""}`;

const when = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" }) : "");

/** The message for a claimed reminder, or null when there is nobody to send it to or nothing to say. */
export const message = (r: Due, site: string): Message | null => {
    const channel = r.channel === "sms" ? "sms" : r.channel === "email" ? "email" : null;
    const to = channel === "sms" ? r.donor_phone : r.donor_email;
    if (!channel || !to) return null;
    const left = Math.max(0, Number(r.amount_cents) - Number(r.paid_cents));
    if (left <= 0) return null;
    const first = r.donor_name.split(" ")[0], bal = fmt(left, r.currency), link = payLink(site, r.pay_token);
    const on = r.event ? ` at ${r.event}` : "", due = r.due_date ? ` by ${when(r.due_date)}` : "";
    const third = fmt(Math.ceil(left / 3), r.currency), split = payLink(site, r.pay_token, true);
    const stop = channel === "sms" ? " Reply STOP to opt out." : "";
    const text: Record<string, [string, string]> = {
        thank_you: [`Thank you for your pledge`, `Assalamu alaikum ${first}, thank you for your pledge of ${fmt(Number(r.amount_cents), r.currency)} to ${r.org_name}${on}. May Allah accept it. Pay in one tap: ${link}`],
        pay_link: [`Your pledge to ${r.org_name}: pay in one tap`, `Assalamu alaikum ${first},\n\nJazakAllah khair for your pledge to ${r.org_name}${on}. ${bal} is left to pay${due}, and you can pay it in one tap here:\n${link}`],
        reminder: [`A reminder about your pledge to ${r.org_name}`, `Assalamu alaikum ${first}, a gentle reminder that ${bal} of your pledge to ${r.org_name} is still open${due}. Pay in one tap: ${link}`],
        split_offer: [`Would three monthly payments help?`, `Assalamu alaikum ${first},\n\nIf it is easier, you can pay the ${bal} left on your pledge to ${r.org_name} in three monthly payments of about ${third}. Start with the first here:\n${split}\n\nOr pay it all at once: ${link}`],
    };
    const t = text[r.action]; if (!t) return null;
    return channel === "sms" ? { to, channel, body: t[1] + stop } : { to, channel, subject: t[0], body: t[1] };
};
