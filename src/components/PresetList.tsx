import React, { useEffect, useState } from "react";
import PresetRow from "./ui/PresetRow";
import PickerRow from "./PickerRow";
import { usePresetStore, type Preset } from "../store/presets";
import { useSessionStore } from "../store/session";
import { startSession, stopSession } from "../lib/ipc";

/**
 * PresetList — 设置 tab v0 主交互（T-G-04 接入持久化 + 启动 CTA）
 *
 * T-G-03 → T-G-04 增量：
 *   - mount 时调 `usePresetStore.load()` 拉 preferences.json
 *   - preset row toggle 调 `setActiveSync`（sync 设 active + 后台持久化）
 *   - preset body 「✓ 保存修改」 调 `saveSync` 整对象写回
 *   - 新增「▶ 启动同传」/「■ 停止同传」CTA 调 start_session / stop_session IPC
 *   - active 状态显示根据 r3/r4 session state 联动（real-time）
 *
 * 决策来源: `.scratch/gui-rebuild-v0.md` §4 (preset-first IA) + §10.1 T-G-04
 * Ticket:    #30 (T-G-04)
 */
export default function PresetList(): React.ReactElement {
  const presets = usePresetStore((s) => s.presets);
  const activeId = usePresetStore((s) => s.activeId);
  const loaded = usePresetStore((s) => s.loaded);
  const load = usePresetStore((s) => s.load);
  const setActiveSync = usePresetStore((s) => s.setActiveSync);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loaded && activeId && expandedId === null) {
      setExpandedId(activeId);
    }
  }, [loaded, activeId, expandedId]);

  const handleRowClick = (p: Preset): void => {
    if (p.status === "disabled-stub") return;
    setActiveSync(p.id);
    setExpandedId((prev) => (prev === p.id ? null : p.id));
  };

  const handleToggle = (p: Preset) => (next: boolean): void => {
    if (p.status === "disabled-stub") return;
    setActiveSync(next ? p.id : "");
  };

  if (!loaded) {
    return (
      <div className="rt-preset-list" data-component="preset-list">
        <div
          style={{
            padding: "var(--space-4)",
            color: "var(--fg-muted)",
            fontSize: "var(--fs-13)",
          }}
        >
          正在加载 preset 配置…
        </div>
      </div>
    );
  }

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
  const saveSync = usePresetStore((s) => s.saveSync);
  const [draft, setDraft] = useState<Preset["devices"] | null>(
    preset?.devices ?? null,
  );

  useEffect(() => {
    if (preset) setDraft(preset.devices);
  }, [preset]);

  if (!preset || !draft) {
    return <div className="rt-preset-body rt-preset-body-empty">未选中 preset</div>;
  }

  const handlePickerChange = (key: keyof Preset["devices"]) =>
    (next: string): void => {
      setDraft((prev) => (prev ? { ...prev, [key]: next } : prev));
    };

  const handleSave = (): void => {
    const next: Preset = { ...preset, devices: draft };
    saveSync(next);
  };

  const handleCancel = (): void => {
    setDraft(preset.devices);
  };

  return (
    <div className="rt-preset-body" data-component="preset-body">
      <div className="rt-preset-body-grid">
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
            <p className="rt-direction-note">v0 hardcode 双向 · 不可改</p>
          </div>
        </div>

        <div className="rt-preset-body-right">
          <div className="rt-stat">
            <span className="rt-eyebrow rt-stat-label">状态</span>
            <span className="rt-stat-value">
              <EngineStatusIndicator />
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

/* ------------------------------------------------------------------ */
/* EngineStatusIndicator + Start/Stop CTA                              */
/* ------------------------------------------------------------------ */

function EngineStatusIndicator(): React.ReactElement {
  const r3 = useSessionStore((s) => s.r3);
  const r4 = useSessionStore((s) => s.r4);
  const setSessionState = useSessionStore((s) => s.setState);
  const isRunning = r3 === "running" || r4 === "running";
  const hasError = r3 === "error" || r4 === "error";
  const tone: "success" | "error" | "idle" = hasError
    ? "error"
    : isRunning
      ? "success"
      : "idle";
  const label = hasError ? "异常" : isRunning ? "运行中" : "就绪";
  const [pending, setPending] = useState(false);

  const handleStart = async (): Promise<void> => {
    if (pending) return;
    setPending(true);
    try {
      const [r3Res, r4Res] = await Promise.all([
        startSession("R3"),
        startSession("R4"),
      ]);
      setSessionState("R3", r3Res);
      setSessionState("R4", r4Res);
    } catch (e) {
      console.error("[engine] start failed:", e);
      setSessionState("R3", "error");
      setSessionState("R4", "error");
    } finally {
      setPending(false);
    }
  };

  const handleStop = async (): Promise<void> => {
    if (pending) return;
    setPending(true);
    try {
      const [r3Res, r4Res] = await Promise.all([
        stopSession("R3"),
        stopSession("R4"),
      ]);
      setSessionState("R3", r3Res);
      setSessionState("R4", r4Res);
    } catch (e) {
      console.error("[engine] stop failed:", e);
    } finally {
      setPending(false);
    }
  };

  return (
    <span
      style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span className="rt-status-dot" data-tone={tone} aria-hidden="true" />
        {label}
      </span>
      {!isRunning ? (
        <button
          type="button"
          className="rt-btn rt-btn-dark"
          style={{ padding: "var(--space-1) var(--space-3)", fontSize: "var(--fs-12)" }}
          onClick={handleStart}
          disabled={pending}
        >
          {pending ? "启动中…" : "▶ 启动同传"}
        </button>
      ) : (
        <button
          type="button"
          className="rt-btn rt-btn-ghost rt-btn-danger"
          style={{ padding: "var(--space-1) var(--space-3)", fontSize: "var(--fs-12)" }}
          onClick={handleStop}
          disabled={pending}
        >
          {pending ? "停止中…" : "■ 停止同传"}
        </button>
      )}
    </span>
  );
}
