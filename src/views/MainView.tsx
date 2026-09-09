import React from "react";
import { useShellStore } from "../store/shell";
import WindowChrome from "../components/WindowChrome";
import Sidebar from "../components/Sidebar";
import TranslateView from "./TranslateView";
import SettingsView from "./SettingsView";

/**
 * MainView — 主窗（T-G-02）
 *
 * Layout：
 *   ┌──────────┬────────────────────────────────┐
 *   │          │ PageHead (title + subtitle)    │
 *   │ Sidebar  ├────────────────────────────────┤
 *   │  (220px) │ <View> (Translate | Settings)   │
 *   │          │                                │
 *   │          │                                │
 *   └──────────┴────────────────────────────────┘
 *
 * view state 在 useShellStore（Zustand）。Sidebar 切换 nav → store 更新 → 这里重渲染。
 *
 * 决策来源: `.scratch/gui-rebuild-v0.md` §3 + §10.1 T-G-02
 * Ticket:    #27 (T-G-02)
 */
export default function MainView(): React.ReactElement {
  const view = useShellStore((s) => s.view);

  return (
    <WindowChrome>
      <div className="rt-shell">
        <Sidebar />
        <div className="rt-main">
          {view === "translate" ? <TranslateView /> : <SettingsView />}
        </div>
      </div>
    </WindowChrome>
  );
}
