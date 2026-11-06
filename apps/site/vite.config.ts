import { defineConfig } from "vite";
export default defineConfig({ envDir: "../..", base: "./", build: { rollupOptions: { input: { main: "index.html", demo: "demo.html" } } } });
