import { expect, it } from "vitest";
import { fresh } from "./pg";
import { seed } from "@/lib/demo";
import { SUPPORTERS } from "@/data";

it("the demo seed puts every sample supporter on the board with the right totals", async () => {
    const db = await fresh();
    await seed(db as never);
    const org = (await db.query<{ id: string }>("select id from orgs where slug = 'clearwell'")).rows[0];
    const board = (await db.query<{ name: string; total: string; today: string; week: string; streak: number; recruited: number }>("select * from board($1)", [org.id])).rows;
    expect(board.length).toBe(SUPPORTERS.length);
    for (const o of SUPPORTERS) {
        const r = board.find((b) => b.name === o.name)!;
        expect(r, o.name).toBeTruthy();
        expect(Number(r.total), `${o.name} total`).toBe(o.total);
        expect(Number(r.today), `${o.name} today`).toBe(Math.min(o.today, o.total));
    }
    const hall = (await db.query("select * from hall_of_fame($1)", [org.id])).rows;
    expect(hall.length).toBeGreaterThanOrEqual(3);
    const camp = (await db.query<{ raised_cents: number; donor_count: number }>("select raised_cents, donor_count from pages where type = 'campaign'")).rows[0];
    expect(camp.raised_cents).toBeGreaterThan(0);
}, 120000);
