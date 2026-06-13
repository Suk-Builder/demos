/**
 * vite.config.ts - Vite 构建配置
 *
 * 配置 React 插件和 Tailwind CSS 支持
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Vite 配置
 */
export default defineConfig({
  plugins: [
    // React 支持（JSX 转换、Fast Refresh 等）
    react(),
    // Tailwind CSS v4 支持
    tailwindcss(),
  ],
  // 开发服务器配置
  server: {
    port: 5173,
    host: true,
    open: false,
  },
  // 构建配置
  build: {
    target: "es2020",
    outDir: "dist",
    sourcemap: true,
  },
});
