import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/App";
import { initAnalytics } from "@/analytics";
import "@abhinavakhil/penna-core/penna.css";
import "@/styles/outgive.css";

initAnalytics();
createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
