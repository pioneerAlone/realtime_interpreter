/**
 * LiveStage — right-column "Live Stage" panel.
 *
 * User-facing language: never show technical channel code names
 * (R3/R4/A-channel/B-channel), transport labels (VAC), or implementation
 * details (NSPanel, s2s/s2t, v0 mock). Internal references live in
 * `data-channel` HTML attributes for devs grepping the DOM.
 *
 * Three regions:
 *   1. Session header: "实时翻译" title + Start button (CTA).
 *   2. Channel status: 我的声音 / 对方声音 status rows.
 *   3. Subtitle preview: 中英双语 rolling list (mock data at v0).
 */

import { useSessionStore } from "@/store/session";
import type { ChannelInfo } from "@/lib/channelInfo";

const SAMPLE_SUBTITLES = [
  { id: "1", source_text: "Thanks for joining today, let's discuss the Q4 roadmap.", translation_text: "感谢今天加入，我们来讨论 Q4 路线图。", is_final: true, timestamp_ms: Date.now() - 12000 },
  { id: "2", source_text: "We need to ship the integration by end of month.", translation_text: "我们需要月底前发布集成。", is_final: true, timestamp_ms: Date.now() - 8000 },
  { id: "3", source_text: "Are there any blockers on the audio pipeline?", translation_text: "音频管线有没有任何阻碍？", is_final: false, timestamp_ms: Date.now() - 3000 },
];

interface LiveStageProps {
  /** Channel meta + runtime status from session store. Reserved for
   *  future use; today LiveStage reads directly from session store. */
  channels?: Array<{ info: ChannelInfo; status: string }>;
}

export function LiveStage(_props: LiveStageProps = {}) {
  const r3State = useSessionStore((s) => s.r3);
  const r4State = useSessionStore((s) => s.r4);

  return (
    <aside className="rt-livestage" aria-label="实时翻译">
      <header className="rt-livestage__header">
        <h2 className="rt-livestage__title">实时翻译</h2>
        <button
          type="button"
          className="rt-session-btn"
          disabled
          aria-label="开始翻译"
        >
          <span className="rt-session-btn__icon" aria-hidden>●</span>
          <span>开始翻译</span>
        </button>
      </header>

      <section className="rt-livestage__channels" aria-label="通道状态">
        <ChannelStatusRow
          internalName="R3"
          label="我的声音"
          sublabel="你说 → 翻译给对方"
          status={r3State}
        />
        <ChannelStatusRow
          internalName="R4"
          label="对方声音"
          sublabel="对方说 → 字幕给你"
          status={r4State}
        />
      </section>

      <section className="rt-livestage__subtitles" aria-label="字幕预览">
        <div className="rt-livestage__subtitles-header">
          <span className="rt-livestage__subtitles-title">字幕</span>
        </div>
        <div className="rt-livestage__subtitle-list" aria-live="polite">
          {SAMPLE_SUBTITLES.length === 0 ? (
            <div className="rt-livestage__subtitle-empty">
              点击「开始翻译」启动会话
            </div>
          ) : (
            SAMPLE_SUBTITLES.map((s) => (
              <article
                key={s.id}
                className={`rt-livestage__subtitle ${s.is_final ? "" : "rt-livestage__subtitle--partial"}`}
              >
                <div className="rt-livestage__subtitle-source">{s.source_text}</div>
                <div className="rt-livestage__subtitle-translation">{s.translation_text}</div>
              </article>
            ))
          )}
        </div>
      </section>
    </aside>
  );
}

function ChannelStatusRow({
  internalName,
  label,
  sublabel,
  status,
}: {
  internalName: string;
  label: string;
  sublabel: string;
  status: string;
}) {
  const color =
    status === "running"
      ? "var(--accent-green, #22c55e)"
      : status === "error"
        ? "var(--accent-red, #ef4444)"
        : "var(--text-tertiary, #94a3b8)";
  return (
    <div className="rt-livestage__channel" data-channel={internalName}>
      <div className="rt-livestage__channel-meta">
        <span className="rt-livestage__channel-label">{label}</span>
        <span className="rt-livestage__channel-sublabel">{sublabel}</span>
      </div>
      <span className="rt-livestage__channel-dot" style={{ background: color }} aria-hidden />
      <span className="rt-livestage__channel-status">{status}</span>
    </div>
  );
}