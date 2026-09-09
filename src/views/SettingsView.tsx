import React from "react";
import PageHead from "../components/PageHead";

/**
 * SettingsView — 设置 tab 占位（待 T-G-03 重写 preset-first IA）
 *
 * 当前任务（T-G-02）：验证 PageHead + 占位 section 折叠。
 * 完整 preset-first IA + 5 sections（设备预设 / 引擎凭证 / 悬浮字幕 / 全局快捷键 / 系统）
 * 由 T-G-03 落地。
 *
 * 决策来源: `.scratch/gui-rebuild-v0.md` §4 设置 tab · preset-first IA
 * Ticket:    #27 (T-G-02) · 完整实装 T-G-03
 */
export default function SettingsView(): React.ReactElement {
  return (
    <div className="rt-page rt-page-settings" data-component="settings-view">
      <PageHead
        title="设置"
        subtitle="配置音频输入输出与翻译方向，可以保存为预设一键启动"
      />

      <main className="rt-page-body">
        <div className="rt-callout">
          <strong>当前是 T-G-02 占位视图</strong>
          <br />
          完整 preset-first IA（设备预设 / 引擎凭证 / 悬浮字幕 / 全局快捷键 / 系统）由{" "}
          <span className="rt-mono">T-G-03</span> 落地。
        </div>

        <section className="rt-section">
          <div className="rt-section-head">
            <span className="rt-eyebrow">将实装</span>
            <span className="rt-section-title">5 个 section（折叠 · preset-first IA）</span>
          </div>
          <div className="rt-card-grid">
            {[
              { num: 1, name: "设备预设", note: "v0 主交互 · 默认展开" },
              { num: 2, name: "引擎凭证", note: "API Key + Keychain + 状态机" },
              { num: 3, name: "悬浮字幕", note: "形态 · 锁定 · 透明度 · 点击穿透 · 屏幕共享隐身 · 多显示器" },
              { num: 4, name: "全局快捷键", note: "⌘⇧S · ⌘⇧M · ⌘⇧H" },
              { num: 5, name: "系统", note: "语言 · 版本 · 开源声明" },
            ].map((s) => (
              <div key={s.num} className="rt-stat" data-component="settings-stub-section">
                <span className="rt-eyebrow rt-stat-label">{`section ${s.num}`}</span>
                <span className="rt-stat-value">{s.name}</span>
                <span className="rt-stat-muted">{s.note}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rt-section">
          <div className="rt-section-head">
            <span className="rt-eyebrow">stub items</span>
            <span className="rt-section-title">nav 留位 · disabled「即将推出」</span>
          </div>
          <p className="rt-section-note">
            会议记录 · AI 纪要 · 术语词典 · 录制会议音频 · 字幕形态 banner
            <br />
            <span className="rt-muted">
              v0 不实装，nav 留位 disabled，v1 再接入（per Q1 Hybrid 决策）
            </span>
          </p>
        </section>
      </main>
    </div>
  );
}
