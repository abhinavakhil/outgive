/*
 * Outgive Checkout, embedded on any site. Paste:
 *   <script src="https://www.outgive.tech/embed/v1.js"></script>
 *   <div id="give"></div>
 *   <script>
 *     Outgive.checkout({ el: "#give", charity: "your-slug", layout: "compact", funds: ["zakat", "sadaqah"],
 *       addons: ["cover", "alfitr"], coverFees: false, source: { utm: true, qr: "table-6" },
 *       amount: 120.5, fund: "zakat", onPaid: function (e) {} });
 *   </script>
 * The checkout runs in an iframe on Outgive (card details never touch the host page) and grows to fit. Anything left out comes
 * from the charity's checkout builder. Returns { destroy() }.
 */
(function () {
    var me = document.currentScript, origin = me && me.src ? new URL(me.src).origin : "https://www.outgive.tech";
    var frames = [];
    window.addEventListener("message", function (e) {
        if (e.origin !== origin || !e.data || typeof e.data.type !== "string") return;
        for (var i = 0; i < frames.length; i++) {
            var f = frames[i];
            if (e.source !== f.iframe.contentWindow) continue;
            if (e.data.type === "outgive:height") f.iframe.style.height = Math.max(320, Math.min(4000, Number(e.data.height) || 0)) + "px";
            if (e.data.type === "outgive:paid" && typeof f.onPaid === "function") { try { f.onPaid(e.data); } catch (err) { console.error(err); } }
        }
    });
    function list(v) { return Array.isArray(v) ? v.join(",") : typeof v === "string" ? v : ""; }
    function checkout(o) {
        o = o || {};
        var el = typeof o.el === "string" ? document.querySelector(o.el) : o.el;
        if (!el) throw new Error("Outgive.checkout: no element for " + o.el);
        if (!o.charity) throw new Error("Outgive.checkout: charity is required");
        var q = new URLSearchParams({ embed: "1", charity: String(o.charity) });
        if (o.layout) q.set("layout", o.layout);
        if (o.funds) q.set("funds", list(o.funds));
        if (o.addons) q.set("addons", list(o.addons));
        if (typeof o.coverFees === "boolean") q.set("coverFees", o.coverFees ? "1" : "0");
        if (o.amount) q.set("amount", String(o.amount));
        if (o.fund) q.set("fund", o.fund);
        var src = Object.assign({}, o.source || {});
        if (src.utm) { new URLSearchParams(location.search).forEach(function (v, k) { if (/^utm_[a-z]+$/.test(k)) src[k] = v; }); }
        delete src.utm;
        src.host = location.hostname;
        q.set("source", JSON.stringify(src));
        var iframe = document.createElement("iframe");
        iframe.src = origin + "/checkout?" + q.toString();
        iframe.title = "Donate";
        iframe.allow = "payment *";
        iframe.style.cssText = "display:block;width:100%;height:720px;border:0;background:transparent;color-scheme:light";
        el.innerHTML = "";
        el.appendChild(iframe);
        var f = { iframe: iframe, onPaid: o.onPaid };
        frames.push(f);
        return { destroy: function () { iframe.remove(); frames = frames.filter(function (x) { return x !== f; }); } };
    }
    window.Outgive = Object.assign(window.Outgive || {}, { checkout: checkout });
})();
