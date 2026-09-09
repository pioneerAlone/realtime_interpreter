import React from "react";

interface WindowChromeProps {
  children: React.ReactNode;
}

/**
 * WindowChrome — 主窗根容器（T-G-02）
 *
 * 职责：
 *   - macOS traffic light 留白（顶部 28px 安全区，避免 logo/标题与 traffic lights 碰撞）
 *   - data-tauri-drag-region 兜底（在 main / sidebar 整个窗口都可拖）
 *   - 内嵌 children：Sidebar + Main
 *
 * 不做的事：
 *   - 不渲染 traffic lights（Tauri 原生 macOS Overlay 标题栏自己画）
 *   - 不管 nav / view 切换（由 Sidebar + Main 自己处理）
 *
 * 决策来源: `.scratch/gui-rebuild-v0.md` §3 主窗 IA + §10.1 T-G-02
 * Ticket:    #27 (T-G-02)
 */
export default function WindowChrome({
  children,
}: WindowChromeProps): React.ReactElement {
  return (
    <div
      className="rt-window-chrome"
      data-component="window-chrome"
      data-tauri-drag-region
    >
      {children}
    </div>
  );
}
