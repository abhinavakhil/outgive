import { expect, test } from "vitest";
import { heard } from "./heard";

test("pulls a draft out of what was said", () => {
    const h = heard("My daughter Priya is nine. She needs surgery on the 20th of November and we are about £2,500 short.");
    expect(h).toMatchObject({ title: "Help Priya", type: "fundraiser", goal: 2500, when: "20th of November", name: "Priya" });
    expect(heard("Running the London marathon in 2026 for 5k").goal).toBe(5000);
    expect(heard("Running the London marathon in 2026 for 5k").type).toBe("challenge");
    expect(heard("In memory of my dad Raj, who passed away in May").title).toBe("In memory of Raj");
    expect(heard("Our team Harbour Runners is doing a charity walk").title).toBe("Help Harbour Runners");
    expect(heard("")).toMatchObject({ title: "", type: undefined, goal: 0 });
});

test("says the goal in words", async () => {
    const { inWords } = await import("./heard");
    expect(inWords(250000, true)).toBe("two lakh fifty thousand");
    expect(inWords(12500)).toBe("twelve thousand five hundred");
    expect(inWords(0)).toBe("");
});
