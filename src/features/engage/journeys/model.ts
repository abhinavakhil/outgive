/** The donor journey after Eid. One source of truth, shared with the journey-run edge function. */
export { VARS, addDays, compose, dueSends, enrollments, firstName, inAudience, nextStep, render, segment, unknownVars, varsFor } from "../../../../supabase/functions/journey-run/model";
export type { Audience, Channel, DonorVars, Gift, Kind, Links, Rendered, Segment, Settings, Step, Trigger, Var } from "../../../../supabase/functions/journey-run/model";
import type { DonorVars, Segment, Settings, Step, Trigger } from "../../../../supabase/functions/journey-run/model";

/** journey_get(org). */
export interface Journey {
    settings: Settings & { updated_at: string };
    /** The charity's postal address; going live needs it. */
    address: string;
    steps: (Step & { id: string })[];
    audience: { all: number; first_time: number; returning: number; lapsed: number };
    enrolled: number; exited_monthly: number; unsubscribed: number;
}
/** journey_donors_list(org). email and phone are null below editor. */
export interface JourneyDonor {
    key: string; donor_name: string; email: string | null; phone: string | null; segment: Segment; season_cents: number; total_cents: number;
    first_gift: string; monthly: boolean; suppressed: boolean; sends: number; conversions: number;
    enrollments: { id: string; trigger: Trigger; anchor: string; status: "active" | "exited"; exit_reason: "monthly" | "unsubscribed" | "staff" | null }[];
}
/** journey_sends_list(org). */
export interface JourneySend {
    id: string; donor_name: string; email: string | null; kind: string; channel: "email" | "sms"; scheduled_at: string;
    status: "pending" | "sending" | "sent" | "failed" | "skipped"; provider: string | null; error: string | null; sent_at: string | null; clicked_at: string | null; clicks: number;
}
/** journey_preview(org, key): the donor's numbers plus the charity's name and address. */
export type Preview = DonorVars & { report_token: string; org: string; address: string };
