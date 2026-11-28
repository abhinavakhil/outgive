import { assertEquals } from "jsr:@std/assert@1";
import { addressOf, consoleProvider, fromLine, send, unsubscribeHeaders } from "./index.ts";

Deno.test("the From line names the charity truthfully, on Outgive's address", () => {
    assertEquals(fromLine("Hope Foundation", "Outgive <notify@outgive.org>"), '"Hope Foundation via Outgive" <notify@outgive.org>');
    assertEquals(fromLine('Evil" <x@y.z>\r\nBcc: a', "notify@outgive.org"), '"Evil x@y.zBcc: a via Outgive" <notify@outgive.org>');
    assertEquals(fromLine(undefined, "Outgive <notify@outgive.org>"), "Outgive <notify@outgive.org>");
    assertEquals(addressOf("a@b.co"), "a@b.co");
});

Deno.test("one-click unsubscribe headers (RFC 8058)", () => {
    assertEquals(unsubscribeHeaders("https://fn/u?u=t", ""), { "List-Unsubscribe": "<https://fn/u?u=t>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" });
    assertEquals(unsubscribeHeaders("https://fn/u?u=t", "unsub@outgive.org")["List-Unsubscribe"], "<mailto:unsub@outgive.org?subject=unsubscribe>, <https://fn/u?u=t>");
});

Deno.test("existing callers still send", async () => {
    assertEquals((await send({ to: "a@b.co", channel: "email", body: "hi" }, [consoleProvider])).ok, true);
});
