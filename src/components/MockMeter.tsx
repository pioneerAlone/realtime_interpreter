import React from "react";

interface MockMeterProps {
  /** 0..100 */
  level: number;
  /** pixel width, default 50 (design freeze §4.3) */
  width?: number;
  /** pixel height, default 4 */
  height?: number;
}

/**
 * MockMeter — 简易音频电平（T-G-03 mock）
 *
 * v0 不接真实 audio level（属于 audio pipeline scope）· 仅视觉占位。
 * 真实 R3/R4 level meter 属于 T-G-05 (dashboard) + audio engine 实装。
 *
 * 视觉：conic-gradient 模拟横向电平（accent tint）+ 右侧 1px 标记线 · OBS 风格。
 *
 * 决策来源: `.scratch/gui-rebuild-v0.md` §4.3 (picker 行 meter)
 * Ticket:    #28 (T-G-03)
 */
export default function MockMeter({
  level,
  width = 50,
  height = 4,
}: MockMeterProps): React.ReactElement {
  const clamped = Math.max(0, Math.min(100, Math.round(level)));
  return (
    <span
      className="rt-mock-meter"
      data-component="mock-meter"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={`电平 ${clamped}%`}
      style={
        {
          ["--meter-width" as string]: `${width}px`,
          ["--meter-height" as string]: `${height}px`,
          ["--meter-level" as string]: String(clamped),
        } as React.CSSProperties
      }
    />
  );
}
