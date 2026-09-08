/**
 * SettingRow — 设置行（卡片化 2 列：label + trailing control）。
 * ----------------------------------------------------------------------
 * 移植自 Open-Less `src/pages/settings/shared.tsx:54-117` 的 `SettingRow`。
 * 这是 settings modal 内的基本单元：每个 setting 一行，左侧 label +
 * 描述（hover label 出 tooltip），右侧拖尾控件（Switch / SelectLite /
 * Segmented / Btn / 等）。
 *
 * 视觉契约（参考 Open-Less 1647-line deep-dive 1.5 节）：
 * - CSS Grid \`180px minmax(0, 1fr)\`（桌面）/ \`minmax(0, 1fr)\`（窄屏）
 * - 0.5px 顶部分隔（除第一行外）— 与卡片化卡片化视觉一致
 * - 13px label + 11.5px desc（desc 11.5px 仅在 tooltip hover 时显示）
 * - trailing slot 接受任意 ReactNode
 *
 * 不做（明确边界）：
 * - 不内嵌 Tooltip（依赖父组件传入 — 设置页常省略 tooltip 描述）
 * - 不接管焦点（trailing 控件自己管理）
 * - 不做响应式断点（v0 桌面 1240px 固定，窄屏布局 v1 再说）
 *
 * 用法：
 *   <SettingRow label="字幕语言" desc="翻译成哪种语言显示">
 *     <Segmented value="双语" onChange={...} options={...} ariaLabel="字幕语言" />
 *   </SettingRow>
 */

import type { CSSProperties, ReactNode } from "react";

export interface SettingRowProps {
  /** 设置项标题（13px medium） */
  label: string;
  /** 描述文字（11.5px，hover label 时显示为 tooltip） */
  desc?: string;
  /** 拖尾控件 slot：任意 ReactNode（Switch / Segmented / SelectLite / Btn） */
  children: ReactNode;
  /** 拖尾控件固定宽度：number=px / string=CSS length / 不传=auto */
  controlWidth?: number | string;
  /** 隐藏顶部分隔（用于卡片首行） */
  noDivider?: boolean;
  /** 自定义 grid 模板（如窄屏想强制单列） */
  gridTemplate?: string;
}

const LABEL_STYLE: CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "var(--ink)",
  minWidth: 0,
};

const DESC_STYLE: CSSProperties = {
  fontSize: 11.5,
  color: "var(--ink-muted)",
  marginTop: 4,
  lineHeight: 1.5,
};

// 可悬停的 label 视觉：虚线下划线 + help 光标，暗示「悬停可看解释」。
// 与 Open-Less `shared.tsx:8-13` 的 `hintableTextStyle` 一致。
const HINTABLE_LABEL: CSSProperties = {
  ...LABEL_STYLE,
  cursor: "help",
  textDecoration: "underline dotted",
  textDecorationColor: "var(--ink-subtle)",
  textUnderlineOffset: 3,
};

export function SettingRow({
  label,
  desc,
  children,
  controlWidth,
  noDivider = false,
  gridTemplate = "minmax(0, 180px) minmax(0, 1fr)",
}: SettingRowProps) {
  const rowStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: gridTemplate,
    gap: 16,
    padding: "14px 0",
    borderTop: noDivider ? "0" : "0.5px solid var(--line-soft)",
    alignItems: "center",
  };

  const labelColStyle: CSSProperties = {
    minWidth: 0,
    alignSelf: "center",
    display: "flex",
    flexDirection: "column",
  };

  const trailingColStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    minWidth: 0,
    width: controlWidth ?? "auto",
    maxWidth: "100%",
    flexWrap: "nowrap",
    gap: 6,
  };

  return (
    <div style={rowStyle}>
      <div style={labelColStyle}>
        <span
          style={desc ? HINTABLE_LABEL : LABEL_STYLE}
          title={desc}
        >
          {label}
        </span>
        {desc && <span style={DESC_STYLE}>{desc}</span>}
      </div>
      <div style={trailingColStyle}>{children}</div>
    </div>
  );
}
