import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// design system v2 (T-G-01) — order matters: tokens first, reset, then primitives
import "./styles/tokens.css";
import "./styles/reset.css";
import "./styles/primitives.css";

// T-G-05/T-G-06/T-G-07: 应用启动时应用模拟状态（dev-only 截图工具）+ preset 加载
import { useEngineStore } from "./store/engine";
import { usePresetStore } from "./store/presets";
import { useCaptionStore } from "./store/caption";

const queryParams = new URLSearchParams(window.location.search);
const demo = queryParams.get("demo"); // "atoms" → AtomsDemo
const windowParam = queryParams.get("window"); // "capsule" → SubtitleView
const sim = queryParams.get("sim"); // "engine_fail" / "engine_warn" / "engine_success" / "engine_no_key"

if (sim === "engine_fail") {
  useEngineStore.getState().setCredentialsMock({
    lastTestResult: "fail",
    lastRttMs: null,
    lastTestAt: "刚刚",
    lastError: "连接超时",
  });
} else if (sim === "engine_warn") {
  useEngineStore.getState().setCredentialsMock({
    lastTestResult: "success",
    lastRttMs: 412,
    lastTestAt: "2 小时前",
    lastNode: "火山引擎北京节点",
  });
} else if (sim === "engine_success") {
  useEngineStore.getState().setCredentialsMock({
    lastTestResult: "success",
    lastRttMs: 95,
    lastTestAt: "刚刚",
    lastNode: "火山引擎北京节点",
  });
} else if (sim === "engine_no_key") {
  useEngineStore.getState().setCredentialsMock({
    apiKeySet: false,
    maskedKey: "",
    lastTestResult: null,
    lastRttMs: null,
    lastTestAt: null,
  });
}

// 应用启动时加载 preset 配置（避免 dashboard 首次显示 "未选择 preset"）
void usePresetStore.getState().load();

// T-G-07: caption 状态模拟（dev-only）
if (windowParam !== "capsule") {
  // 主窗不模拟 caption
} else if (sim === "caption_empty") {
  useCaptionStore.getState().setMockState("empty");
} else if (sim === "caption_single") {
  useCaptionStore.getState().setMockState("single");
} else if (sim === "caption_multi") {
  useCaptionStore.getState().setMockState("multi");
} else if (sim === "caption_streaming") {
  useCaptionStore.getState().setMockState("streaming");
} else if (sim === "caption_disconnected") {
  useCaptionStore.getState().setMockState("disconnected");
} else {
  // 默认：空态
  useCaptionStore.getState().setMockState("empty");
}

// T-G-08: 监听系统托盘事件（仅 Tauri runtime · 浏览器 preview 跳过）
import { isTauri } from "./lib/ipc/shared";
if (isTauri() && windowParam !== "capsule") {
  void import("@tauri-apps/api/event").then(async ({ listen }) => {
    // 启动同传 · 系统托盘 → React
    await listen("tray:start_engine", () => {
      void useEngineStore.getState().start();
    });
    // 切换 preset · 系统托盘 → React
    await listen<string>("tray:switch_preset", (event) => {
      void usePresetStore.getState().setActive(event.payload);
    });
    // 静音切换 · v0 mock 真实 R3 mute 属于 #03
    await listen("tray:toggle_mute", () => {
      console.log("[tray] toggle_mute · v0 mock · 真实 R3 mute 属于 #03 ticket");
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App
      windowType={windowParam === "capsule" ? "capsule" : "main"}
      demo={demo}
    />
  </React.StrictMode>,
);
