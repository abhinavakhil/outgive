import type { ImpactReportData as Report } from "@/features/engage";

/** SAMPLE: Aisha Khan from the journeys sample, for demo mode and local dev before the tables are pushed. */
export const SAMPLE_REPORT: Report = {
    org_name: "Hope Foundation", org_slug: "hope-foundation", logo_url: "", currency: "USD", season: "Ramadan 1448", starts: "2027-02-08", ends: "2027-03-10",
    first_name: "Aisha", funds: { Zakat: 120000, Sadaqah: 34000, "Zakat al-Fitr": 6000 }, gifts: 3, monthly: false, give_url: "",
    units: [
        { fund: "Zakat", unit_cents: 6000, label: "family food packs, a month each", label_one: "family food pack for a month", note: "Zakat gifts go only to zakat-eligible recipients, as set out in our zakat policy." },
        { fund: "Sadaqah", unit_cents: 400, label: "iftar meals", label_one: "iftar meal", note: "" },
        { fund: "Zakat al-Fitr", unit_cents: 1500, label: "people fed on Eid morning", label_one: "person fed on Eid morning", note: "" },
    ],
};
