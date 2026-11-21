/**
 * Dev only: fills the campaign service with one campaign and the teams and fundraisers raising for it, so the
 * leaderboard can be seen. Run by opening any page with ?seed=leaderboard on the dev server (see app/main.tsx).
 */
import { campaigns } from "@/shared/lib/campaign-store";

const TEAMS = ["Tide Turners", "Night Owls", "Harbour Runners", "Hilltop Hikers", "Office Stairs Club", "Sunday Striders", "Class of 2011", "Riverside Rowers", "The Early Birds", "Pedal Pushers"];
const PEOPLE = ["Amara Okafor", "Jonas Weber", "Priya Sharma", "Tomás Ruiz", "Leila Haddad", "Kofi Mensah", "Aiko Tanaka", "Sam Lee", "Grace Kim", "Mateo Silva"];
const DONORS = ["Ana", "Ben", "Chloe", "Dev", "Ella", "Finn", "Gita", "Hugo", "Isla", "Jay", "Kai", "Lena"];
const NOTES = ["Go team!", "Proud of you", "For clean water", "", "Keep going!", "", "Every drop counts"];

export const seedLeaderboard = async () => {
    const key = "c/clean-water-appeal";
    if (!(await campaigns.get("campaign", "clean-water-appeal"))) {
        await campaigns.create({ type: "campaign", slug: "clean-water-appeal", title: "Clean water for 40 villages", charity: "Clearwell Trust", organiser: "Clearwell Trust", goal: 50000, lead: "Forty villages in the Rift Valley walk hours every day for water that isn't safe to drink.", body: "Every borehole we drill brings clean water to about 500 people, for decades.\n\nRaise as a team or on your own: every page below counts toward the same goal.", gifts: [25, 50, 100, 250], details: {}, photos: [] });
    }
    if ((await campaigns.children(key)).length >= 20) return;
    let n = 0;
    const add = async (type: "team" | "fundraiser", title: string, i: number) => {
        const c = await campaigns.create({ type, slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"), title: type === "team" ? title : `${title.split(" ")[0]} raises for clean water`, charity: "Clearwell Trust", organiser: type === "team" ? `${PEOPLE[i]}` : title, goal: type === "team" ? 5000 : 1000, lead: "", body: "", gifts: [10, 25, 50], details: type === "team" ? { "Team name": title } : {}, photos: [], parentId: key });
        // Fewer, smaller gifts further down the list so the ranking is clear.
        for (let g = 0; g < 3; g++) {
            const usd = Math.round(((type === "team" ? 1600 : 420) / (i + 1)) * (1 - g * 0.25)) + 5;
            await campaigns.donate(c.id, { name: DONORS[(n++) % DONORS.length], usd, message: NOTES[n % NOTES.length], at: Date.now() - (i * 3 + g) * 3_600_000 });
        }
    };
    for (let i = 0; i < 10; i++) { await add("team", TEAMS[i], i); await add("fundraiser", PEOPLE[i], i); }
};
