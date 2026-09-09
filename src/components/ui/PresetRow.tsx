import React from "react";
import ProgressPie from "./ProgressPie";

interface PresetRowProps {
  name: string;
  badge?: string;
  /** 0..100, default 0 (空环) */
  progress?: number;
  active?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  onClick?: () => void;
  onToggle?: (next: boolean) => void;
}

/**
 * Things 3 风格 rectangular preset row（8px 圆角，非圆角 card）。
 *
 * Layout: `[▸] [name    ] [badge] [progress-pie] [toggle]`
 * active   = subtle accent tint + 1px accent border
 * disabled = opacity 0.55 + 不可点击 + badge 变 warn
 *
 * 决策来源: `.scratch/gui-rebuild-v0.md` §4.2 (preset 行)
 * Ticket:    #26 (T-G-01) · 配合 T-G-03 (preset 列表)
 */
export default function PresetRow({
  name,
  badge,
  progress = 0,
  active = false,
  disabled = false,
  expanded = false,
  onClick,
  onToggle,
}: PresetRowProps): React.ReactElement {
  const handleClick = (): void => {
    if (disabled) return;
    onClick?.();
  };

  const handleToggle = (next: boolean): void => {
    if (disabled) return;
    onToggle?.(next);
  };

  return (
    <div
      className="rt-preset-row"
      data-component="preset-row"
      data-active={active}
      data-disabled={disabled}
      data-expanded={expanded}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={active}
      aria-disabled={disabled}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <span className="rt-preset-row-caret" aria-hidden="true">
        ▸
      </span>
      <span className="rt-preset-row-name">{name}</span>
      {badge && <span className="rt-preset-row-badge">{badge}</span>}
      <ProgressPie
        value={progress}
        tone={disabled ? undefined : active ? "success" : "accent"}
      />
      <Toggle on={active} disabled={disabled} onChange={handleToggle} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Toggle                                                              */
/* ------------------------------------------------------------------ */

interface ToggleProps {
  on: boolean;
  disabled?: boolean;
  onChange?: (next: boolean) => void;
}

function Toggle({ on, disabled, onChange }: ToggleProps): React.ReactElement {
  return (
    <button
      type="button"
      className="rt-toggle"
      data-on={on}
      data-disabled={disabled}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (disabled) return;
        onChange?.(!on);
      }}
      aria-pressed={on}
      aria-label={on ? "已激活" : "未激活"}
    >
      <span className="rt-toggle-knob" />
    </button>
  );
}
