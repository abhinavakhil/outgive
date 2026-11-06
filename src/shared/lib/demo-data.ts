import type { Activity, PageData, Supporter } from "@/shared/domain/model";

/** Company match pledges on the demo board. */
const MATCH: Record<string, number> = { "Bluefin Logistics": 5000, "Greenway Architects": 2000, "Marlow & Finch": 3000 };

/** Fictional supporters of the demo charity. Demo data only. */
const SEED: [string, string, string, string, string][] = [
    ["Amara Okafor", "Running the Nairobi marathon for the Kitui boreholes", "Individuals", "Africa", "Kenya"],
    ["Northfield Rotary", "Our club's annual water appeal", "Teams", "Europe", "United Kingdom"],
    ["Bluefin Logistics", "Matching every staff gift pound for pound", "Companies", "North America", "United States"],
    ["St Hilda's Primary", "Year 6 walked 40 km, one for each village", "Schools", "Europe", "United Kingdom"],
    ["Jonas Weber", "Shaving my head when we hit the first pump", "Individuals", "Europe", "Germany"],
    ["The Tuesday Swimmers", "A cold-water swim every week until March", "Teams", "Oceania", "New Zealand"],
    ["Priya Sharma", "In memory of my grandmother, who carried water daily", "Individuals", "Asia", "India"],
    ["Harbour Dental", "Our practice's charity of the year", "Companies", "Oceania", "Australia"],
    ["Lakeside High", "The sixth-form bake sale that got out of hand", "Schools", "North America", "Canada"],
    ["Tomás Rivera", "Cycling Lisbon to Porto in July", "Individuals", "Europe", "Portugal"],
    ["Team Clearwell Dubai", "Expat five-a-side league, winnings donated", "Teams", "Middle East", "United Arab Emirates"],
    ["Leila Haddad", "Birthday fundraiser, no presents please", "Individuals", "Middle East", "Jordan"],
    ["Greenway Architects", "One percent of every project fee", "Companies", "Europe", "Netherlands"],
    ["Riverbank Academy", "Our whole-school fast for water", "Schools", "Asia", "Singapore"],
    ["Mateo & Sofia", "Wedding gifts went here instead", "Individuals", "Latin America", "Colombia"],
    ["The Night Shift", "ICU nurses, fundraising between shifts", "Teams", "Europe", "Ireland"],
    ["Kofi Mensah", "Three peaks in three days", "Individuals", "Africa", "Ghana"],
    ["Pinewood Coffee Co.", "Ten cents from every cup in April", "Companies", "North America", "United States"],
    ["Hana Suzuki", "Running my first 10k at 62", "Individuals", "Asia", "Japan"],
    ["Oakridge College", "Student union charity week", "Schools", "Europe", "United Kingdom"],
    ["Fatima Al-Sayed", "Ramadan giving", "Individuals", "Middle East", "Egypt"],
    ["Ridge Runners", "Trail-running club, one dollar per kilometre", "Teams", "North America", "United States"],
    ["Daniel Osei", "Sponsored silence, 48 hours", "Individuals", "Africa", "Nigeria"],
    ["Marlow & Finch", "Our firm's year-end giving", "Companies", "Europe", "United Kingdom"],
    ["Elena Petrova", "Selling my paintings for pumps", "Individuals", "Europe", "Bulgaria"],
    ["Sunrise Montessori", "Pennies for pumps jar, finally counted", "Schools", "Asia", "India"],
    ["Yusuf Rahman", "Fasting for water, with friends", "Individuals", "Asia", "Bangladesh"],
    ["The Allotment Crew", "Veg box sales all summer", "Teams", "Europe", "United Kingdom"],
    ["Grace Mwangi", "Walking to work for a month", "Individuals", "Africa", "Kenya"],
    ["Cedar Point Gym", "Spin-a-thon, 24 hours straight", "Companies", "North America", "Canada"],
    ["Ben Carter", "Quit coffee, gave the money away", "Individuals", "Oceania", "Australia"],
    ["Willow Lane School", "Reception class sponsored toddle", "Schools", "Europe", "United Kingdom"],
];
export const SUPPORTERS: Supporter[] = SEED.map((r, i) => {
    const total = Math.round(18500 * Math.pow(0.89, i) + 400 - i * 4);
    return { id: String(i + 1), name: r[0], tagline: r[1], kind: r[2], region: r[3], country: r[4], page: "/f/" + r[0].toLowerCase().replace(/[^a-z]+/g, "-"),
        total, today: Math.round(total * (((i * 37) % 11) / 60 + 0.01)), visits: Math.round(total * (2.2 + ((i * 13) % 7) / 3)), days: 3 + ((i * 17) % 44),
        week: Math.min(total, Math.round(total * (((i * 37) % 11) / 60 + 0.01) * (1.6 + ((i * 3) % 5) / 2)) + 40), recruited: ((i * 7) % 23) + (r[2] === "Individuals" ? 0 : 9), streak: (i * 5) % 14, match: MATCH[r[0]] };
});
const MIN = 60000;
export const ACTIVITY: Activity[] = [{ who: "Amara Okafor", usd: 18900, at: Date.now() - 49 * MIN }, { who: "Hana Suzuki", usd: 2810, at: Date.now() - 130 * MIN }, { who: "Priya Sharma", usd: 6120, at: Date.now() - 310 * MIN }, { who: "Ben Carter", usd: 1050, at: Date.now() - 560 * MIN }];

const DAY = 86400000;
export const SAMPLE_PAGE: PageData = {
    type: "campaign", slug: "clean-water-for-40-villages", title: "Clean water for 40 villages", org: "Clearwell Trust", country: "Kenya", goal: 30000, raised: 18420, supporters: 412, layout: "classic", isSample: true,
    cover: { kind: "none", src: "" }, causes: ["Clean Water", "Children"], gifts: [10, 25, 50, 100], showGoal: true, created: Date.now() - 41 * DAY, endDate: "",
    details: { Charity: "Clearwell Trust", "Registration number": "CT-20418 (sample)", "Country of registration": "Kenya", "Supporter fundraisers": "Allowed" },
    story: "<p>Forty villages in the district share six working pumps. Children walk up to two hours for water before school. Each borehole serves about 300 people and lasts 20 years with basic upkeep.</p><p>Every gift goes to drilling, pump parts and training two local caretakers per village.</p>",
    donations: [{ name: "Anonymous", usd: 50, message: "Keep going.", at: Date.now() - 2 * 3600000 }, { name: "Amara O.", usd: 2140, message: "For the Nakuru school.", at: Date.now() - 3 * DAY }, { name: "Jonas W.", usd: 1875, message: "", at: Date.now() - 6 * DAY }, { name: "Priya S.", usd: 1420, message: "Thank you for the work you do.", at: Date.now() - 9 * DAY }],
    allocation: [["Boreholes and pumps", 78], ["Training caretakers", 14], ["Running costs", 8]],
    updates: [{ title: "Drilling starts in Kitui", body: "The rig arrived on Monday and the first three boreholes are scheduled for this month.", at: Date.now() - 5 * DAY }, { title: "We passed 400 supporters", body: "Thank you. Your gifts have already covered 14 hand-pump service kits.", at: Date.now() - 18 * DAY }],
};
export const PEOPLE: [string, number][] = [["Amara O.", 2140], ["Jonas W.", 1875], ["Priya S.", 1420], ["Tomás R.", 960], ["Leila H.", 715]];
export const LEVELS: [number, string, string][] = [[25, "Hand-pump spares", "Keeps one pump running for a year"], [120, "Caretaker training", "Two people trained per village"], [600, "Share of a borehole", "One tenth of a new well"]];
