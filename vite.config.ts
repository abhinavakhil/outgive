import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    build: { target: "es2022", cssCodeSplit: false, assetsInlineLimit: 100000000, rollupOptions: { output: { inlineDynamicImports: true } } },
});
