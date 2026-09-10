import React from "react";
import ProgressPie from "../ui/ProgressPie";
import WireHint from "../ui/WireHint";
import PresetRow from "../ui/PresetRow";

/**
 * AtomsDemo — design system v2 视觉验证页
 *
 * 路由:  /?demo=atoms
 * 用途:  浏览器 + Tauri 实测渲染三个新 primitives + token swatches，
 *        作为 T-G-01 完成验证（per design freeze §10.2 verify 节奏）。
 *
 * 决策来源: `.scratch/gui-rebuild-v0.md` §1 (Q1-Q30) + §9 (de-jargon)
 * Ticket:    #26 (T-G-01)
 */
export default function AtomsDemo(): React.ReactElement {
  return (
    <div className="rt-demo-page" data-component="atoms-demo">
      <h1>Atoms · v0 design system</h1>
      <p className="rt-demo-intro">
        design system v2 · Reference 调色板 + SF Pro + Things 3 spacing.
        切换系统主题（light / dark）看 token 自动反转。
      </p>

      {/* ============================ ProgressPie ============================ */}
      <section>
        <h2>
          ProgressPie
          <small>Things 3 风格 · conic-gradient · SVG-less</small>
        </h2>
        <div className="rt-demo-row">
          <span className="rt-demo-label">0%</span>
          <ProgressPie value={0} />
          <span className="rt-demo-label">25%</span>
          <ProgressPie value={25} />
          <span className="rt-demo-label">50%</span>
          <ProgressPie value={50} />
          <span className="rt-demo-label">75%</span>
          <ProgressPie value={75} />
          <span className="rt-demo-label">100%</span>
          <ProgressPie value={100} />
        </div>
        <div className="rt-demo-row" style={{ marginTop: "var(--space-2)" }}>
          <span className="rt-demo-label">tones</span>
          <ProgressPie value={80} tone="accent" />
          <ProgressPie value={80} tone="success" />
          <ProgressPie value={80} tone="warn" />
          <ProgressPie value={80} tone="error" />
          <span className="rt-demo-label">size</span>
          <ProgressPie value={60} size={14} />
          <ProgressPie value={60} size={18} />
          <ProgressPie value={60} size={24} />
          <ProgressPie value={60} size={32} />
        </div>
      </section>

      {/* ============================ WireHint =============================== */}
      <section>
        <h2>
          WireHint
          <small>Loopback 风格 · 细线 + 箭头 · visualise input→output</small>
        </h2>
        <div className="rt-demo-stack">
          <div style={{ position: "relative" }}>
            <div
              style={{
                padding: "var(--space-2) var(--space-4)",
                background: "var(--surface-3)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-2)",
                fontFamily: "var(--font-text)",
                fontSize: "var(--fs-13)",
              }}
            >
              [麦克风输入 picker]
            </div>
            <WireHint icon="↓">对端耳机听见 · R3 上行</WireHint>
          </div>
          <div style={{ position: "relative" }}>
            <div
              style={{
                padding: "var(--space-2) var(--space-4)",
                background: "var(--surface-3)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-2)",
                fontFamily: "var(--font-text)",
                fontSize: "var(--fs-13)",
              }}
            >
              [翻译输出 picker]
            </div>
            <WireHint icon="↓">Teams 麦克风 绑定这里</WireHint>
          </div>
          <div style={{ position: "relative" }}>
            <div
              style={{
                padding: "var(--space-2) var(--space-4)",
                background: "var(--surface-3)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-2)",
                fontFamily: "var(--font-text)",
                fontSize: "var(--fs-13)",
              }}
            >
              [对端监听 picker]
            </div>
            <WireHint icon="↻">R4 直通 · 0 延迟听原声</WireHint>
          </div>
        </div>
      </section>

      {/* ============================ PresetRow ============================== */}
      <section>
        <h2>
          PresetRow
          <small>Things 3 风格 · rectangular · 8px 圆角</small>
        </h2>
        <div className="rt-demo-stack">
          <PresetRow
            name="日常会议"
            progress={100}
            active
            onToggle={(next) => console.log("日常会议 toggle →", next)}
          />
          <PresetRow
            name="演示模式"
            badge="即将推出"
            progress={25}
            disabled
          />
          <PresetRow name="1v1 沟通" badge="即将推出" progress={0} disabled />
          <PresetRow
            name="自定义"
            progress={50}
            onClick={() => console.log("自定义 click")}
          />
        </div>
      </section>

      {/* ============================ tokens · accent ======================== */}
      <section>
        <h2>
          tokens · accent
          <small>Reference 调色板 · system blue</small>
        </h2>
        <div className="rt-token-grid">
          <TokenSwatch
            name="--accent"
            value="#2571E8"
            bg="var(--accent)"
            fg="var(--accent-fg)"
          />
          <TokenSwatch
            name="--accent-tint"
            value="rgba(37,113,232,0.08)"
            bg="var(--accent-tint)"
            fg="var(--fg)"
          />
          <TokenSwatch
            name="--accent-soft"
            value="#dbe8fa"
            bg="var(--accent-soft)"
            fg="var(--fg)"
          />
        </div>
      </section>

      {/* ============================ tokens · neutral ====================== */}
      <section>
        <h2>
          tokens · neutral 9
          <small>light mode baseline · dark 自动反转</small>
        </h2>
        <div className="rt-token-grid">
          {NEUTRALS.map((n) => (
            <TokenSwatch
              key={n.token}
              name={n.token}
              value={n.light}
              bg={`var(${n.token})`}
              fg={n.token === "--neutral-9" || n.token === "--neutral-8" ? "#fff" : "var(--fg)"}
            />
          ))}
        </div>
      </section>

      {/* ============================ tokens · semantic ===================== */}
      <section>
        <h2>
          tokens · semantic
          <small>success / warn / error / info</small>
        </h2>
        <div className="rt-token-grid">
          <TokenSwatch
            name="--success"
            value="#30d158"
            bg="var(--success)"
            fg="#fff"
          />
          <TokenSwatch
            name="--warn"
            value="#ff9f0a"
            bg="var(--warn)"
            fg="#fff"
          />
          <TokenSwatch
            name="--error"
            value="#ff453a"
            bg="var(--error)"
            fg="#fff"
          />
          <TokenSwatch
            name="--info"
            value="= --accent"
            bg="var(--info)"
            fg="#fff"
          />
        </div>
      </section>

      {/* ============================ tokens · surface ====================== */}
      <section>
        <h2>
          tokens · surface
          <small>window / sidebar / card / capsule</small>
        </h2>
        <div className="rt-token-grid">
          <TokenSwatch
            name="--surface-1"
            value="window bg"
            bg="var(--surface-1)"
            fg="var(--fg)"
          />
          <TokenSwatch
            name="--surface-2"
            value="sidebar bg"
            bg="var(--surface-2)"
            fg="var(--fg)"
          />
          <TokenSwatch
            name="--surface-3"
            value="card bg"
            bg="var(--surface-3)"
            fg="var(--fg)"
          />
          <TokenSwatch
            name="--surface-capsule"
            value="rgba(29,29,31,0.82)"
            bg="var(--surface-capsule)"
            fg="var(--fg-on-capsule)"
          />
        </div>
      </section>

      {/* ============================ tokens · radius ======================= */}
      <section>
        <h2>
          tokens · radius
          <small>Things 3 主导 6-8px · 不大于 12</small>
        </h2>
        <div className="rt-token-grid">
          {RADII.map((r) => (
            <div className="rt-token-swatch" key={r.token}>
              <div
                className="rt-token-chip"
                style={{
                  borderRadius: `var(${r.token})`,
                  background: "var(--accent-tint)",
                  border: "1px solid var(--accent)",
                }}
              />
              <span className="rt-token-name">{r.token}</span>
              <span className="rt-token-value">{r.value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ============================ tokens · spacing ====================== */}
      <section>
        <h2>
          tokens · spacing
          <small>4 / 8 / 12 / 16 / 20 / 24 / 32</small>
        </h2>
        <div className="rt-token-stack">
          {SPACINGS.map((s) => (
            <div
              key={s.token}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--fs-12)",
                color: "var(--fg-muted)",
              }}
            >
              <span style={{ width: 96 }}>{s.token}</span>
              <span style={{ width: 36 }}>{s.value}</span>
              <span
                style={{
                  width: `var(${s.token})`,
                  height: 12,
                  background: "var(--accent)",
                  borderRadius: "var(--radius-1)",
                }}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* helpers                                                              */
/* ------------------------------------------------------------------ */

interface TokenSwatchProps {
  name: string;
  value: string;
  bg: string;
  fg?: string;
}

function TokenSwatch({ name, value, bg, fg }: TokenSwatchProps): React.ReactElement {
  return (
    <div className="rt-token-swatch">
      <div
        className="rt-token-chip"
        style={{
          background: bg,
          color: fg ?? "var(--fg)",
          display: "flex",
          alignItems: "flex-end",
          padding: "var(--space-1) var(--space-2)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            opacity: 0.8,
          }}
        >
          {name.replace("--", "")}
        </span>
      </div>
      <span className="rt-token-name">{name}</span>
      <span className="rt-token-value">{value}</span>
    </div>
  );
}

const NEUTRALS: ReadonlyArray<{
  token: string;
  light: string;
}> = [
  { token: "--neutral-1", light: "#ffffff" },
  { token: "--neutral-2", light: "#fafafa" },
  { token: "--neutral-3", light: "#f5f5f7" },
  { token: "--neutral-4", light: "#ececef" },
  { token: "--neutral-5", light: "#d2d2d7" },
  { token: "--neutral-6", light: "#aeaeb2" },
  { token: "--neutral-7", light: "#8e8e93" },
  { token: "--neutral-8", light: "#48484a" },
  { token: "--neutral-9", light: "#1d1d1f" },
] as const;

const RADII: ReadonlyArray<{ token: string; value: string }> = [
  { token: "--radius-1", value: "4px" },
  { token: "--radius-2", value: "6px" },
  { token: "--radius-3", value: "8px" },
  { token: "--radius-4", value: "12px" },
  { token: "--radius-pill", value: "9999px" },
] as const;

const SPACINGS: ReadonlyArray<{ token: string; value: string }> = [
  { token: "--space-1", value: "4px" },
  { token: "--space-2", value: "8px" },
  { token: "--space-3", value: "12px" },
  { token: "--space-4", value: "16px" },
  { token: "--space-5", value: "20px" },
  { token: "--space-6", value: "24px" },
  { token: "--space-7", value: "32px" },
] as const;
