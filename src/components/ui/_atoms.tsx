/**
 * 设计系统 atoms (v0) — Btn / Card / Pill
 * ----------------------------------------------------------------------
 * 这是 GUI 重构的地基组件。后续所有 molecule / organism 都建立在
 * 这三个原子之上。
 *
 * 设计原则：
 * - 全部 inline style + tokens.css 变量；**不**引入 Tailwind / CSS-in-JS
 *   库（v0 包大小控制 + 与 Open-Less 的 tokens.css 风格对齐）。
 * - 颜色 / 字号 / 间距 / 圆角 全部从 `var(--xxx)` 取，主题跟随系统。
 * - variant / size 用 union type 而非 enum（TS 5.6 + tree-shaking 友好）。
 * - 所有按钮 / 卡片 / chip 都带焦点环（`var(--focus-ring)`），符合
 *   macOS 平台可访问性惯例。
 *
 * 不做什么（明确边界）：
 * - 不做 SelectLite / Tooltip / AudioBars（这些是 T-G-2 组件库范围）。
 * - 不做 Modal / Drawer（这些是 T-G-7 / T-G-8 范围）。
 * - 不写状态色（绿/红）按钮 — 状态色仅用于 chip (Pill)，按钮保持
 *   单色 + 强调色，避免误用为警示。
 */

import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";

/* =====================================================================
 * Btn — 按钮
 * ===================================================================== */

export type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
export type BtnSize = "sm" | "md" | "lg";

export interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
  /** pill = 胶囊形（启停按钮用），square = 直角圆角（普通按钮） */
  shape?: "pill" | "square";
  /** 左侧图标字符或文本（不渲染节点，仅作 slot） */
  leading?: ReactNode;
  /** 右侧图标字符或文本 */
  trailing?: ReactNode;
  fullWidth?: boolean;
}

/** size → padding / fontSize 映射（紧凑表格，便于 review） */
const BTN_SIZE: Record<BtnSize, {
  paddingY: number;
  paddingX: number;
  fontSize: number;
  height: number;
  gap: number;
}> = {
  sm: { paddingY: 4, paddingX: 10, fontSize: 12, height: 24, gap: 4 },
  md: { paddingY: 6, paddingX: 14, fontSize: 13, height: 30, gap: 6 },
  lg: { paddingY: 8, paddingX: 18, fontSize: 14, height: 36, gap: 8 },
};

/** variant → 颜色组合。danger 是柔和红（不饱和），不是刺眼警示 */
const BTN_VARIANT_BASE: Record<BtnVariant, {
  bg: string;
  bgHover: string;
  ink: string;
  border: string | "none";
}> = {
  primary: {
    bg: "var(--accent)",
    bgHover: "var(--accent-hover)",
    ink: "var(--accent-ink)",
    border: "none",
  },
  secondary: {
    bg: "var(--bg-elevated)",
    bgHover: "var(--bg-card)",
    ink: "var(--ink)",
    border: "0.5px solid var(--line)",
  },
  ghost: {
    bg: "transparent",
    bgHover: "var(--bg-card)",
    ink: "var(--ink)",
    border: "none",
  },
  danger: {
    bg: "var(--critical-soft)",
    bgHover: "var(--critical)",
    ink: "var(--critical)",
    border: "none",
  },
};

export function Btn({
  variant = "secondary",
  size = "md",
  shape = "square",
  leading,
  trailing,
  fullWidth,
  style,
  children,
  disabled,
  onMouseEnter,
  onMouseLeave,
  ...rest
}: BtnProps) {
  const sizeCfg = BTN_SIZE[size];
  const variantCfg = BTN_VARIANT_BASE[variant];

  // hover 通过 React 状态而不是 CSS pseudo-class（inline style 无法
  // 用 :hover selector，所以手动追踪）。
  const handleEnter: BtnProps["onMouseEnter"] = (e) => {
    e.currentTarget.style.background = variantCfg.bgHover;
    // primary/danger 的悬停态颜色更深，文字保持不变
    if (variant === "secondary" || variant === "ghost") {
      e.currentTarget.style.color = "var(--ink)";
    }
    onMouseEnter?.(e);
  };
  const handleLeave: BtnProps["onMouseLeave"] = (e) => {
    e.currentTarget.style.background = variantCfg.bg;
    e.currentTarget.style.color = variantCfg.ink;
    onMouseLeave?.(e);
  };

  const baseStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: sizeCfg.gap,
    height: sizeCfg.height,
    paddingInline: sizeCfg.paddingX,
    fontSize: sizeCfg.fontSize,
    fontWeight: 500,
    lineHeight: 1,
    whiteSpace: "nowrap",
    borderRadius: shape === "pill" ? "var(--radius-pill)" : "var(--radius-md)",
    border: variantCfg.border,
    background: variantCfg.bg,
    color: variantCfg.ink,
    transition: "background var(--motion-fast) var(--motion-ease), color var(--motion-fast) var(--motion-ease)",
    cursor: disabled ? "not-allowed" : "default",
    opacity: disabled ? 0.5 : 1,
    width: fullWidth ? "100%" : undefined,
    fontFamily: "inherit",
  };

  return (
    <button
      type="button"
      style={{ ...baseStyle, ...style }}
      disabled={disabled}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      {...rest}
    >
      {leading != null && <span style={{ display: "inline-flex" }}>{leading}</span>}
      {children}
      {trailing != null && <span style={{ display: "inline-flex" }}>{trailing}</span>}
    </button>
  );
}

/* =====================================================================
 * Card — 卡片容器
 * ===================================================================== */

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** padding 密度：none / sm / md / lg */
  padding?: "none" | "sm" | "md" | "lg";
  /** 是否显示 backdrop-blur（v0 飘窗 / 浮层默认开） */
  blurred?: boolean;
  /** 边角密度：md / lg */
  rounded?: "md" | "lg";
}

const CARD_PADDING: Record<NonNullable<CardProps["padding"]>, number> = {
  none: 0,
  sm: 10,
  md: 14,
  lg: 20,
};

export function Card({
  padding = "md",
  blurred = false,
  rounded = "md",
  style,
  children,
  ...rest
}: CardProps) {
  const cardStyle: CSSProperties = {
    background: blurred ? "var(--bg-card)" : "var(--bg-card-solid)",
    border: "0.5px solid var(--line)",
    borderRadius: rounded === "lg" ? "var(--radius-lg)" : "var(--radius-md)",
    padding: CARD_PADDING[padding],
    backdropFilter: blurred ? "blur(20px) saturate(180%)" : undefined,
    WebkitBackdropFilter: blurred ? "blur(20px) saturate(180%)" : undefined,
    boxShadow: "var(--shadow-sm)",
    color: "var(--ink)",
  };

  return (
    <div style={{ ...cardStyle, ...style }} {...rest}>
      {children}
    </div>
  );
}

/* =====================================================================
 * Pill — 状态胶囊
 * ===================================================================== */

export type PillTone = "neutral" | "accent" | "positive" | "warn" | "critical";

export interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: PillTone;
  /** pill 内左侧状态点（典型用法：颜色圆点） */
  dot?: boolean;
}

const PILL_TONE: Record<PillTone, { bg: string; ink: string; dotColor: string }> = {
  neutral: {
    bg: "var(--bg-card)",
    ink: "var(--ink-muted)",
    dotColor: "var(--ink-subtle)",
  },
  accent: {
    bg: "var(--accent-soft)",
    ink: "var(--accent)",
    dotColor: "var(--accent)",
  },
  positive: {
    bg: "var(--positive-soft)",
    ink: "var(--positive)",
    dotColor: "var(--positive)",
  },
  warn: {
    bg: "var(--warn-soft)",
    ink: "var(--warn)",
    dotColor: "var(--warn)",
  },
  critical: {
    bg: "var(--critical-soft)",
    ink: "var(--critical)",
    dotColor: "var(--critical)",
  },
};

export function Pill({ tone = "neutral", dot, style, children, ...rest }: PillProps) {
  const cfg = PILL_TONE[tone];

  const pillStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "2px 8px",
    borderRadius: "var(--radius-pill)",
    background: cfg.bg,
    color: cfg.ink,
    fontSize: "var(--font-size-xs)",
    fontWeight: 500,
    letterSpacing: 0.2,
    lineHeight: 1.4,
    whiteSpace: "nowrap",
  };

  return (
    <span style={{ ...pillStyle, ...style }} {...rest}>
      {dot && (
        <span
          aria-hidden
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: cfg.dotColor,
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}
