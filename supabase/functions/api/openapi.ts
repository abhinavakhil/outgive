// The API's OpenAPI 3.1 description, served at GET /v1/openapi.json (no key needed). Keep it in step with index.ts.
import { EVENTS } from "./logic.ts";

const ref = (n: string) => ({ $ref: `#/components/schemas/${n}` });
const err = { description: "Error", content: { "application/json": { schema: ref("Error") } } };
const list = (item: string) => ({
    description: "A page, newest first", content: { "application/json": { schema: { type: "object", required: ["object", "data", "has_more", "next_cursor"], properties: { object: { const: "list" }, data: { type: "array", items: ref(item) }, has_more: { type: "boolean" }, next_cursor: { type: ["string", "null"] } } } } },
});
const paging = [
    { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 25 } },
    { name: "cursor", in: "query", description: "next_cursor from the previous page", schema: { type: "string" } },
];
const getOne = (tag: string, item: string) => ({
    get: { tags: [tag], summary: `Get one ${item.toLowerCase()}`, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { 200: { description: item, content: { "application/json": { schema: ref(item) } } }, 404: err } },
});
const money = { type: "integer", description: "Smallest currency unit (cents)" };
const person = { type: "object", properties: { name: { type: "string" }, email: { type: ["string", "null"] } } };

export const spec = (server: string) => ({
    openapi: "3.1.0",
    info: {
        title: "Outgive API", version: "1.0.0",
        description: "Headless donation infrastructure: read a charity's gifts, pledges, receipts and donors, and take a gift from your own app. "
            + "Authenticate with a secret key (sk_test_… or sk_live_…) as a Bearer token. Publishable keys (pk_…) may only call /me and /checkout_sessions. "
            + "100 requests a minute per key. Webhooks are signed: Outgive-Signature: t=<unix>,v1=<hex HMAC-SHA256(secret, \"<t>.<raw body>\")>.",
    },
    servers: [{ url: server }],
    security: [{ key: [] }],
    paths: {
        "/me": { get: { tags: ["Account"], summary: "The charity this key belongs to", responses: { 200: { description: "The charity", content: { "application/json": { schema: { type: "object", properties: { object: { const: "account" }, id: { type: "string" }, name: { type: "string" }, slug: { type: "string" }, mode: { enum: ["test", "live"] } } } } } }, 401: err } } },
        "/donations": {
            get: { tags: ["Donations"], summary: "List donations", parameters: [...paging, { name: "status", in: "query", schema: { enum: ["pending", "succeeded", "refunded", "disputed", "failed"] } }, { name: "since", in: "query", schema: { type: "string", format: "date-time" } }], responses: { 200: list("Donation"), 400: err, 401: err, 429: err } },
            post: {
                tags: ["Donations"], summary: "Start a gift from your own app",
                description: "Creates a pending donation and its payment. Confirm it in the browser with Stripe.js and client_secret (pass stripe_account when it is set), or send the donor to redirect_url (PayPal). The donation becomes succeeded from the payment provider, and donation.succeeded is sent then.",
                parameters: [{ name: "Idempotency-Key", in: "header", required: true, description: "Any unique string per gift attempt. Retrying with the same key never charges twice; the same key with different details is a 409.", schema: { type: "string", maxLength: 255 } }],
                requestBody: { required: true, content: { "application/json": { schema: ref("DonationCreate") } } },
                responses: { 200: { description: "The payment to confirm", content: { "application/json": { schema: ref("DonationIntent") } } }, 400: err, 401: err, 409: err, 429: err },
            },
        },
        "/donations/{id}": getOne("Donations", "Donation"),
        "/checkout_sessions": {
            post: {
                tags: ["Donations"], summary: "A link to the hosted checkout", description: "The same checkout the embed shows (https://www.outgive.tech/embed/v1.js), as a page to send a donor to. Works with a publishable key.",
                requestBody: { content: { "application/json": { schema: { type: "object", properties: { amount_cents: money, fund: { type: "string" }, layout: { type: "string" } } } } } },
                responses: { 200: { description: "The link", content: { "application/json": { schema: { type: "object", properties: { object: { const: "checkout_session" }, url: { type: "string", format: "uri" } } } } } }, 401: err },
            },
        },
        "/pledges": { get: { tags: ["Pledges"], summary: "List pledges", parameters: paging, responses: { 200: list("Pledge"), 401: err } } },
        "/pledges/{id}": getOne("Pledges", "Pledge"),
        "/receipts": { get: { tags: ["Receipts"], summary: "List tax receipts and year-end statements", parameters: paging, responses: { 200: list("Receipt"), 401: err } } },
        "/receipts/{id}": getOne("Receipts", "Receipt"),
        "/donors": { get: { tags: ["Donors"], summary: "Donors (by email and currency), latest gift first", parameters: paging, responses: { 200: list("Donor"), 401: err } } },
        "/hooks": {
            post: {
                tags: ["Webhooks"], summary: "Subscribe a URL to one event (Zapier REST Hooks)", description: "Responding 410 Gone to a delivery unsubscribes the URL.",
                requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["target_url", "event"], properties: { target_url: { type: "string", format: "uri" }, event: { enum: [...EVENTS, "*"] } } } } } },
                responses: { 201: { description: "Subscribed", content: { "application/json": { schema: { type: "object", properties: { id: { type: "string" }, secret: { type: "string" } } } } } }, 400: err, 401: err },
            },
        },
        "/hooks/{id}": { delete: { tags: ["Webhooks"], summary: "Unsubscribe", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { 200: { description: "Unsubscribed" }, 404: err } } },
        "/hooks/sample": { get: { tags: ["Webhooks"], summary: "Recent objects for an event, as its payload would carry them (Zapier perform list)", parameters: [{ name: "event", in: "query", required: true, schema: { enum: EVENTS } }], responses: { 200: { description: "Up to three objects", content: { "application/json": { schema: { type: "array", items: { type: "object" } } } } } } } },
    },
    webhooks: Object.fromEntries(EVENTS.map((e) => [e, { post: { summary: e, requestBody: { content: { "application/json": { schema: ref("Event") } } }, responses: { 200: { description: "Any 2xx acknowledges it. Anything else is retried: 1 min, 5 min, 30 min, 2 h, 6 h, 12 h, 24 h." } } } }])),
    components: {
        securitySchemes: { key: { type: "http", scheme: "bearer", description: "sk_test_… / sk_live_… (or pk_… where noted)" } },
        schemas: {
            Error: { type: "object", properties: { error: { type: "object", properties: { type: { enum: ["invalid_request", "authentication", "permission", "not_found", "conflict", "rate_limited", "api_error"] }, message: { type: "string" } } } } },
            Donation: { type: "object", properties: { id: { type: "string" }, object: { const: "donation" }, status: { enum: ["pending", "succeeded", "refunded", "disputed", "failed"] }, amount_cents: money, currency: { type: "string" }, cover_cents: money, tip_cents: money, fund: { type: "string" }, recurring: { type: "boolean" }, method: { type: ["string", "null"] }, source: { type: "string" }, donor: { ...person, properties: { ...person.properties, anonymous: { type: "boolean" } } }, dedication: { type: "string" }, page_id: { type: ["string", "null"] }, pledge_id: { type: ["string", "null"] }, tags: { type: "object", description: "Where the gift came from (channel, utm_*, qr, night...)" }, details: { type: "object" }, created_at: { type: "string", format: "date-time" } } },
            DonationCreate: { type: "object", required: ["amount_cents"], properties: { amount_cents: { ...money, minimum: 100 }, currency: { type: "string", default: "USD" }, method: { enum: ["card", "wallet", "bank", "dd", "paypal"], default: "card" }, frequency: { enum: ["once", "monthly", "yearly"], default: "once" }, cover_cents: money, tip_cents: money, fund: { type: "string", examples: ["Zakat", "Sadaqah"] }, page_id: { type: "string", format: "uuid" }, donor: { type: "object", properties: { name: { type: "string" }, email: { type: "string", format: "email" }, anonymous: { type: "boolean" } } }, dedication: { type: "string" }, tags: { type: "object" }, metadata: { type: "object" } } },
            DonationIntent: { type: "object", properties: { object: { const: "donation_intent" }, id: { type: "string", description: "The donation id" }, status: { enum: ["requires_action", "processing", "succeeded", "failed"] }, client_secret: { type: ["string", "null"] }, redirect_url: { type: ["string", "null"] }, stripe_account: { type: ["string", "null"] }, error: { type: ["object", "null"] } } },
            Pledge: { type: "object", properties: { id: { type: "string" }, object: { const: "pledge" }, status: { enum: ["open", "part_paid", "paid", "written_off"] }, amount_cents: money, paid_cents: money, currency: { type: "string" }, event: { type: "string" }, due_date: { type: ["string", "null"], format: "date" }, donor: { ...person, properties: { ...person.properties, phone: { type: ["string", "null"] } } }, pay_path: { type: "string" }, pledged_at: { type: "string", format: "date-time" }, created_at: { type: "string", format: "date-time" } } },
            Receipt: { type: "object", properties: { id: { type: "string" }, object: { const: "receipt" }, kind: { enum: ["gift", "year_end"] }, number: { type: "string" }, year: { type: "integer" }, donation_id: { type: ["string", "null"] }, donor: person, currency: { type: "string" }, total_cents: money, deductible_cents: money, fund: { type: "string" }, lines: { type: "array", items: { type: "object" } }, irs_ack: { type: "boolean" }, dated: { type: "string", format: "date-time" }, sent_at: { type: ["string", "null"], format: "date-time" } } },
            Donor: { type: "object", properties: { id: { type: "string" }, object: { const: "donor" }, email: { type: "string" }, name: { type: "string" }, currency: { type: "string" }, gift_count: { type: "integer" }, total_cents: money, first_gift_at: { type: "string", format: "date-time" }, last_gift_at: { type: "string", format: "date-time" } } },
            Event: { type: "object", properties: { id: { type: "string" }, object: { const: "event" }, type: { enum: [...EVENTS, "webhook.test"] }, created_at: { type: "string", format: "date-time" }, data: { description: "A Donation, Pledge or Receipt, the same shape the API returns" } } },
        },
    },
});
