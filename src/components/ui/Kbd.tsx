/**
 * Kbd / KbdGroup — 键帽显示（Open-Less `Kbd.tsx` 移植）。
 * ----------------------------------------------------------------------
 * 语义用真 `<kbd>` 元素（屏幕阅读器会念 "Key ..."）。键帽视觉：
 * - 浅灰底 + 0.5px 描边 + `box-shadow: 0 1.5px 0 var(--line)` 出立体感
 * - min-width 20 / height 21 / 5px 圆角
 * - 字体 11.5px / weight 500
 *
 * 用法：
 *   <Kbd>⌘</Kbd>           ← 单键
 *   <KbdGroup keys={["⌘", ","]} />  ← 组合键 ⌘,
 *   <KbdGroup keys={["⌥", "Space"]} />  ← 左 ⌥ + Space
 */

import type { CSSProperties, ReactNode } from "react";

export function Kbd({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <kbd style={{ ...kbdStyle, ...style }}>{children}</kbd>;
}

/** 组合键：一组键帽并排展示，中间 4px gap。 */
export function KbdGroup({ keys, style }: { keys: string[]; style?: CSSProperties }) {
  return (
    <span style={{ ...groupStyle, ...style }}>
      {keys.map((key, i) => (
        <Kbd key={`${key}-${i}`}>{key}</Kbd>
      ))}
    </span>
  );
}

const kbdStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 20,
  height: 21,
  padding: "0 6px",
  borderRadius: 5,
  fontSize: 11.5,
  lineHeight: 1,
  fontWeight: 500,
  fontFamily: "var(--font-sans)",
  color: "var(--ink-muted)",
  background: "var(--bg-elevated)",
  border: "0.5px solid var(--line-strong)",
  // 键帽立体感：底边多一线阴影。
  boxShadow: "0 1.5px 0 var(--line), 0 0 0 0.5px rgba(0, 0, 0, 0.02)",
  whiteSpace: "nowrap",
};

const groupStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};
