/**
 * The Headless API screen's pure parts: the events, the code samples, and small formatters.
 * The API itself is supabase/functions/api (spec at /v1/openapi.json); webhooks are sent by supabase/functions/webhook-deliver.
 */
import { SUPABASE_URL } from "@/shared/lib/db";

export type KeyKind = "publishable" | "secret";
export type ApiKey = { id: string; kind: KeyKind; mode: "test" | "live"; name: string; hint: string; token: string | null; created_at: string; last_used_at: string | null; revoked_at: string | null };
export type Endpoint = { id: string; url: string; events: string[]; secret: string; description: string; source: "dashboard" | "zapier"; active: boolean; created_at: string };
export type DeliveryStatus = "pending" | "sending" | "succeeded" | "failed";
export type Delivery = { id: string; endpoint_id: string; url: string; type: string; event_id: string; status: DeliveryStatus; attempts: number; last_status: number | null; last_error: string | null; last_at: string | null; next_at: string; created_at: string };
export type Developers = { keys: ApiKey[]; endpoints: Endpoint[]; deliveries: Delivery[]; stripe: boolean; ads: { opt_in: boolean; ga4: boolean; meta: boolean } | null; imports: number };

/** Every event an endpoint can ask for. Same list as supabase/functions/api/logic.ts EVENTS. */
export const EVENTS: { id: string; note: string }[] = [
    { id: "donation.succeeded", note: "A gift is paid" },
    { id: "donation.failed", note: "A payment was declined" },
    { id: "donation.refunded", note: "A gift was refunded" },
    { id: "donation.disputed", note: "A donor's bank disputed a gift" },
    { id: "pledge.created", note: "A pledge was taken" },
    { id: "pledge.paid", note: "A pledge is paid in full" },
    { id: "receipt.sent", note: "A tax receipt was emailed" },
];

export const API_BASE = `${(SUPABASE_URL ?? "https://ecsrbsiaocnyqxdnsfkz.supabase.co").replace(/\/$/, "")}/functions/v1/api/v1`;
export const EMBED_SRC = "https://www.outgive.tech/embed/v1.js";

export const embedCode = (slug: string) => `<script src="${EMBED_SRC}"></script>
<div id="give"></div>
<script>
  Outgive.checkout({
    el: "#give",
    charity: "${slug}",
    funds: ["zakat", "sadaqah"],
    source: { utm: true },
    onPaid: function (gift) { /* gift.status, gift.total, gift.currency, gift.fund */ }
  });
</script>`;

export const restCode = (base = API_BASE) => `# Start a gift from your own app
curl ${base}/donations \\
  -H "Authorization: Bearer sk_test_..." \\
  -H "Idempotency-Key: order-1042" \\
  -H "Content-Type: application/json" \\
  -d '{ "amount_cents": 12000, "currency": "USD", "fund": "Zakat",
        "donor": { "name": "Aisha Khan", "email": "aisha@example.com" } }'

# -> { "object": "donation_intent", "id": "…", "status": "requires_action",
#      "client_secret": "pi_…_secret_…", "stripe_account": "acct_…" }
# Confirm it with Stripe.js, then listen for donation.succeeded.

# Read your gifts, 25 at a time (pass next_cursor as ?cursor=)
curl "${base}/donations?status=succeeded&limit=25" \\
  -H "Authorization: Bearer sk_test_..."`;

export const payloadCode = `POST https://your-site.org/hooks/outgive
Outgive-Signature: t=1741219200,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd
Outgive-Event: donation.succeeded

{
  "id": "0b6c2a8e-6f3e-4d55-9a51-2f1c7c4b9e10",
  "object": "event",
  "type": "donation.succeeded",
  "created_at": "2027-03-05T02:14:09Z",
  "data": {
    "id": "7f9d3c1a-…",
    "object": "donation",
    "status": "succeeded",
    "amount_cents": 126000,
    "currency": "USD",
    "fund": "Zakat",
    "donor": { "name": "Aisha Khan", "email": "aisha.khan@example.com" },
    "tags": { "channel": "api", "night": 27 }
  }
}

// Check it (Node): HMAC-SHA256 of "<t>.<raw body>" with your signing secret
const [t, v1] = header.split(",").map((p) => p.split("=")[1]);
const ok = crypto.createHmac("sha256", secret).update(t + "." + rawBody).digest("hex") === v1
  && Math.abs(Date.now() / 1000 - Number(t)) < 300;`;

/** "3 min ago", "2 h ago", "Mar 5". */
export const ago = (iso: string | null, now = Date.now()) => {
    if (!iso) return "Never";
    const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
    if (s < 60) return "Just now";
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/** What a delivery's tag says: the endpoint's HTTP status when there is one. */
export const deliveryLabel = (d: Pick<Delivery, "status" | "last_status" | "attempts">): [tone: "sage" | "peach" | "lilac" | "grey", label: string] =>
    d.status === "succeeded" ? ["sage", String(d.last_status ?? 200)]
    : d.status === "failed" ? ["peach", d.last_status ? `${d.last_status}, gave up` : "Gave up"]
    : d.attempts > 0 ? ["peach", `${d.last_status ?? "No answer"}, retrying`]
    : ["lilac", "Queued"];

/** Short form of a URL for a narrow table: host and path, no scheme. */
export const shortUrl = (u: string) => u.replace(/^https?:\/\//, "").replace(/\/$/, "");
export const validUrl = (u: string) => /^https:\/\/[^\s/]+\.[^\s/]+[^\s]*$/.test(u.trim()) && u.trim().length <= 500;
