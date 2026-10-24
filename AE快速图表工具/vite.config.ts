import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // 相对路径：既能本地预览 dist，也能部署在 GitHub Pages 的子路径下
  base: "./",
  plugins: [react()],
  server: { port: 5173, host: "127.0.0.1" }
});
