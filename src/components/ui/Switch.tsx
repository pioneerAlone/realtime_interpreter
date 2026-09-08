/**
 * Switch — toggle switch（iOS / macOS 风格，36×20 outer + 16×16 knob）。
 * ----------------------------------------------------------------------
 * 从 Open-Less `src/pages/settings/shared.tsx:119-160` 的 `Toggle` 移植
 * （**不是** `SwitchLite.tsx` — 那个是 uncontrolled 无 onChange 无 a11y）。
 *
 * 设计要点：
 * - 受控组件：`on` + `onChange(next: boolean)` — 父组件持有 state
 * - 可访问性：`role="switch"` + `aria-checked` + `aria-label` + `aria-disabled`
 * - 过渡：`background 160ms quick`（开/关背景） + `left 220ms spring`（滑块）
 *   — 滑块用 spring 曲线，关闭态有自然减速
 * - 关闭态不写死颜色：用 `--control-off` / `--accent` 跟随主题
 * - hover 关闭态：背景从 `--control-off` 升到 `--control-off-strong`
 *
 * 使用：
 *   const [on, setOn] = useState(false);
 *   <Switch on={on} onChange={setOn} ariaLabel="启用双向翻译" />
 */

import { type CSSProperties, type KeyboardEvent } from "react";

export interface SwitchProps {
  /** 受控：当前是否打开 */
  on: boolean;
  /** 受控：状态变化回调；不传则按钮 disable（变成纯展示） */
  onChange?: (next: boolean) => void;
  /** a11y — 必传（屏幕阅读器 + Tab focus hint） */
  ariaLabel: string;
  /** a11y — 描述子控件关系（Open-Less `shared.tsx:90-99` 模式） */
  ariaDescribedBy?: string;
  disabled?: boolean;
  /** 加载中态：禁用交互 + 视觉上变灰 */
  loading?: boolean;
  id?: string;
}

const SWITCH_WIDTH = 36;
const SWITCH_HEIGHT = 20;
const KNOB_SIZE = 16;
const KNOB_OFFSET = 2;

export function Switch({
  on,
  onChange,
  ariaLabel,
  ariaDescribedBy,
  disabled = false,
  loading = false,
  id,
}: SwitchProps) {
  const isDisabled = disabled || loading || !onChange;

  const handleClick = () => {
    if (isDisabled) return;
    onChange?.(!on);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      handleClick();
    }
  };

  const trackStyle: CSSProperties = {
    position: "relative",
    flex: `0 0 ${SWITCH_WIDTH}px`,
    width: SWITCH_WIDTH,
    minWidth: SWITCH_WIDTH,
    maxWidth: SWITCH_WIDTH,
    height: SWITCH_HEIGHT,
    borderRadius: 999,
    border: 0,
    background: on ? "var(--accent)" : "var(--control-off)",
    boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.06)",
    cursor: isDisabled ? "not-allowed" : "default",
    transition: "background var(--motion-quick) var(--motion-ease)",
    padding: 0,
    opacity: loading ? 0.7 : 1,
  };

  const knobStyle: CSSProperties = {
    position: "absolute",
    top: KNOB_OFFSET,
    left: on ? SWITCH_WIDTH - KNOB_SIZE - KNOB_OFFSET : KNOB_OFFSET,
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: 999,
    background: "var(--control-knob)",
    boxShadow:
      "0 1px 2px rgba(0, 0, 0, 0.25), 0 0 0 0.5px rgba(0, 0, 0, 0.04)",
    transition: "left var(--motion-spring) var(--motion-spring-ease)",
    pointerEvents: "none",
  };

  return (
    <button
      type="button"
      id={id}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={isDisabled}
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-busy={loading || undefined}
      style={trackStyle}
    >
      <span style={knobStyle} />
    </button>
  );
}
