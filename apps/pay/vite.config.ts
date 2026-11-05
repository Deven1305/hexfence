import { defineConfig } from "vite";

// .env lives in the repo root; Vite exposes only VITE_* names to the browser.
export default defineConfig({ envDir: "../..", build: { target: "es2022" } });
