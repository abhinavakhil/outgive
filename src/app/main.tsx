import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Global CSS first: it declares Tailwind's layer order (base < components < utilities), which feature CSS imported with App relies on.
import "@abhinavakhil/penna-core/penna.css";
import "@/shared/styles/outgive.css";
import { App } from "@/app/App";
import { initAnalytics } from "@/shared/lib/analytics";

initAnalytics();
const render = () => createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
// Dev only: ?seed=leaderboard fills the campaign service with sample teams and fundraisers, then cleans the address.
if (import.meta.env.DEV && new URLSearchParams(location.search).get("seed") === "leaderboard") {
    import("@/shared/lib/seed-campaigns").then((m) => m.seedLeaderboard()).finally(() => { history.replaceState(null, "", location.pathname); render(); });
} else render();
