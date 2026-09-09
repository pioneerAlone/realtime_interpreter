import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// design system v2 (T-G-01) — order matters: tokens first, reset, then primitives
import "./styles/tokens.css";
import "./styles/reset.css";
import "./styles/primitives.css";

// T-G-05/T-G-06: 应用启动时应用模拟状态（dev-only 截图工具）+ preset 加载
import { useEngineStore } from "./store/engine";
import { usePresetStore } from "./store/presets";

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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App
      windowType={windowParam === "capsule" ? "capsule" : "main"}
      demo={demo}
    />
  </React.StrictMode>,
);
