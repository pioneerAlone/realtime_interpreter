/**
 * Segmented — 分段控件（iOS / HaloVoice 风格，左/中/右 互斥选择）。
 * ----------------------------------------------------------------------
 * 移植自 Open-Less `src/components/ui/SegSimple.tsx`，但**重写**为受控 +
 * a11y 完整版（原 SegSimple 是 uncontrolled，无 onChange 无 aria-pressed）。
 *
 * 设计要点：
 * - 受控：`value` + `onChange(value: string)` — 父组件持有 state
 * - a11y：`role="radiogroup"` 外层 + `role="radio"` 内层 + `aria-checked`
 * - 视觉：2px 内 padding 轨道 + 选中项白色实色 + `shadow-sm` 抬升
 * - 选项支持 ReactNode（不限于 string — 允许图标 + 文字组合）
 *
 * 使用：
 *   const [pos, setPos] = useState<"top" | "bottom" | "custom">("bottom");
 *   <Segmented
 *     value={pos}
 *     onChange={setPos}
 *     options={[
 *       { value: "top", label: "屏幕上方" },
 *       { value: "bottom", label: "屏幕下方" },
 *       { value: "custom", label: "自定义" },
 *     ]}
 *     ariaLabel="字幕位置"
 *   />
 */

import { type CSSProperties, type ReactNode } from "react";

export interface SegmentedOption<V extends string = string> {
  value: V;
  label: ReactNode;
  disabled?: boolean;
}

export interface SegmentedProps<V extends string = string> {
  value: V;
  onChange: (value: V) => void;
  options: SegmentedOption<V>[];
  /** a11y — radio group 必传 */
  ariaLabel: string;
  disabled?: boolean;
  /** fullWidth 让轨道撑满父容器（默认 inline-flex） */
  fullWidth?: boolean;
  /** 选项等宽（默认按内容宽度） */
  equalWidth?: boolean;
  size?: "sm" | "md";
}

const SEGMENTED_SIZE: Record<NonNullable<SegmentedProps["size"]>, {
  optionPadding: string;
  fontSize: number;
  optionRadius: number;
}> = {
  sm: { optionPadding: "4px 10px", fontSize: 11.5, optionRadius: 5 },
  md: { optionPadding: "5px 12px", fontSize: 12, optionRadius: 6 },
};

export function Segmented<V extends string = string>({
  value,
  onChange,
  options,
  ariaLabel,
  disabled = false,
  fullWidth = false,
  equalWidth = false,
  size = "md",
}: SegmentedProps<V>) {
  const sizeCfg = SEGMENTED_SIZE[size];

  const trackStyle: CSSProperties = {
    display: fullWidth ? "flex" : "inline-flex",
    width: fullWidth ? "100%" : undefined,
    padding: 2,
    borderRadius: 8,
    background: "var(--segmented-bg)",
    gap: 0,
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={trackStyle}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        const isDisabled = disabled || option.disabled;

        const optionStyle: CSSProperties = {
          flex: equalWidth || fullWidth ? "1 1 0" : "0 0 auto",
          padding: sizeCfg.optionPadding,
          fontSize: sizeCfg.fontSize,
          fontWeight: 500,
          fontFamily: "inherit",
          border: 0,
          borderRadius: sizeCfg.optionRadius,
          background: isSelected ? "var(--segmented-active-bg)" : "transparent",
          color: isSelected ? "var(--ink)" : "var(--ink-muted)",
          boxShadow: isSelected ? "var(--segmented-active-shadow)" : "none",
          cursor: isDisabled ? "not-allowed" : "default",
          opacity: isDisabled ? 0.5 : 1,
          transition:
            "background var(--motion-quick) var(--motion-ease), color var(--motion-quick) var(--motion-ease)",
          whiteSpace: "nowrap",
          textAlign: "center",
        };

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={typeof option.label === "string" ? option.label : option.value}
            disabled={isDisabled}
            onClick={() => {
              if (!isDisabled && !isSelected) onChange(option.value);
            }}
            style={optionStyle}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
