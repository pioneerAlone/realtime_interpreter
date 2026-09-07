/**
 * ChannelCard — left-detail-right-status panel for R3 / R4 channels.
 *
 * Layout (mirrors Open-Less SettingRow + status-badge pattern):
 *
 *   ┌────────────────────────────────────────────────────────┐
 *   │ R3  A-channel (zh→en s2s)  ⓘ                 ● idle    │
 *   │ ────────────────────────────────────────────────────── │
 *   │ 你说中文 → 会议软件听到你的英文（保留你的音色）         │
 *   │                                                        │
 *   │ 源语言      zh                                          │
 *   │ 目标语言    en                                          │
 *   │ 输入设备    MacBook Air麦克风                            │
 *   │ 输出设备    BlackHole 2ch (R3 VAC)                       │
 *   │ 链路        mic → cpal → AGC → Doubao S2S WS → OGG →    │
 *   │             opus decode → ring buffer → cpal → VAC       │
 *   │ 延迟目标    ≤ 3 s first-sound median                    │
 *   │                                                        │
 *   │ 启动条件    Topology=OK + API key set + Mic 不静音      │
 *   │ 依赖        #08 OGG demuxer · #09 2-header auth ·       │
 *   │             #10 Protobuf                                 │
 *   │ 错误模式    API 401 → 鉴权失败                          │
 *   │             RTT >500 ms → 警告「请插网线」              │
 *   │             BlackHole 16ch 占用 → 提示释放              │
 *   └────────────────────────────────────────────────────────┘
 *
 * The ⓘ icon shows the full description in a Tooltip on hover so the
 * panel itself stays compact. The panel body is the same as what's in
 * the tooltip so keyboard / print users can read it without mouse.
 */

import { Tooltip } from "@/components/ui/Tooltip";
import type { SessionState } from "@/store/session";

export type ChannelKind = "R3" | "R4";

interface ChannelCardProps {
  kind: ChannelKind;
  /** Short technical name shown in card header. */
  title: string;
  /** Long name for accessibility (e.g. "A-channel realtime s2s"). */
  fullName: string;
  /** One-sentence summary shown in card body. */
  summary: string;
  /** Status state shown as the dot in the header right side. */
  status: SessionState;
  /** Source / target language labels. */
  srcLang: string;
  tgtLang: string;
  /** Resolved device names (null = "(not yet picked)"). */
  inputDevice: string | null;
  outputDevice: string | null;
  /** Latency target as human-readable string. */
  latencyTarget: string;
  /** Bullet list of startup conditions. */
  startupConditions: string[];
  /** Bullet list of dependency tickets. */
  dependencies: string[];
  /** Bullet list of common error modes + their handling. */
  errorModes: string[];
  /** Full inline description (same as tooltip content). */
  longDescription: string;
}

const STATUS_COLOR: Record<SessionState, string> = {
  idle: "var(--status-idle, #94a3b8)",
  starting: "var(--status-pending, #fbbf24)",
  running: "var(--status-running, #22c55e)",
  stopping: "var(--status-pending, #fbbf24)",
  error: "var(--status-error, #ef4444)",
};

export function ChannelCard(props: ChannelCardProps) {
  const {
    kind,
    title,
    fullName,
    summary,
    status,
    srcLang,
    tgtLang,
    inputDevice,
    outputDevice,
    latencyTarget,
    startupConditions,
    dependencies,
    errorModes,
    longDescription,
  } = props;

  return (
    <article className="channel-card" aria-label={fullName}>
      <header className="channel-card__header">
        <div className="channel-card__title-row">
          <span className="channel-card__kind">{kind}</span>
          <span className="channel-card__title">{title}</span>
          <Tooltip content={longDescription} wrap>
            <button
              type="button"
              className="channel-card__info"
              aria-label={`More info about ${fullName}`}
            >
              ⓘ
            </button>
          </Tooltip>
        </div>
        <div className="channel-card__status">
          <span
            className="channel-card__status-dot"
            style={{ background: STATUS_COLOR[status] }}
            aria-hidden
          />
          <span className="channel-card__status-label">{status}</span>
        </div>
      </header>

      <p className="channel-card__summary">{summary}</p>

      <dl className="channel-card__details">
        <dt>源语言</dt>
        <dd>{srcLang}</dd>
        <dt>目标语言</dt>
        <dd>{tgtLang}</dd>
        <dt>输入设备</dt>
        <dd>{inputDevice ?? "(未指定)"}</dd>
        <dt>输出设备</dt>
        <dd>{outputDevice ?? "(未指定)"}</dd>
        <dt>延迟目标</dt>
        <dd>{latencyTarget}</dd>
      </dl>

      <details className="channel-card__advanced">
        <summary>启动条件 / 依赖 / 错误模式</summary>
        <div className="channel-card__advanced-body">
          <section>
            <h4>启动条件</h4>
            <ul>
              {startupConditions.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>
          <section>
            <h4>依赖 tickets</h4>
            <ul>
              {dependencies.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>
          <section>
            <h4>错误模式</h4>
            <ul>
              {errorModes.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>
        </div>
      </details>

      <p className="channel-card__long-desc">{longDescription}</p>
    </article>
  );
}