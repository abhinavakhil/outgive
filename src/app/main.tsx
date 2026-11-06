import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import { initAnalytics } from "@/shared/lib/analytics";
import "@abhinavakhil/penna-core/penna.css";
import "@/shared/styles/outgive.css";

initAnalytics();
createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
