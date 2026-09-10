import React from "react";
import { useCaptionStore } from "../store/caption";

/**
 * CaptionCapsuleControls — 设置 → 悬浮字幕 section 的 6 项能力 toggle（T-G-07）
 *
 * 6 项能力（per design freeze §6.2）：
 *   1. 拖动调位置（v0 自动 · caption 自带 data-tauri-drag-region）
 *   2. 锁定位置 / 解锁位置（v0 mock · v0.1 绑 NSPanel）
 *   3. 点击穿透（v0 mock · v0.1 绑 setIgnoresMouseEvents）
 *   4. 屏幕共享隐身（v0 mock · v0.1 绑 setSharingNone）
 *   5. 透明度 slider（0-100% · 完整实装 · CSS --caption-opacity）
 *   6. 多显示器选择（v0 默认主显示器 · v0.5 增强）
 *
 * 决策来源: `.scratch/gui-rebuild-v0.md` §6.2
 * Ticket:    #33 (T-G-07)
 */
export default function CaptionCapsuleControls(): React.ReactElement {
  const settings = useCaptionStore((s) => s.settings);
  const loadSettings = useCaptionStore((s) => s.loadSettings);
  const setOpacity = useCaptionStore((s) => s.setOpacity);
  const setLocked = useCaptionStore((s) => s.setLocked);
  const setClickThrough = useCaptionStore((s) => s.setClickThrough);
  const setShareHidden = useCaptionStore((s) => s.setShareHidden);
  const setDisplayIndex = useCaptionStore((s) => s.setDisplayIndex);

  React.useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  return (
    <div className="rt-caption-controls" data-component="caption-controls">
      {/* 5. 透明度 slider */}
      <div className="rt-caption-control-row">
        <label className="rt-caption-control-label" htmlFor="caption-opacity">
          透明度
        </label>
        <div className="rt-caption-control-slider-wrap">
          <input
            id="caption-opacity"
            type="range"
            min={20}
            max={100}
            step={5}
            value={settings.opacity}
            onChange={(e) => void setOpacity(Number(e.target.value))}
            className="rt-caption-control-slider"
            aria-valuemin={20}
            aria-valuemax={100}
            aria-valuenow={settings.opacity}
            aria-label="透明度"
          />
          <span className="rt-caption-control-value">{settings.opacity}%</span>
        </div>
      </div>

      <div className="rt-caption-control-divider" />

      {/* 2. 锁定位置 */}
      <ToggleRow
        label="锁定位置"
        description="开启后无法拖动字幕窗"
        value={settings.locked}
        onChange={(v) => void setLocked(v)}
      />

      <div className="rt-caption-control-divider" />

      {/* 3. 点击穿透 */}
      <ToggleRow
        label="点击穿透"
        description="鼠标点击穿透字幕窗到下层"
        value={settings.clickThrough}
        onChange={(v) => void setClickThrough(v)}
      />

      <div className="rt-caption-control-divider" />

      {/* 4. 屏幕共享隐身 */}
      <ToggleRow
        label="屏幕共享隐身"
        description="视频会议共享时不显示字幕"
        value={settings.shareHidden}
        onChange={(v) => void setShareHidden(v)}
      />

      <div className="rt-caption-control-divider" />

      {/* 6. 多显示器选择（v0 stub）*/}
      <div className="rt-caption-control-row">
        <label className="rt-caption-control-label" htmlFor="caption-display">
          多显示器
        </label>
        <select
          id="caption-display"
          className="rt-caption-control-select"
          value={settings.displayIndex}
          onChange={(e) => void setDisplayIndex(Number(e.target.value))}
          disabled
        >
          <option value={0}>主显示器（默认）</option>
          <option value={1}>外接显示器 1（v0.5 启用）</option>
        </select>
      </div>

      <p className="rt-caption-control-hint">
        拖动调位置：v0 由 webview 原生支持 · v0.1 绑 NSPanel setMovableByWindowBackground
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ToggleRow 内部 helper                                                */
/* ------------------------------------------------------------------ */

interface ToggleRowProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}

function ToggleRow({ label, description, value, onChange }: ToggleRowProps): React.ReactElement {
  return (
    <div className="rt-caption-control-row">
      <div className="rt-caption-control-text">
        <span className="rt-caption-control-label">{label}</span>
        {description && (
          <span className="rt-caption-control-desc">{description}</span>
        )}
      </div>
      <button
        type="button"
        className="rt-caption-control-toggle"
        data-on={value}
        onClick={() => onChange(!value)}
        aria-pressed={value}
        aria-label={label}
      >
        <span className="rt-caption-control-toggle-knob" />
      </button>
    </div>
  );
}
