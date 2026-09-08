/**
 * MainView — top-level shell for the main window.
 *
 * Layout (HaloVoice 3-column pattern + Open-Less FloatingShell
 * structure):
 *
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │ TopBar:  [logo] realtime_interpreter              [API key status]   │
 *   ├──────────┬──────────────────────────────┬────────────────────────┤
 *   │ Sidebar  │  Center content              │  Live Stage            │
 *   │ ⚙ Setup  │  (one of:                   │  ┌──────────────────┐ │
 *   │ 🎙 Ch    │    • Setup     — Topology    │  │ ● Start   [会议] │ │
 *   │ ⌨ Hot    │    • Channels  — R3/R4 cards │  ├──────────────────┤ │
 *   │ ℹ About  │    • Hotkeys   — 3 chips     │  │ R3 ● idle       │ │
 *   │          │    • About     — meta info   │  │ R4 ● idle       │ │
 *   │ ⏻ Quit   │                              │  ├──────────────────┤ │
 *   │          │                              │  │ Subtitles       │ │
 *   │          │                              │  │ [EN] Thanks for… │ │
 *   │          │                              │  │ [ZH] 感谢今天…  │ │
 *   │          │                              │  └──────────────────┘ │
 *   ├──────────┴──────────────────────────────┴────────────────────────┤
 *   │ StatusBar: Topology ● | R3 ● idle | R4 ● idle | ⌥⌃⌥P⌃⌥H        │
 *   └──────────────────────────────────────────────────────────────────┘
 *
 * 3 columns map directly to Open-Less's `<aside> + <main>` pattern
 * extended with a third column for live preview (HaloVoice).
 */

import React, { useEffect, useState } from "react";
import { ping, version } from "@/lib/ipc";
import { useSessionStore } from "@/store/session";
import { useTopologyStore, resolveEffectivePrefs } from "@/store/topology";
import { APP_ICON_DATA_URL } from "@/assets/icon";
import { TopologyCheckPanel } from "@/components/TopologyCheckPanel";
import { ChannelCard } from "@/components/ChannelCard";
import { R3_INFO, R4_INFO } from "@/lib/channelInfo";
import { Sidebar, type NavItemId } from "@/components/Sidebar";
import { StatusBar } from "@/components/StatusBar";
import { LiveStage } from "@/components/LiveStage";
import { Tooltip } from "@/components/ui/Tooltip";

type PingResult = { status: "ok" | "err"; text: string };

const R3_INPUT_DEFAULT = "MacBook Air麦克风";
const R3_OUTPUT_DEFAULT = "BlackHole 2ch";
const R4_OUTPUT_DEFAULT = "MacBook Air扬声器";

export default function MainView(): React.ReactElement {
  const r3State = useSessionStore((s) => s.r3);
  const r4State = useSessionStore((s) => s.r4);
  const topologyPrefs = useTopologyStore((s) => s.prefs);
  const topologyStatus = useTopologyStore((s) => s.status);
  const effectivePrefs = resolveEffectivePrefs(topologyPrefs, topologyStatus?.devices ?? []);
  const [pingRes, setPingRes] = useState<PingResult>({ status: "err", text: "…" });
  const [ver, setVer] = useState<string>("0.0.1");

  useEffect(() => {
    ping()
      .then((p) => setPingRes({ status: "ok", text: p }))
      .catch((e: unknown) => setPingRes({ status: "err", text: String(e) }));
    version()
      .then((v) => setVer(v.version))
      .catch((e: unknown) => setVer(`error: ${String(e)}`));
  }, []);

  const [active, setActive] = useState<NavItemId>("setup");

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
    <div className="rt-shell rt-shell--3col">
      <TopBar pingRes={pingRes} version={ver} />

      <div className="rt-shell__body">
        <Sidebar active={active} onSelect={handleNav} version={ver} />

        <main className="rt-shell__main">
          {active === "setup" && (
            <section className="rt-page" aria-labelledby="setup-heading">
              <header className="rt-page__header">
                <h1 id="setup-heading" className="rt-page__title">音频设置</h1>
                <p className="rt-page__desc">
                  选择你的麦克风、翻译输出、对方声音输入和耳机。设置后会自动检查连接是否正确。
                </p>
              </header>
              <TopologyCheckPanel />
            </section>
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
              <div className="hotkey-list">
                <div className="hotkey-list__row">
                  <div className="hotkey-list__desc">
                    <strong>Toggle subtitle</strong>
                    <span>显示 / 隐藏字幕悬浮窗。NSPanel 不抢焦点。</span>
                  </div>
                  <div className="hotkey-list__keys">
                    <span className="kbd">Right Option</span>
                  </div>
                </div>
                <div className="hotkey-list__row">
                  <div className="hotkey-list__desc">
                    <strong>原声直出 (Bypass)</strong>
                    <span>关闭时英文原声 + 字幕同步上屏；开启时跳过字幕。</span>
                  </div>
                  <div className="hotkey-list__keys">
                    <span className="kbd">⌃</span>
                    <span className="kbd">⌥</span>
                    <span className="kbd">P</span>
                  </div>
                </div>
                <div className="hotkey-list__row">
                  <div className="hotkey-list__desc">
                    <strong>Hide subtitle</strong>
                    <span>直接隐藏字幕窗（不切换）。</span>
                  </div>
                  <div className="hotkey-list__keys">
                    <span className="kbd">⌃</span>
                    <span className="kbd">⌥</span>
                    <span className="kbd">H</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {active === "about" && (
            <section className="rt-page" aria-labelledby="about-heading">
              <header className="rt-page__header">
                <h1 id="about-heading" className="rt-page__title">About</h1>
              </header>
              <div className="about-card">
                <p>
                  <strong>realtime_interpreter</strong> — open-source macOS dual-channel
                  Mac 上运行的双通道实时中英翻译。
                </p>
                <p>开源免费，对标付费的「金喜同传」双通道版。</p>
                <p>
                  <strong>仓库</strong>{" "}
                  <a href="https://github.com/pioneerAlone/realtime_interpreter" target="_blank" rel="noreferrer">
                    pioneerAlone/realtime_interpreter
                  </a>
                </p>
                <p>
                  <strong>PoC</strong>{" "}
                  <a href="https://github.com/pioneerAlone/realtime_interpreter-poc" target="_blank" rel="noreferrer">
                    pioneerAlone/realtime_interpreter-poc
                  </a>
                  <Tooltip
                    wrap
                    content="PoC 是基于 Doubao 同传 2.0 的 A-channel 可行性参考；本仓架构和模式参考 PoC，但 PoC 仓库因为 License 边界 (AGPL-3.0 上游依赖) 不合并入本仓。"
                  >
                    <span className="about-card__hint">ⓘ</span>
                  </Tooltip>
                </p>
                <p>
                  <strong>License</strong>: app code MIT, vendored Doppelvoice .proto Apache-2.0.
                </p>
                <p className="about-card__meta">
                  开源中英同传 · MIT 协议 · macOS-first
                </p>
              </div>
            </section>
          )}
        </main>

        <LiveStage />
      </div>

      <StatusBar onNavigate={handleNav} />
    </div>
  );
}

function TopBar({ pingRes, version: _version }: { pingRes: PingResult; version: string }) {
  return (
    <header className="rt-topbar">
      <div className="rt-topbar__brand">
        <img className="rt-topbar__icon" src={APP_ICON_DATA_URL} alt="realtime_interpreter" />
        <span className="rt-topbar__title">realtime_interpreter</span>
      </div>
      <div className="rt-topbar__meta">
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