/**
 * MainView — top-level shell for the main window.
 * ----------------------------------------------------------------------
 * T-G-4 ticket #22 — Halo 启发 2 列布局 + 黑色 CTA + SectionCard 化。
 *
 * 布局：
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ TopBar:  [logo] realtime_interpreter          [API key status]   │
 *   ├──────────┬───────────────────────────────────────────────────┤
 *   │ Sidebar  │  Main content                                       │
 *   │ 实时翻译 │  (one of:                                          │
 *   │ 通道详情 │    • 实时翻译 = 设备 + 字幕 preview + sticky CTA  │
 *   │ 快捷键   │    • 通道详情 = R3 / R4 卡片                       │
 *   │ 设置     │    • 快捷键   = 3 个 SettingRow                    │
 *   │          │    • 设置     = version / repo / license SettingRow │
 *   │ 场景模式 │                                                    │
 *   │ 配额     │                                                    │
 *   │ bakewell │                                                    │
 *   │ 退出     │                                                    │
 *   ├──────────┴───────────────────────────────────────────────────┤
 *   │ StatusBar: Topology ● | R3 ● idle | R4 ● idle | ⌥⌃⌥P⌃⌥H        │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * 与 D-G-1 撤销的 3 列布局对比（原 Sidebar 200 / Main 1fr / LiveStage 320）：
 *  - LiveStage 单列被砍（黑色 CTA + 状态行 + 字幕 preview 全部下沉到 Main 底部）
 *  - Sidebar 280 + Main flex-1（Main 占主，dominant work area）
 *  - 全部 4 个 section 卡片化（D-G-17 Halo 启发）
 */

import React, { useEffect, useState } from "react";
import { ping, version } from "@/lib/ipc";
import { useSessionStore } from "@/store/session";
import { useTopologyStore, resolveEffectivePrefs } from "@/store/topology";
import { APP_ICON_DATA_URL } from "@/assets/icon";
import { TopologyCheckPanel } from "@/components/TopologyCheckPanel";
import { ChannelCard } from "@/components/ChannelCard";
import { R3_INFO, R4_INFO } from "@/lib/channelInfo";
import { Sidebar, type NavItemId, type SceneRow } from "@/components/Sidebar";
import { StatusBar } from "@/components/StatusBar";
import { Tooltip } from "@/components/ui/Tooltip";
import { Card, Pill } from "@/components/ui/_atoms";
import { SettingRow } from "@/components/ui/SettingRow";
import { Btn } from "@/components/ui/_atoms";
import { Kbd, KbdGroup } from "@/components/ui/Kbd";
import { Switch } from "@/components/ui/Switch";

type PingResult = { status: "ok" | "err"; text: string };

const R3_INPUT_DEFAULT = "MacBook Air麦克风";
const R3_OUTPUT_DEFAULT = "BlackHole 2ch";
const R4_OUTPUT_DEFAULT = "MacBook Air扬声器";

/* 字幕 preview mock 数据（v0 不接 R3/R4 后端） */
const SAMPLE_SUBTITLES = [
  {
    id: "1",
    source: "Thanks for joining today, let's discuss the Q4 roadmap.",
    translation: "感谢今天加入，我们来讨论 Q4 路线图。",
    is_final: true,
  },
  {
    id: "2",
    source: "We need to ship the integration by end of month.",
    translation: "我们需要月底前发布集成。",
    is_final: true,
  },
  {
    id: "3",
    source: "Are there any blockers on the audio pipeline?",
    translation: "音频管线有没有任何阻碍？",
    is_final: false,
  },
];

export default function MainView(): React.ReactElement {
  const r3State = useSessionStore((s) => s.r3);
  const r4State = useSessionStore((s) => s.r4);
  const topologyPrefs = useTopologyStore((s) => s.prefs);
  const topologyStatus = useTopologyStore((s) => s.status);
  const effectivePrefs = resolveEffectivePrefs(topologyPrefs, topologyStatus?.devices ?? []);
  const [pingRes, setPingRes] = useState<PingResult>({ status: "err", text: "…" });
  const [ver, setVer] = useState<string>("0.0.1");

  /* 场景模式状态（v0 mock，会议默认开） */
  const [scenes, setScenes] = useState<SceneRow[]>([
    { id: "meeting", icon: "议", name: "会议模式", enabled: true },
    { id: "live", icon: "播", name: "直播模式", enabled: false },
    { id: "game", icon: "戏", name: "游戏模式", enabled: false },
  ]);

  useEffect(() => {
    ping()
      .then((p) => setPingRes({ status: "ok", text: p }))
      .catch((e: unknown) => setPingRes({ status: "err", text: String(e) }));
    version()
      .then((v) => setVer(v.version))
      .catch((e: unknown) => setVer(`error: ${String(e)}`));
  }, []);

  const [active, setActive] = useState<NavItemId>("main");

  const handleNav = (id: NavItemId) => {
    if (id === "quit") {
      import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
        void getCurrentWindow().close();
      });
      return;
    }
    setActive(id);
  };

  return (
    <div className="rt-shell rt-shell--2col">
      <TopBar pingRes={pingRes} version={ver} />

      <div className="rt-shell__body">
        <Sidebar
          active={active}
          onSelect={handleNav}
          version={ver}
          scenes={scenes}
          onSceneToggle={(id, enabled) =>
            setScenes((prev) =>
              prev.map((s) => (s.id === id ? { ...s, enabled } : s)),
            )
          }
        />

        <main className="rt-shell__main">
          {active === "main" && (
            <MainTranslateSection
              r3State={r3State}
              r4State={r4State}
              scenes={scenes}
              onSceneToggle={(id, enabled) =>
                setScenes((prev) =>
                  prev.map((s) => (s.id === id ? { ...s, enabled } : s)),
                )
              }
            />
          )}

          {active === "channels" && (
            <section className="rt-page" aria-labelledby="channels-heading">
              <header className="rt-page__header">
                <h1 id="channels-heading" className="rt-page__title">通道详情</h1>
                <p className="rt-page__desc">
                  两个并行通道：把中文翻译成英文输出给对方，把对方的英文翻译成字幕显示给你。鼠标悬停 ⓘ 看完整说明。
                </p>
              </header>
              <div className="rt-page__grid">
                <ChannelCard
                  kind="R3"
                  title={R3_INFO.title}
                  fullName={R3_INFO.title}
                  summary={R3_INFO.summary}
                  status={r3State}
                  srcLang={R3_INFO.srcLang}
                  tgtLang={R3_INFO.tgtLang}
                  inputDevice={effectivePrefs.mic_name ?? R3_INPUT_DEFAULT}
                  outputDevice={effectivePrefs.r3_out_vac_name ?? R3_OUTPUT_DEFAULT}
                  latencyTarget={R3_INFO.latencyTarget}
                  startupConditions={R3_INFO.startupConditions}
                  dependencies={R3_INFO.dependencies}
                  errorModes={R3_INFO.errorModes}
                  longDescription={R3_INFO.longDescription}
                />
                <ChannelCard
                  kind="R4"
                  title={R4_INFO.title}
                  fullName={R4_INFO.title}
                  summary={R4_INFO.summary}
                  status={r4State}
                  srcLang={R4_INFO.srcLang}
                  tgtLang={R4_INFO.tgtLang}
                  inputDevice={effectivePrefs.r4_in_vac_name ?? R4_OUTPUT_DEFAULT}
                  outputDevice={effectivePrefs.r4_out_device_name ?? R4_OUTPUT_DEFAULT}
                  latencyTarget={R4_INFO.latencyTarget}
                  startupConditions={R4_INFO.startupConditions}
                  dependencies={R4_INFO.dependencies}
                  errorModes={R4_INFO.errorModes}
                  longDescription={R4_INFO.longDescription}
                />
              </div>
            </section>
          )}

          {active === "hotkeys" && (
            <section className="rt-page" aria-labelledby="hotkeys-heading">
              <header className="rt-page__header">
                <h1 id="hotkeys-heading" className="rt-page__title">快捷键</h1>
                <p className="rt-page__desc">
                  全局快捷键需要在「系统设置 → 隐私与安全性 → 辅助功能」中授权。
                  首次启动会自动弹出授权窗口；如果被拒绝，需要手动在系统设置中重新勾选。
                </p>
              </header>
              <Card padding="md">
                <SettingRow
                  noDivider
                  label="Toggle subtitle"
                  desc="显示 / 隐藏字幕悬浮窗。飘窗不抢焦点。"
                >
                  <Kbd>Right Option</Kbd>
                </SettingRow>
                <SettingRow
                  label="原声直出 (Bypass)"
                  desc="关闭时英文原声 + 字幕同步上屏；开启时跳过字幕。"
                >
                  <KbdGroup keys={["⌃", "⌥", "P"]} />
                </SettingRow>
                <SettingRow
                  label="Hide subtitle"
                  desc="直接隐藏字幕窗（不切换）。"
                >
                  <KbdGroup keys={["⌃", "⌥", "H"]} />
                </SettingRow>
              </Card>
            </section>
          )}

          {active === "about" && (
            <section className="rt-page" aria-labelledby="about-heading">
              <header className="rt-page__header">
                <h1 id="about-heading" className="rt-page__title">设置</h1>
                <p className="rt-page__desc">
                  版本、仓库地址、协议信息。
                </p>
              </header>
              <Card padding="md">
                <SettingRow
                  noDivider
                  label="版本"
                  desc="当前安装的实时翻译版本号。"
                >
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{ver}</span>
                </SettingRow>
                <SettingRow
                  label="仓库"
                  desc="主仓库地址（公开，开源）。"
                >
                  <a href="https://github.com/pioneerAlone/realtime_interpreter" target="_blank" rel="noreferrer">
                    pioneerAlone/realtime_interpreter
                  </a>
                </SettingRow>
                <SettingRow
                  label="PoC 仓库"
                  desc="PoC 是基于 Doubao 同传 2.0 的 A-channel 可行性参考；License 边界 (AGPL-3.0 上游依赖) 不合并入本仓。"
                >
                  <a href="https://github.com/pioneerAlone/realtime_interpreter-poc" target="_blank" rel="noreferrer">
                    realtime_interpreter-poc
                  </a>
                </SettingRow>
                <SettingRow
                  label="License"
                  desc="app code MIT, vendored Doppelvoice .proto Apache-2.0"
                >
                  <Pill tone="accent">MIT</Pill>
                </SettingRow>
                <SettingRow
                  label="平台"
                  desc="v0 仅支持 macOS（M-series + Intel）。"
                >
                  <Pill tone="positive">macOS</Pill>
                </SettingRow>
              </Card>
            </section>
          )}
        </main>
      </div>

      <StatusBar onNavigate={handleNav} />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * MainTranslateSection — 实时翻译主面板
 *
 * 3 个 SectionCard（D-G-17 Halo 启发）：
 *   1. 设备检查（TopologyCheckPanel）
 *   2. 场景模式 + 快捷 SettingRow（侧栏底部已显示，本 section 重复展示
 *      是因为：a) 主区是默认 landing，要看到所有 mode；b) SettingRow
 *      卡片化方便切换 + 解释）
 *   3. 字幕 preview
 *
 * Sticky CTA: 通道状态 + 开始翻译按钮（D-G-16 黑色 CTA）— 横跨 main
 * 容器底部，不在 section 内部。
 * ------------------------------------------------------------------ */
interface MainTranslateSectionProps {
  r3State: string;
  r4State: string;
  scenes: SceneRow[];
  onSceneToggle: (id: SceneRow["id"], enabled: boolean) => void;
}

function MainTranslateSection({
  r3State,
  r4State,
  scenes,
  onSceneToggle,
}: MainTranslateSectionProps) {
  return (
    <section className="rt-page" aria-labelledby="main-heading">
      <header className="rt-page__header">
        <h1 id="main-heading" className="rt-page__title">实时翻译</h1>
        <p className="rt-page__desc">
          检查设备连接、选择场景模式、查看字幕预览。设置后会自动验证连接是否正确。
        </p>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* 设备检查 — SectionCard 化 */}
        <Card padding="md">
          <TopologyCheckPanel />
        </Card>

        {/* 场景模式 — SettingRow 卡片（D-G-17） */}
        <Card padding="md">
          <SettingRow
            noDivider
            label="会议模式"
            desc="v0 默认场景。开启双向翻译。"
          >
            <Switch
              on={scenes.find((s) => s.id === "meeting")?.enabled ?? false}
              onChange={(next) => onSceneToggle("meeting", next)}
              ariaLabel="会议模式 toggle"
            />
          </SettingRow>
          <SettingRow
            label="直播模式"
            desc="减少识别延迟，关闭本地声音回放避免反馈。"
          >
            <Switch
              on={scenes.find((s) => s.id === "live")?.enabled ?? false}
              onChange={(next) => onSceneToggle("live", next)}
              ariaLabel="直播模式 toggle"
            />
          </SettingRow>
          <SettingRow
            label="游戏模式"
            desc="对游戏内语音做优先识别（v0.1 暂未实现）。"
          >
            <Switch
              on={scenes.find((s) => s.id === "game")?.enabled ?? false}
              onChange={(next) => onSceneToggle("game", next)}
              ariaLabel="游戏模式 toggle"
            />
          </SettingRow>
        </Card>

        {/* 字幕 preview 卡片 */}
        <div className="rt-subtitle-card" aria-label="字幕预览">
          <div className="rt-subtitle-card__header">
            <span>字幕</span>
            <span style={{ textTransform: "none", letterSpacing: 0, color: "var(--fg-subtle)" }}>
              {SAMPLE_SUBTITLES.length} 条
            </span>
          </div>
          {SAMPLE_SUBTITLES.length === 0 ? (
            <div className="rt-subtitle-card__empty">
              点击「开始翻译」启动会话
            </div>
          ) : (
            SAMPLE_SUBTITLES.map((s) => (
              <article
                key={s.id}
                className={`rt-subtitle-card__item${s.is_final ? "" : " rt-subtitle-card__item--partial"}`}
                data-channel={s.id}
              >
                <div className="rt-subtitle-card__source">{s.source}</div>
                <div className="rt-subtitle-card__translation">{s.translation}</div>
              </article>
            ))
          )}
        </div>
      </div>

      {/* Sticky CTA: 通道状态 + 开始翻译按钮（D-G-16 黑色 CTA） */}
      <div className="rt-main-cta" role="region" aria-label="实时翻译控制">
        <div className="rt-main-cta__channels">
          <ChannelStatusInline label="我的声音" status={r3State} />
          <div className="rt-main-cta__divider" aria-hidden />
          <ChannelStatusInline label="对方声音" status={r4State} />
        </div>
        <Btn variant="dark" shape="pill" size="lg" disabled>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span aria-hidden>●</span>
            开始翻译
          </span>
        </Btn>
      </div>
    </section>
  );
}

function ChannelStatusInline({ label, status }: { label: string; status: string }) {
  const color =
    status === "running"
      ? "var(--positive)"
      : status === "error"
        ? "var(--critical)"
        : "var(--ink-subtle)";
  const statusLabel = status === "idle" ? "未启动" : status;
  return (
    <div className="rt-main-cta__channel">
      <span className="rt-main-cta__channel-dot" style={{ background: color }} aria-hidden />
      <span className="rt-main-cta__channel-label">{label}</span>
      <span className="rt-main-cta__channel-status">{statusLabel}</span>
    </div>
  );
}

/* TopBar — minimal title bar. Reserves space for the macOS traffic
 * lights, then shows the brand icon + product name on row 1 and
 * the status chip on row 2 (right-aligned). The whole bar is a
 * window drag region; interactive children override with
 * `-webkit-app-region: no-drag`. */
function TopBar({ pingRes, version: _version }: { pingRes: PingResult; version: string }) {
  return (
    <header className="rt-topbar" data-tauri-drag-region>
      <div className="rt-topbar__brand-row">
        <img className="rt-topbar__icon" src={APP_ICON_DATA_URL} alt="realtime_interpreter" />
        <span className="rt-topbar__title">realtime_interpreter</span>
      </div>
      <div className="rt-topbar__status-row">
        <Tooltip wrap content={`IPC handshake: ${pingRes.text}.`}>
          <span className="rt-topbar__chip rt-topbar__chip--meta">
            <span
              className={`status-dot ${pingRes.status === "ok" ? "running" : "error"}`}
              aria-hidden
            />
            {pingRes.status === "ok" ? "已就绪" : "未连接"}
          </span>
        </Tooltip>
      </div>
    </header>
  );
}
