import React from "react";

interface WireHintProps {
  /** 箭头字符（↓ / ↻ / ↑ / ↓ 等），默认 ↓ */
  icon?: string;
  children: React.ReactNode;
}

/**
 * Loopback 风格 "↓ Teams 麦克风 绑定这里" 细线 + 箭头。
 * 用 ::before 画竖线（从上方 picker 引出），文字紧贴下方。
 *
 * 用法：放在 picker-row 下方，视觉化 input→output 关系。
 *
 * 决策来源: `.scratch/gui-rebuild-v0.md` §4.4 (wire-hint)
 * Ticket:    #26 (T-G-01) · 配合 T-G-03 (picker row)
 */
export default function WireHint({
  icon = "↓",
  children,
}: WireHintProps): React.ReactElement {
  return (
    <div className="rt-wire-hint" data-component="wire-hint">
      <span className="rt-wire-hint-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="rt-wire-hint-text">{children}</span>
    </div>
  );
}
