import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
    worker: { format: "es" },
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    // PGlite (the in-browser Postgres behind the demo) ships WASM that must stay a separate, lazily fetched asset.
    optimizeDeps: { exclude: ["@electric-sql/pglite"] },
    build: { target: "es2022", cssCodeSplit: false, assetsInlineLimit: (file) => !/\.(wasm|data)$/.test(file) && undefined },
});
