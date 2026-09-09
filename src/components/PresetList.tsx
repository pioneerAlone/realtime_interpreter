import React, { useState } from "react";
import PresetRow from "./ui/PresetRow";
import PickerRow from "./PickerRow";
import { usePresetStore, type Preset } from "../store/presets";

/**
 * PresetList — 设置 tab v0 主交互（T-G-03）
 *
 * Layout:
 *   - 顶部 preset 列表（3 行：日常会议 active / 演示模式 stub / 1v1 沟通 stub）
 *   - 选中 preset 展开下方 2-col preset body
 *     - 左：4 picker rows（麦克风输入 / 翻译输出 / 对方声音输入 / 对端监听）+ R3 方向 + R4 字幕
 *     - 右：状态 + 上次启动 + 简介 + 操作（复制 / 删除 stub）
 *   - preset body 底部：[取消] [✓ 保存修改]
 *   - preset list 底部：+ 新建预设（stub）
 *
 * 决策来源: `.scratch/gui-rebuild-v0.md` §4 (preset-first IA) + §10.1 T-G-03
 * Ticket:    #28 (T-G-03)
 */
export default function PresetList(): React.ReactElement {
  const presets = usePresetStore((s) => s.presets);
  const activeId = usePresetStore((s) => s.activeId);
  const setActive = usePresetStore((s) => s.setActive);
  const [expandedId, setExpandedId] = useState<string | null>(activeId);

  const handleRowClick = (p: Preset): void => {
    if (p.status === "disabled-stub") return;
    setActive(p.id);
    setExpandedId((prev) => (prev === p.id ? null : p.id));
  };

  const handleToggle = (p: Preset) => (next: boolean): void => {
    if (p.status === "disabled-stub") return;
    setActive(next ? p.id : "");
  };

  return (
    <div className="rt-preset-list" data-component="preset-list">
      <div className="rt-preset-list-rows">
        {presets.map((p) => (
          <PresetRow
            key={p.id}
            name={p.name}
            badge={p.status === "disabled-stub" ? "即将推出" : undefined}
            progress={p.progress}
            active={activeId === p.id}
            disabled={p.status === "disabled-stub"}
            expanded={expandedId === p.id}
            onClick={() => handleRowClick(p)}
            onToggle={handleToggle(p)}
          />
        ))}
      </div>

      <button
        type="button"
        className="rt-preset-new"
        onClick={() => console.log("[stub] + 新建预设")}
        title="新建预设（即将推出）"
      >
        + 新建预设
      </button>

      {expandedId && <PresetBody presetId={expandedId} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PresetBody — 2-col grid（展开后显示）                                  */
/* ------------------------------------------------------------------ */

function PresetBody({ presetId }: { presetId: string }): React.ReactElement {
  const preset = usePresetStore((s) =>
    s.presets.find((p) => p.id === presetId),
  );
  const [draft, setDraft] = useState<Preset["devices"] | null>(
    preset?.devices ?? null,
  );

  if (!preset || !draft) {
    return <div className="rt-preset-body rt-preset-body-empty">未选中 preset</div>;
  }

  const handlePickerChange = (key: keyof Preset["devices"]) =>
    (next: string): void => {
      setDraft((prev) => (prev ? { ...prev, [key]: next } : prev));
    };

  const handleSave = (): void => {
    // TODO: 真实持久化属于 T-G-04
    console.log("[stub] save preset", presetId, draft);
  };

  const handleCancel = (): void => {
    setDraft(preset.devices);
  };

  return (
    <div className="rt-preset-body" data-component="preset-body">
      <div className="rt-preset-body-grid">
        {/* left col: 4 pickers + R3 direction + R4 caption */}
        <div className="rt-preset-body-left">
          <PickerRow
            picker="microphone"
            value={draft.microphone}
            onChange={handlePickerChange("microphone")}
          />
          <PickerRow
            picker="translationOutput"
            value={draft.translationOutput}
            onChange={handlePickerChange("translationOutput")}
          />
          <PickerRow
            picker="remoteInput"
            value={draft.remoteInput}
            onChange={handlePickerChange("remoteInput")}
          />
          <PickerRow
            picker="monitor"
            value={draft.monitor}
            onChange={handlePickerChange("monitor")}
            mockLevel={0}
          />

          <div className="rt-direction-block">
            <div className="rt-direction-row">
              <span className="rt-eyebrow">R3 方向</span>
              <span className="rt-direction-value">
                {preset.r3Direction === "zh→en" ? "中文 → 英文" : "英文 → 中文"}
              </span>
            </div>
            <div className="rt-direction-row">
              <span className="rt-eyebrow">R4 字幕</span>
              <span className="rt-direction-value">双语 stacked · 英文原文 + 中文</span>
            </div>
            <p className="rt-direction-note">
              v0 hardcode 双向 · 不可改
            </p>
          </div>
        </div>

        {/* right col: 状态 + 上次启动 + 简介 + 操作 */}
        <div className="rt-preset-body-right">
          <div className="rt-stat">
            <span className="rt-eyebrow rt-stat-label">状态</span>
            <span className="rt-stat-value">
              <span className="rt-status-dot" data-tone="success" aria-hidden="true" />
              就绪
            </span>
          </div>
          <div className="rt-stat">
            <span className="rt-eyebrow rt-stat-label">上次启动</span>
            <span className="rt-stat-value">
              {preset.lastLaunched} · {preset.launchCount} 次
            </span>
          </div>
          <div className="rt-stat">
            <span className="rt-eyebrow rt-stat-label">简介</span>
            <span className="rt-stat-value rt-stat-muted">{preset.description}</span>
          </div>
          <div className="rt-stat">
            <span className="rt-eyebrow rt-stat-label">操作</span>
            <div className="rt-preset-actions">
              <button
                type="button"
                className="rt-btn rt-btn-ghost"
                onClick={() => console.log("[stub] 复制为新预设", presetId)}
              >
                📋 复制为新预设
              </button>
              <button
                type="button"
                className="rt-btn rt-btn-ghost rt-btn-danger"
                onClick={() => console.log("[stub] 删除预设", presetId)}
              >
                🗑 删除预设
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rt-preset-body-footer">
        <button type="button" className="rt-btn rt-btn-ghost" onClick={handleCancel}>
          取消
        </button>
        <button type="button" className="rt-btn rt-btn-dark" onClick={handleSave}>
          ✓ 保存修改
        </button>
      </div>
    </div>
  );
}
