import { defineConfig } from "vite";

// .env lives in the repo root. base "./" lets dist/ be hosted from any path.
export default defineConfig({ envDir: "../..", base: "./", build: { target: "es2022" } });
