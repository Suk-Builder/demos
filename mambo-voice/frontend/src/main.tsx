/**
 * main.tsx - 曼波语音助手入口文件
 *
 * 这是应用的入口点，负责：
 * 1. 引入 React 18+ 的 createRoot API
 * 2. 渲染根组件 App
 * 3. 引入全局样式
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// 引入全局样式（含 Tailwind CSS、动画、自定义变量）
import "./index.css";

/**
 * 获取根 DOM 节点并创建 React 根实例
 * 使用 createRoot 启用 React 18+ 并发特性
 */
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("找不到 root 元素，请检查 index.html 中是否有 <div id='root'></div>");
}

const root = createRoot(rootElement);

/**
 * 渲染应用根组件
 * StrictMode 用于开发时检测潜在问题
 */
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
