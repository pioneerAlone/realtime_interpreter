/**
 * Review.tsx — v0.2 review demo (从需求重设计)
 *
 * 核心产品定位：macOS 实时同传翻译 app。
 * 用户场景：开 Zoom 会议时挂着用，主交互是「看字幕 + 偶尔切设备」。
 *
 * v0 不做（避免 over-build）：
 *  - 今日句数/时长/延迟 metric（v0 没真翻译）
 *  - 历史记录（v0 不存历史）
 *  - LLM 模型配置（v0 不可选）
 *
 * 3 个页面（侧栏 nav 切换）：
 *  1. 实时翻译（默认）: 顶状态环 + 中流式字幕 + 底启停 CTA
 *  2. 设备: 4 个 picker + 会议模式 toggle
 *  3. 设置: 快捷键 + 关于 + 版本（Open-Less 折叠分组模式）
 *
 * 流式字幕 UX（核心）：
 *  - 永远显示最新 1-2 句在视图里
 *  - 新字幕从底部出现，旧字幕向上滚动
 *  - 双语 stacked（Open-Less 风格 + 我们 v0.1 决定）
 *  - 大字 24-28px 黑色背景白字（会议场景可读性）
 *
 * 设计原则（用户 2026-09-08 反复强调）：
 *  - 不要照搬 Open-Less 布局
 *  - 不要照搬 HaloVoice 布局
 *  - 从产品需求出发
 *  - 持续迭代，每步 build + screenshot 验证
 */

import { useEffect, useRef, useState } from "react";
import {
  AudioLines,
  Cpu,
  Headphones,
  Mic,
  Settings as SettingsIcon,
  Sparkles,
  Volume2,
} from "lucide-react";
import { Card, Btn, Pill } from "../ui/_atoms";
import { SelectLite } from "../ui/SelectLite";
import { Switch } from "../ui/Switch";
import { SettingRow } from "../ui/SettingRow";

/* ====================== Sidebar ====================== */

type NavId = "main" | "devices" | "settings";

const NAV_ITEMS: Array<{
  id: NavId;
  label: string;
  Icon: typeof AudioLines;
}> = [
  { id: "main", label: "实时翻译", Icon: AudioLines },
  { id: "devices", label: "设备", Icon: Headphones },
  { id: "settings", label: "设置", Icon: SettingsIcon },
];

function Sidebar({
  active,
  onSelect,
}: {
  active: NavId;
  onSelect: (id: NavId) => void;
}) {
  return (
    <aside className="rt-sidebar" aria-label="Primary navigation">
      <div className="rt-sidebar__brand">
        <span className="rt-sidebar__brand-mark" aria-hidden>◐</span>
        <span className="rt-sidebar__brand-name">realtime_interpreter</span>
      </div>
      <nav className="rt-sidebar__nav">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === active;
          const Icon = item.Icon;
          return (
            <button
              key={item.id}
              type="button"
              className={`rt-sidebar__nav-btn${isActive ? " rt-sidebar__nav-btn--active" : ""}`}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onSelect(item.id)}
            >
              <Icon
                className="rt-sidebar__nav-icon"
                size={14}
                strokeWidth={1.75}
                aria-hidden
              />
              <span className="rt-sidebar__nav-label">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

/* ====================== Main — 实时翻译（默认页） ====================== */

const SAMPLE_SUBTITLES_INIT: Array<{
  id: number;
  source: string;
  translation: string;
  is_final: boolean;
}> = [
  { id: 1, source: "Let me share my screen to walk through the Q4 roadmap.", translation: "我分享下屏幕，带你们过一下 Q4 路线图。", is_final: true },
  { id: 2, source: "We need to ship the integration by end of month.", translation: "我们需要月底前发布集成。", is_final: true },
  { id: 3, source: "The latency is around 1.3 seconds for live meetings.", translation: "实时会议延迟大约 1.3 秒。", is_final: true },
  { id: 4, source: "Are there any blockers on the audio pipeline?", translation: "音频管线有什么阻碍吗？", is_final: true },
  { id: 5, source: "Thanks for joining today, everyone.", translation: "感谢大家今天加入。", is_final: true },
];

const STREAM_FEED: Array<{
  source: string;
  translation: string;
  is_final: boolean;
}> = [
  { source: "All right, let me pull up the prototype here.", translation: "好的，我把原型拉出来看一下。", is_final: true },
  { source: "So this is the dashboard you saw last week.", translation: "这是你们上周看过的 dashboard。", is_final: true },
  { source: "Let me click into the live transcription view.", translation: "我点进实时转写视图。", is_final: true },
  { source: "You can see the bilingual stacked subtitle on the left,", translation: "你们可以看到左侧的双语字幕。", is_final: true },
  { source: "and the original audio on the right.", translation: "右边是原始音频。", is_final: true },
];

function MainMain() {
  // 流式字幕：进入页面后每 1.8s 推一条新字幕 (模拟)
  const [feed, setFeed] = useState<typeof SAMPLE_SUBTITLES_INIT>(SAMPLE_SUBTITLES_INIT);
  const [isRunning, setIsRunning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isRunning) return;
    let nextId = 100;
    const interval = setInterval(() => {
      const next = STREAM_FEED[nextId % STREAM_FEED.length];
      setFeed((prev) => [
        ...prev.slice(-29), // 保留最近 30 条
        { id: nextId, ...next },
      ]);
      nextId += 1;
    }, 1800);
    return () => clearInterval(interval);
  }, [isRunning]);

  // 自动滚到底部（最新字幕在视野）
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [feed]);

  return (
    <main className="rt-main">
      <header className="rt-main__header">
        <h1 className="rt-page__title">实时翻译</h1>
        <p className="rt-page__desc">会议实时翻译运行状态</p>
      </header>

      {/* 顶部：2 个状态环 — 紧凑卡片 */}
      <div className="rt-status-row">
        <StatusCard
          icon={<Mic size={18} strokeWidth={1.75} />}
          label="我的声音"
          device="MacBook Air 麦克风"
          state={isRunning ? "running" : "idle"}
        />
        <StatusCard
          icon={<Volume2 size={18} strokeWidth={1.75} />}
          label="对方声音"
          device="BlackHole 16ch"
          state={isRunning ? "running" : "idle"}
        />
        <StatusCard
          icon={<Cpu size={18} strokeWidth={1.75} />}
          label="翻译服务"
          device="Doubao 同传 2.0"
          state={isRunning ? "running" : "standby"}
        />
      </div>

      {/* 中部：流式字幕 */}
      <Card padding="md" className="rt-stream">
        <div className="rt-stream__header">
          <div>
            <h2 className="rt-stream__title">实时字幕</h2>
            <span className="rt-stream__sub">双语 stacked · 自动滚动</span>
          </div>
          <div className="rt-stream__pills">
            {isRunning ? (
              <Pill tone="positive" dot>运行中</Pill>
            ) : (
              <Pill tone="neutral">待机</Pill>
            )}
            <Pill tone="accent" dot>{feed.length} 句</Pill>
          </div>
        </div>
        <div className="rt-stream__list" ref={scrollRef}>
          {feed.length === 0 ? (
            <div className="rt-stream__empty">
              点击「开始翻译」启动实时字幕流
            </div>
          ) : (
            feed.map((s) => (
              <article
                key={s.id}
                className={`rt-stream__item${s.is_final ? "" : " rt-stream__item--partial"}`}
              >
                <div className="rt-stream__source">{s.source}</div>
                <div className="rt-stream__translation">{s.translation}</div>
              </article>
            ))
          )}
        </div>
      </Card>

      {/* Sticky CTA */}
      <div className="rt-main-cta">
        <div className="rt-main-cta__hint">
          <Sparkles size={13} strokeWidth={1.75} aria-hidden />
          <span>字幕流将自动滚动到最新 30 句</span>
        </div>
        <Btn
          variant={isRunning ? "secondary" : "dark"}
          shape="pill"
          size="lg"
          onClick={() => setIsRunning((r) => !r)}
        >
          {isRunning ? "暂停翻译" : "开始翻译"}
        </Btn>
      </div>
    </main>
  );
}

function StatusCard({
  icon,
  label,
  device,
  state,
}: {
  icon: React.ReactNode;
  label: string;
  device: string;
  state: "running" | "idle" | "standby" | "error";
}) {
  const stateLabel: Record<typeof state, string> = {
    running: "运行中",
    idle: "未启动",
    standby: "待命",
    error: "异常",
  };
  const dotColor =
    state === "running"
      ? "var(--positive)"
      : state === "error"
        ? "var(--critical)"
        : state === "standby"
          ? "var(--warn)"
          : "var(--ink-subtle)";
  return (
    <div className="rt-status-card">
      <div className="rt-status-card__icon" aria-hidden>
        {icon}
      </div>
      <div className="rt-status-card__body">
        <div className="rt-status-card__label">{label}</div>
        <div className="rt-status-card__device">{device}</div>
      </div>
      <div className="rt-status-card__state">
        <span
          className="rt-status-card__dot"
          style={{ background: dotColor }}
          aria-hidden
        />
        {stateLabel[state]}
      </div>
    </div>
  );
}

/* ====================== Main — 设备 ====================== */

const MOCK_DEVICES = [
  { value: "macbook-air-mic", label: "MacBook Air 麦克风 (Built-in)" },
  { value: "blackhole-2ch", label: "BlackHole 2ch (Virtual)" },
  { value: "blackhole-16ch", label: "BlackHole 16ch (Virtual)" },
  { value: "macbook-air-spk", label: "MacBook Air 扬声器 (Built-in)" },
];

function MainDevices() {
  const [meetingMode, setMeetingMode] = useState(true);
  return (
    <main className="rt-main">
      <header className="rt-main__header">
        <h1 className="rt-page__title">设备</h1>
        <p className="rt-page__desc">选择音频输入输出设备，会议期间随时可切换</p>
      </header>

      <Card padding="md">
        <SettingRow
          noDivider
          label="我的麦克风"
          desc="你说的中文会被实时翻译给对方听"
          controlWidth="auto"
        >
          <SelectLite
            value="macbook-air-mic"
            onChange={() => {}}
            ariaLabel="我的麦克风"
            options={MOCK_DEVICES}
          />
        </SettingRow>
        <SettingRow
          label="我的翻译输出"
          desc="翻译后的语言从这里输出到会议软件"
          controlWidth="auto"
        >
          <SelectLite
            value="blackhole-2ch"
            onChange={() => {}}
            ariaLabel="我的翻译输出"
            options={MOCK_DEVICES}
          />
        </SettingRow>
        <SettingRow
          label="对方的说话输入"
          desc="从会议软件采集对方说的话"
          controlWidth="auto"
        >
          <SelectLite
            value="blackhole-16ch"
            onChange={() => {}}
            ariaLabel="对方的说话输入"
            options={MOCK_DEVICES}
          />
        </SettingRow>
        <SettingRow
          label="我的耳机或扬声器"
          desc="听对方说话 + 翻译校对用"
          controlWidth="auto"
        >
          <SelectLite
            value="macbook-air-spk"
            onChange={() => {}}
            ariaLabel="我的耳机或扬声器"
            options={MOCK_DEVICES}
          />
        </SettingRow>
      </Card>

      <Card padding="md" className="rt-mode-card">
        <div className="rt-mode-card__row">
          <div className="rt-mode-card__body">
            <div className="rt-mode-card__title">会议模式</div>
            <div className="rt-mode-card__desc">v0 唯一场景。开启双向翻译。</div>
          </div>
          <Switch
            on={meetingMode}
            onChange={setMeetingMode}
            ariaLabel="会议模式 toggle"
          />
        </div>
      </Card>
    </main>
  );
}

/* ====================== Main — 设置 ====================== */

function MainSettings() {
  return (
    <main className="rt-main">
      <header className="rt-main__header">
        <h1 className="rt-page__title">设置</h1>
        <p className="rt-page__desc">快捷键 / 关于 / 版本</p>
      </header>

      <Card padding="md">
        <SettingRow
          noDivider
          label="显示悬浮字幕"
          desc="快捷键：Right Option"
          controlWidth="auto"
        >
          <Pill tone="neutral">系统级</Pill>
        </SettingRow>
        <SettingRow
          label="原声直出 (Bypass)"
          desc="快捷键：⌃ ⌥ P — 关闭时英文原声 + 字幕同步上屏"
          controlWidth="auto"
        >
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <span className="rt-key">⌃</span>
            <span className="rt-key">⌥</span>
            <span className="rt-key">P</span>
          </div>
        </SettingRow>
        <SettingRow
          label="隐藏字幕"
          desc="快捷键：⌃ ⌥ H — 直接隐藏字幕窗（不切换）"
          controlWidth="auto"
        >
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <span className="rt-key">⌃</span>
            <span className="rt-key">⌥</span>
            <span className="rt-key">H</span>
          </div>
        </SettingRow>
      </Card>

      <Card padding="md" className="rt-about-card">
        <div className="rt-about-card__title">realtime_interpreter</div>
        <div className="rt-about-card__desc">
          开源 macOS 实时中英同传工具 · v0.0.1
        </div>
        <div className="rt-about-card__meta">
          <a
            href="https://github.com/pioneerAlone/realtime_interpreter"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          <span className="rt-about-card__sep">·</span>
          <Pill tone="accent">MIT</Pill>
          <span className="rt-about-card__sep">·</span>
          <Pill tone="positive">macOS</Pill>
        </div>
      </Card>
    </main>
  );
}

/* ====================== App ====================== */

export function Review() {
  const [active, setActive] = useState<NavId>("main");

  return (
    <div className="rt-review-frame">
      <div className="rt-shell">
        <div className="rt-shell__body">
          <Sidebar active={active} onSelect={setActive} />
          <div className="rt-main-wrap">
            {active === "main" && <MainMain />}
            {active === "devices" && <MainDevices />}
            {active === "settings" && <MainSettings />}
          </div>
        </div>
      </div>
    </div>
  );
}
