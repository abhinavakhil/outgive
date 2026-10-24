// The demo's Postgres lives in a SharedWorker so every tab of the browser (live screen, phone give page, admin) talks to one
// database. Browsers without SharedWorker (Chrome on Android) get the same file as a dedicated worker, one database per tab.
// Seeding happens here too, next to the database, instead of as hundreds of round trips from the page.
import { PGlite } from "@electric-sql/pglite";
import { DATA_DIR, DEMO_USER, prepare } from "@/lib/demo";

interface Req { id: number; sql: string; params?: unknown[] }
const scope = self as unknown as { onconnect?: ((e: MessageEvent) => void) | null; onmessage?: ((e: MessageEvent) => void) | null; postMessage: (m: unknown) => void };

const db = (async () => {
    const pg = await PGlite.create({ dataDir: DATA_DIR });
    await prepare(pg);
    await pg.query("select set_config('request.jwt.claim.sub', $1, false)", [DEMO_USER.id]); // the visitor is the sample charity's owner
    return pg;
})();

const serve = async (port: { postMessage: (m: unknown) => void }, m: Req) => {
    try { port.postMessage({ id: m.id, rows: (await (await db).query(m.sql, m.params ?? [])).rows }); }
    catch (e) { port.postMessage({ id: m.id, error: (e as Error).message }); }
};
if ("onconnect" in scope) scope.onconnect = (e) => { const port = e.ports[0]; port.onmessage = (ev) => serve(port, ev.data as Req); port.start(); };
else scope.onmessage = (ev) => serve(scope, ev.data as Req);
