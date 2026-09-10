import React, { useEffect, useState } from "react";
import { ping, version } from "../lib/ipc";
import { useSessionStore } from "../store/session";
import PageHead from "../components/PageHead";

type PingResult = { status: "ok" | "err"; text: string };

/**
 * TranslateView — 实时翻译 dashboard 占位（待 T-G-05 重写）
 *
 * 当前任务（T-G-02）：验证 PageHead + 卡片布局 + 主区滚动。
 * 完整预检卡 5 项 + CTA bar idle/running 由 T-G-05 落地。
 *
 * 决策来源: `.scratch/gui-rebuild-v0.md` §5 实时翻译 tab
 * Ticket:    #27 (T-G-02) · 完整实装 T-G-05
 */
export default function TranslateView(): React.ReactElement {
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
    <div className="rt-page rt-page-translate" data-component="translate-view">
      <PageHead
        title="实时翻译"
        subtitle="选择一台设备或预设，启动后开始把对方的声音翻译成你能听懂的语言"
      />

      <main className="rt-page-body">
        <div className="rt-callout">
          <strong>当前是 T-G-02 占位视图</strong>
          <br />
          完整 dashboard（5 预检卡 + CTA bar idle/running）由{" "}
          <span className="rt-mono">T-G-05</span> 落地。
        </div>

        <Section title="连接状态" eyebrow="引擎">
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
        </Section>
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
    <section className="rt-section">
      <div className="rt-section-head">
        <span className="rt-eyebrow">{eyebrow ?? title}</span>
        <span className="rt-section-title">{title}</span>
      </div>
      {children}
    </section>
  );
}

function CardGrid({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div className="rt-card-grid">{children}</div>;
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="rt-stat">
      <span className="rt-eyebrow rt-stat-label">{label}</span>
      <span className="rt-stat-value">{value}</span>
    </div>
  );
}

function StatusDot({ tone }: { tone: "success" | "error" | "idle" }): React.ReactElement {
  const color =
    tone === "success"
      ? "var(--success)"
      : tone === "error"
        ? "var(--error)"
        : "var(--neutral-5)";
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
    <span className="rt-kbd">{children}</span>
  );
}
