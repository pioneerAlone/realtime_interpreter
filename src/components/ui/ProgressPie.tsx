import React from "react";

interface ProgressPieProps {
  /** 0..100 */
  value: number;
  /** pixel size, default 18 (Things 3 风格) */
  size?: number;
  /** semantic color override (accent | success | warn | error) */
  tone?: "accent" | "success" | "warn" | "error";
  /** ARIA 标签（产品语言，默认 "进度 X%"） */
  label?: string;
}

/**
 * Things 3 风格 SVG-less 圆环进度。
 * 用 conic-gradient + 双 ::before/::after 叠层，无 SVG 依赖。
 *
 * 数据语义：value 表示完成度（0..100），不绑任何技术名词。
 * 视觉：accent tone 默认；success/warn/error 可选。
 *
 * 决策来源: `.scratch/gui-rebuild-v0.md` §1 (Things 3 patterns)
 * Ticket:    #26 (T-G-01)
 */
export default function ProgressPie({
  value,
  size = 18,
  tone = "accent",
  label,
}: ProgressPieProps): React.ReactElement {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const ariaLabel = label ?? `进度 ${clamped}%`;
  return (
    <span
      className="rt-progress-pie"
      data-tone={tone}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={ariaLabel}
      style={
        {
          ["--pie-size" as string]: `${size}px`,
          ["--pie-value" as string]: String(clamped),
        } as React.CSSProperties
      }
    />
  );
}
