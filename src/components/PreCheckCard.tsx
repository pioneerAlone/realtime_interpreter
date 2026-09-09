import React from "react";

export type PreCheckTone = "success" | "warn" | "error" | "idle";

interface PreCheckCardProps {
  /** 状态点符号（● 绿 / ● 黄 / ● 红 / ⚠ 警告 / ○ 未启动） */
  icon: string;
  /** 状态点 tone · 决定颜色 + 是否发光 */
  tone: PreCheckTone;
  /** 检查项 label（如「R3 麦克风」） */
  label: string;
  /** 检查项当前值（如「MacBook Air 麦克风」或「—」） */
  value: string;
  /** 右侧状态 pill 文本（如「可用」/「RTT 412ms」/「失败」/「已授权」） */
  statusLabel: string;
}

/**
 * PreCheckCard — 单个预检卡（T-G-05）
 *
 * 视觉：
 *   [icon] [label                ] [statusLabel]
 *          [value                 ]
 *
 * 状态点 tone 决定左侧 icon 颜色 + 是否发光。
 *
 * 决策来源: `.scratch/gui-rebuild-v0.md` §5.1 预检卡
 * Ticket:    #31 (T-G-05)
 */
export default function PreCheckCard({
  icon,
  tone,
  label,
  value,
  statusLabel,
}: PreCheckCardProps): React.ReactElement {
  return (
    <div
      className="rt-precheck-card"
      data-component="precheck-card"
      data-tone={tone}
    >
      <span
        className="rt-precheck-icon"
        data-tone={tone}
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="rt-precheck-text">
        <span className="rt-precheck-label">{label}</span>
        <span className="rt-precheck-value">{value}</span>
      </div>
      <span className="rt-precheck-status" data-tone={tone}>
        {statusLabel}
      </span>
    </div>
  );
}
