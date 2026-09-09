import React, { useEffect, useState } from "react";
import { ping, version } from "../lib/ipc";
import { useSessionStore } from "../store/session";
import { APP_ICON_DATA_URL } from "../assets/icon";

type PingResult = { status: "ok" | "err"; text: string };

/**
 * MainView — v0 placeholder scaffold (待 T-G-02..T-G-05 重写)
 *
 * 当前任务（T-G-01）：
 *   - 验证 design system v2 tokens 在真实 app 上下文渲染正常
 *   - 应用 de-jargon 规则（Q6）：所有面向用户文本产品语言
 *
 * 决策来源: `.scratch/gui-rebuild-v0.md` §1 Q1-Q30 + §9 de-jargon 映射表
 * Ticket:    #26 (T-G-01)
 */
export default function MainView(): React.ReactElement {
  const r3 = useSessionStore((s) => s.r3);
  const r4 = useSessionStore((s) => s.r4);
  const [pingRes, setPingRes] = useState<PingResult>({ status: "err", text: "…" });
  const [ver, setVer] = useState<string>("…");

  useEffect(() => {
    ping()
      .then((p) => setPingRes({ status: "ok", text: p }))
      .catch((e: unknown) => setPingRes({ status: "err", text: String(e) }));
    version()
      .then((v) => setVer(v.version))
      .catch((e: unknown) => setVer(`error: ${String(e)}`));
  }, []);

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--surface-1)",
        color: "var(--fg)",
        fontFamily: "var(--font-text)",
      }}
    >
      <header
        className="rt-drag-region"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          padding: "var(--space-3) var(--space-5)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <img
          src={APP_ICON_DATA_URL}
          alt="realtime_interpreter"
          style={{ width: 20, height: 20, borderRadius: "var(--radius-1)" }}
        />
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-13)",
            fontWeight: 600,
            letterSpacing: "var(--tracking-tight)",
          }}
        >
          realtime_interpreter
        </div>
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontSize: "var(--fs-11)",
            color: "var(--fg-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          v0 · design system v2
        </span>
      </header>

      <main
        style={{
          flex: 1,
          overflow: "auto",
          padding: "var(--space-5) var(--space-6)",
        }}
      >
        <Section title="引擎状态" eyebrow="连接">
          <CardGrid>
            <Stat
              label="连接"
              value={
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <StatusDot tone={pingRes.status === "ok" ? "success" : "error"} />
                  {pingRes.text}
                </span>
              }
            />
            <Stat label="版本" value={ver} />
            <Stat label="界面" value="v0" />
          </CardGrid>
        </Section>

        <Section title="通道" eyebrow="运行时">
          <CardGrid>
            <Stat
              label="麦克风上行"
              value={
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <StatusDot tone={r3 === "running" ? "success" : "idle"} />
                  {statusLabel(r3)}
                </span>
              }
            />
            <Stat
              label="对方声音通道"
              value={
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <StatusDot tone={r4 === "running" ? "success" : "idle"} />
                  {statusLabel(r4)}
                </span>
              }
            />
          </CardGrid>
          <p
            style={{
              fontSize: "var(--fs-11)",
              color: "var(--fg-muted)",
              marginTop: "var(--space-3)",
            }}
          >
            通道实装见 <Kbd>#03</Kbd>（麦克风上行）和 <Kbd>#04</Kbd>（对方声音通道）
          </p>
        </Section>

        <Section title="快捷键" eyebrow="全局">
          <CardGrid>
            <Stat
              label="显示/隐藏字幕"
              value={
                <span>
                  <Kbd>⌃</Kbd> <Kbd>⌥</Kbd> <Kbd>H</Kbd>
                </span>
              }
            />
            <Stat
              label="对端监听切换"
              value={
                <span>
                  <Kbd>⌃</Kbd> <Kbd>⌥</Kbd> <Kbd>P</Kbd>
                </span>
              }
            />
          </CardGrid>
          <p
            style={{
              fontSize: "var(--fs-11)",
              color: "var(--fg-muted)",
              marginTop: "var(--space-3)",
            }}
          >
            首次启动时 macOS 会提示授予辅助功能权限
          </p>
        </Section>

        <p
          style={{
            marginTop: "var(--space-6)",
            padding: "var(--space-4)",
            borderRadius: "var(--radius-3)",
            background: "var(--accent-tint)",
            border: "1px solid var(--accent)",
            color: "var(--fg)",
            fontSize: "var(--fs-13)",
          }}
        >
          <strong>T-G-01 占位视图</strong> · 完整 UI 由 T-G-02 主窗骨架 + T-G-03 设置 + T-G-05 实时翻译 dashboard 重写。
          当前页仅验证 design system v2 tokens 渲染。
        </p>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* helpers                                                              */
/* ------------------------------------------------------------------ */

function statusLabel(s: string): string {
  if (s === "running") return "运行中";
  if (s === "error") return "异常";
  return "未启动";
}

function Section({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section style={{ marginBottom: "var(--space-5)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "var(--space-2)",
          marginBottom: "var(--space-3)",
        }}
      >
        <span className="rt-eyebrow">{eyebrow ?? title}</span>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-15)",
            fontWeight: 600,
            color: "var(--fg)",
          }}
        >
          {title}
        </span>
      </div>
      {children}
    </section>
  );
}

function CardGrid({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div
      style={{
        background: "var(--surface-3)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-3)",
        padding: "var(--space-4) var(--space-5)",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "var(--space-4)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}): React.ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      <span className="rt-eyebrow">{label}</span>
      <span
        style={{
          fontSize: "var(--fs-14)",
          fontWeight: 500,
          color: "var(--fg)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function StatusDot({ tone }: { tone: "success" | "error" | "idle" }): React.ReactElement {
  const color =
    tone === "success" ? "var(--success)" : tone === "error" ? "var(--error)" : "var(--neutral-5)";
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        boxShadow: tone === "success" ? "0 0 8px var(--success-soft)" : undefined,
      }}
    />
  );
}

function Kbd({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: "var(--font-mono)",
        fontSize: "var(--fs-11)",
        padding: "1px 6px",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-1)",
        background: "var(--surface-1)",
        color: "var(--fg-muted)",
        marginRight: 2,
      }}
    >
      {children}
    </span>
  );
}
