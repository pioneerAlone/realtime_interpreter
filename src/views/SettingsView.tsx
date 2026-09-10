import React from "react";
import PageHead from "../components/PageHead";
import CollapsibleSection from "../components/CollapsibleSection";
import PresetList from "../components/PresetList";

/**
 * SettingsView — 设置 tab v0（T-G-03）
 *
 * Layout：
 *   ┌────────────────────────────────────┐
 *   │ PageHead (title + subtitle)         │
 *   ├────────────────────────────────────┤
 *   │ [▾ 设备预设]              ● 就绪     │ ← 默认展开
 *   │   preset-list (3 行 + 展开 body)    │
 *   │ [▸ 引擎凭证]   ● 已保存 2 分钟前    │ ← 折叠 · 骨架
 *   │ [▸ 悬浮字幕]             6 项能力     │ ← 折叠 · 骨架
 *   │ [▸ 全局快捷键]                          │ ← 折叠 · 3 SettingRow stub
 *   │ [▸ 系统]                                │ ← 折叠 · 3 SettingRow stub
 *   │ + stub sections list (5 项 disabled)   │
 *   └────────────────────────────────────┘
 *
 * 决策来源: `.scratch/gui-rebuild-v0.md` §4 (preset-first IA) + §10.1 T-G-03
 * Ticket:    #28 (T-G-03)
 */
export default function SettingsView(): React.ReactElement {
  return (
    <div className="rt-page rt-page-settings" data-component="settings-view">
      <PageHead
        title="设置"
        subtitle="配置音频输入输出与翻译方向，可以保存为预设一键启动"
      />

      <main className="rt-page-body">
        <div className="rt-settings-stack">
          {/* ============== Section 1 · 设备预设 ============== */}
          <CollapsibleSection
            title="设备预设"
            defaultExpanded
            status={
              <>
                <span className="rt-status-dot" data-tone="success" aria-hidden="true" />
                3 个 · 1 默认
              </>
            }
          >
            <PresetList />
          </CollapsibleSection>

          {/* ============== Section 2 · 引擎凭证 ============== */}
          <CollapsibleSection
            title="引擎凭证"
            status={
              <>
                <span className="rt-status-dot" data-tone="success" aria-hidden="true" />
                已保存 · 待测试
              </>
            }
          >
            <div className="rt-settings-stub-section-list">
              <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-13)" }}>
                API Key 输入 + Keychain 读写 + 「测试连接」按钮 + RTT 状态机
                详细 UI 由 <span className="rt-mono">T-G-06</span> 实装。
              </p>
            </div>
          </CollapsibleSection>

          {/* ============== Section 3 · 悬浮字幕 ============== */}
          <CollapsibleSection
            title="悬浮字幕"
            status={<span style={{ color: "var(--fg-muted)" }}>6 项能力</span>}
          >
            <div className="rt-settings-stub-section-list">
              <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-13)" }}>
                形态 / 锁定 / 透明度 / 点击穿透 / 屏幕共享隐身 / 多显示器
                详细 UI 由 <span className="rt-mono">T-G-07</span> 实装。
              </p>
            </div>
          </CollapsibleSection>

          {/* ============== Section 4 · 全局快捷键 ============== */}
          <CollapsibleSection title="全局快捷键">
            <div className="rt-settings-stub-section-list">
              <div className="rt-settings-stub-row">
                <span className="rt-settings-stub-row-label">启动翻译</span>
                <span className="rt-settings-stub-row-keys">
                  <span className="rt-kbd">⌘</span>
                  <span className="rt-kbd">⇧</span>
                  <span className="rt-kbd">S</span>
                </span>
              </div>
              <div className="rt-settings-stub-row">
                <span className="rt-settings-stub-row-label">静音麦克风</span>
                <span className="rt-settings-stub-row-keys">
                  <span className="rt-kbd">⌘</span>
                  <span className="rt-kbd">⇧</span>
                  <span className="rt-kbd">M</span>
                </span>
              </div>
              <div className="rt-settings-stub-row">
                <span className="rt-settings-stub-row-label">字幕显隐</span>
                <span className="rt-settings-stub-row-keys">
                  <span className="rt-kbd">⌘</span>
                  <span className="rt-kbd">⇧</span>
                  <span className="rt-kbd">H</span>
                </span>
              </div>
            </div>
          </CollapsibleSection>

          {/* ============== Section 5 · 系统 ============== */}
          <CollapsibleSection title="系统">
            <div className="rt-settings-stub-section-list">
              <div className="rt-settings-stub-row">
                <span className="rt-settings-stub-row-label">语言</span>
                <span style={{ color: "var(--fg-muted)" }}>简体中文</span>
              </div>
              <div className="rt-settings-stub-row">
                <span className="rt-settings-stub-row-label">版本</span>
                <span className="rt-mono" style={{ color: "var(--fg-muted)" }}>
                  v0
                </span>
              </div>
              <div className="rt-settings-stub-row">
                <span className="rt-settings-stub-row-label">开源声明</span>
                <span style={{ color: "var(--fg-muted)" }}>Apache-2.0</span>
              </div>
            </div>
          </CollapsibleSection>

          {/* ============== Stub sections (nav 留位 · disabled) ============== */}
          <div
            style={{
              marginTop: "var(--space-6)",
              padding: "var(--space-4)",
              background: "var(--neutral-3)",
              borderRadius: "var(--radius-3)",
            }}
          >
            <span className="rt-eyebrow" style={{ display: "block", marginBottom: "var(--space-2)" }}>
              v0 不实装 · v1 接入
            </span>
            <div className="rt-settings-stub-section-list">
              {[
                "会议记录",
                "AI 纪要",
                "术语词典",
                "录制会议音频",
                "字幕形态 banner",
              ].map((name) => (
                <div
                  key={name}
                  className="rt-settings-stub-section-item"
                  style={{ opacity: 0.55 }}
                >
                  <span className="rt-settings-stub-row-label">{name}</span>
                  <span style={{ color: "var(--fg-muted)" }}>即将推出</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
