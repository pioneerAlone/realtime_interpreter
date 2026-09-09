import React from "react";

interface PageHeadProps {
  title: string;
  subtitle?: string;
  /** 右侧 action slot（如「+ 新建预设」按钮） */
  actions?: React.ReactNode;
}

/**
 * PageHead — 主区顶部 page 标题 + 副标题（T-G-02）
 *
 * Layout：
 *   ┌────────────────────────────────────┐
 *   │ 实时翻译                           │
 *   │ 当前 preset · 日常会议 · 4 设备已就绪│
 *   └────────────────────────────────────┘
 *
 * title 用 display 字体（SF Pro Display），subtitle 用 muted fg。
 * 整个 PageHead 在 data-tauri-drag-region 内（WindowChrome 兜底），所以
 * 拖拽 OK；actions 槽按钮自带 no-drag。
 *
 * 决策来源: `.scratch/gui-rebuild-v0.md` §3.2 Top nav + §4.1 + §5.1
 * Ticket:    #27 (T-G-02)
 */
export default function PageHead({
  title,
  subtitle,
  actions,
}: PageHeadProps): React.ReactElement {
  return (
    <header className="rt-page-head" data-component="page-head">
      <div className="rt-page-head-text">
        <h1 className="rt-page-head-title">{title}</h1>
        {subtitle && <p className="rt-page-head-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="rt-page-head-actions">{actions}</div>}
    </header>
  );
}
