/**
 * LiveStage — right-column "Live Stage" panel.
 *
 * Architecture: HaloVoice 3-column layout pattern (Left nav /
 * Center config / Right live preview). The right column shows what
 * the app is doing **right now** — session state, R3/R4 status dots,
 * the Start/Stop button, and a subtitle preview that's a mock of
 * what the floating NSPanel window will display.
 *
 * Three regions:
 *   1. Session header: scene chip + Start/Stop button.
 *   2. Channel status: R3 + R4 cards (compact vs ChannelCard detail
 *      page — this is the "live" snapshot).
 *   3. Subtitle preview: last 6 subtitles streamed from the
 *      `subtitles` Zustand store. Click "Pop out" to launch the
 *      NSPanel caption window (v0 = mock; v1 = real).
 *
 * Note: subtitles store is empty at v0 (the Doubao WebSocket
 * pipeline is not wired up yet, blocked on #8/#9/#10). For the
 * prototype we hardcode a few sample subtitles so the layout is
 * reviewable.
 */

import { useSessionStore } from "@/store/session";
import { Tooltip } from "@/components/ui/Tooltip";

const SAMPLE_SUBTITLES = [
  { id: "1", speaker: "Client" as const, source_text: "Thanks for joining today, let's discuss the Q4 roadmap.", translation_text: "感谢今天加入，我们来讨论 Q4 路线图。", is_final: true, timestamp_ms: Date.now() - 12000 },
  { id: "2", speaker: "Client" as const, source_text: "We need to ship the integration by end of month.", translation_text: "我们需要月底前发布集成。", is_final: true, timestamp_ms: Date.now() - 8000 },
  { id: "3", speaker: "Client" as const, source_text: "Are there any blockers on the audio pipeline?", translation_text: "音频管线有没有任何阻碍？", is_final: false, timestamp_ms: Date.now() - 3000 },
];

export function LiveStage() {
  const r3State = useSessionStore((s) => s.r3);
  const r4State = useSessionStore((s) => s.r4);
  // Treat any non-idle state as "session running".
  const sessionRunning = r3State === "running" || r3State === "starting" || r4State === "running" || r4State === "starting";

  return (
    <aside className="rt-livestage" aria-label="Live translation stage">
      <header className="rt-livestage__header">
        <div className="rt-livestage__title-row">
          <h2 className="rt-livestage__title">Live</h2>
          <span className="rt-livestage__scene-chip" aria-label="Current scene">会议</span>
        </div>
        <SessionButton running={sessionRunning} />
      </header>

      <section className="rt-livestage__channels" aria-label="Channel status">
        <ChannelStatusLite kind="R3" status={r3State} running={sessionRunning} />
        <ChannelStatusLite kind="R4" status={r4State} running={sessionRunning} />
      </section>

      <section className="rt-livestage__subtitles" aria-label="Subtitle preview">
        <div className="rt-livestage__subtitles-header">
          <span className="rt-livestage__subtitles-title">Subtitles</span>
          <Tooltip content="在悬浮窗 (NSPanel) 中独立显示字幕，可拖到屏幕任意位置。v0 预览中；v1 ticket #5 实装。" wrap>
            <button type="button" className="rt-livestage__popout" disabled>
              Pop out ↗
            </button>
          </Tooltip>
        </div>
        <div className="rt-livestage__subtitle-list" aria-live="polite">
          {SAMPLE_SUBTITLES.length === 0 ? (
            <div className="rt-livestage__subtitle-empty">
              Session idle. Click Start to begin.
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

      <footer className="rt-livestage__footer">
        <Tooltip
          wrap
          content="v0: subtitles only shown in main window. NSPanel caption window ships with ticket #5 once #3/#4 audio pipelines are wired."
        >
          <span className="rt-livestage__footer-hint">ⓘ Caption window: v0 mock</span>
        </Tooltip>
      </footer>
    </aside>
  );
}

function SessionButton({ running }: { running: boolean }) {
  return (
    <button
      type="button"
      className={`rt-session-btn ${running ? "rt-session-btn--running" : ""}`}
      disabled
      aria-label={running ? "Stop translation session" : "Start translation session"}
    >
      <span className="rt-session-btn__icon" aria-hidden>{running ? "■" : "●"}</span>
      <span>{running ? "Stop" : "Start"}</span>
    </button>
  );
}

function ChannelStatusLite({
  kind,
  status,
  running,
}: {
  kind: "R3" | "R4";
  status: string;
  running: boolean;
}) {
  const color = running && status === "running" ? "var(--accent-green)" : status === "error" ? "var(--accent-red)" : "var(--text-tertiary, #94a3b8)";
  return (
    <div className="rt-livestage__channel">
      <span className="rt-livestage__channel-kind">{kind}</span>
      <span className="rt-livestage__channel-dot" style={{ background: color }} aria-hidden />
      <span className="rt-livestage__channel-status">{status}</span>
    </div>
  );
}