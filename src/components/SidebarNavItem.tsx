import React from "react";

interface SidebarNavItemProps {
  /** label 显示文本（产品语言） */
  label: string;
  /** 右侧 keyboard hint（如 ⌘,） */
  hint?: string;
  active?: boolean;
  onClick?: () => void;
}

/**
 * SidebarNavItem — Things 3 rectangular nav row（T-G-02）
 *
 * 视觉：8px 圆角（Things 3 主导）；active = subtle tint `rgba(37,113,232,0.08)`
 *       + 左侧 3px accent bar；hover = neutral-4 灰底。
 *
 * 行为：clickable（onClick），active 时 aria-current=true。
 *
 * 决策来源: `.scratch/gui-rebuild-v0.md` §3 主窗 IA
 * Ticket:    #27 (T-G-02)
 */
export default function SidebarNavItem({
  label,
  hint,
  active = false,
  onClick,
}: SidebarNavItemProps): React.ReactElement {
  return (
    <button
      type="button"
      className="rt-nav-item"
      data-component="sidebar-nav-item"
      data-active={active}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
    >
      <span className="rt-nav-item-bar" aria-hidden="true" />
      <span className="rt-nav-item-label">{label}</span>
      {hint && <span className="rt-nav-item-hint">{hint}</span>}
    </button>
  );
}
