import { expect, test } from "vitest";
import { amountsFor } from "./PledgePay";
import { demoSource, tonight } from "./source";

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

test("the fixture covers every pay-link state", async () => {
    const s = demoSource(mem());
    expect((await s.byToken("demo-open"))?.status).toBe("open");
    expect((await s.byToken("demo-part"))?.remaining_cents).toBe(200000);
    expect((await s.byToken("demo-paid"))?.status).toBe("paid");
    expect((await s.byToken("demo-off"))?.status).toBe("written_off");
    expect(await s.byToken("nope")).toBeNull();
});

test("a pledge logged at a table, then paid offline and online, adds up", async () => {
    const store = mem(), s = demoSource(store);
    const p = await s.save("org", { donor_name: "Zaid Hassan", amount_cents: 90000, event: "Night 27 dinner" });
    await s.pay(p.id, { amount_cents: 30000, method: "cash" });
    await s.payOnline(p.pay_token, 30000);
    await expect(s.pay(p.id, { amount_cents: 40000, method: "check" })).rejects.toThrow(/more than/);
    const again = demoSource(store); // persisted
    expect((await again.byToken(p.pay_token))).toMatchObject({ status: "part_paid", paid_cents: 60000, remaining_cents: 30000, first_name: "Zaid" });
    const n = tonight(await again.list("org"), "Night 27 dinner");
    // Seeded open 1500 + part 3000 (1000 by check) + paid 500 online, the written-off one left out, plus Zaid's 900.
    expect(n).toEqual({ count: 4, pledged_cents: 590000, paid_cents: 210000, remaining_cents: 380000, offline_cents: 130000 });
});

test("the split offer is a third rounded up to whole dollars, from $3 left", () => {
    expect(amountsFor(100000)).toEqual({ all: 100000, third: 33400 });
    expect(amountsFor(200000)).toEqual({ all: 200000, third: 66700 });
    expect(amountsFor(250)).toEqual({ all: 250, third: 0 });
});
