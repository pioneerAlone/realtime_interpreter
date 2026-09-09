import React from "react";
import { useShellStore, type ShellView } from "../store/shell";
import SidebarNavItem from "./SidebarNavItem";

/**
 * Sidebar — 220px 主侧栏（T-G-02）
 *
 * Layout：
 *   ┌──────────────────┐
 *   │ 28px traffic 区   │ ← macOS native overlay 标题栏 + traffic lights
 *   │ ◐ realtime_interp│ ← logo wordmark
 *   ├──────────────────┤
 *   │ ▎实时翻译         │ ← Things 3 rectangular nav
 *   │   设置      ⌘,   │
 *   │                  │
 *   │                  │ ← spacer
 *   ├──────────────────┤
 *   │ ● v0 · macOS    │ ← footer
 *   └──────────────────┘
 *
 * 决策来源: `.scratch/gui-rebuild-v0.md` §3.1 Sidebar（220px · Open-Less 同款）
 * Ticket:    #27 (T-G-02)
 */
export default function Sidebar(): React.ReactElement {
  const view = useShellStore((s) => s.view);
  const setView = useShellStore((s) => s.setView);

  const switchTo = (next: ShellView) => (): void => {
    setView(next);
  };

  return (
    <aside
      className="rt-sidebar"
      data-component="sidebar"
      aria-label="主导航"
    >
      <div className="rt-sidebar-traffic-area" aria-hidden="true" />

      <div className="rt-sidebar-logo">
        <span className="rt-sidebar-logo-mark" aria-hidden="true">
          ◐
        </span>
        <span className="rt-sidebar-logo-text">realtime_interpreter</span>
      </div>

      <nav className="rt-sidebar-nav" aria-label="主视图">
        <SidebarNavItem
          label="实时翻译"
          active={view === "translate"}
          onClick={switchTo("translate")}
        />
        <SidebarNavItem
          label="设置"
          hint="⌘,"
          active={view === "settings"}
          onClick={switchTo("settings")}
        />
      </nav>

      <div className="rt-sidebar-spacer" aria-hidden="true" />

      <footer className="rt-sidebar-footer" aria-label="版本信息">
        <span className="rt-sidebar-footer-dot" aria-hidden="true" />
        <span className="rt-sidebar-footer-text">v0 · macOS</span>
      </footer>
    </aside>
  );
}
