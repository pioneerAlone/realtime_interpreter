import React from "react";
import { useSubtitlesStore } from "../store/subtitles";

export default function SubtitleView(): React.ReactElement {
  const subtitles = useSubtitlesStore((s) => s.subtitles);

  return (
    <div
      style={{
        height: "100vh",
        padding: 12,
        background: "rgba(28, 28, 30, 0.7)",
        backdropFilter: "blur(20px)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        overflow: "hidden",
      }}
    >
      <p style={{ color: "var(--fg-secondary)", fontSize: 11 }}>
        realtime_interpreter — subtitles (v0 scaffold)
      </p>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
        {subtitles.length === 0 ? (
          <p style={{ color: "var(--fg-secondary)", fontSize: 12 }}>
            No subtitles yet. R4 stream wires up in ticket #04.
          </p>
        ) : (
          subtitles.map((s) => (
            <div
              key={s.id}
              style={{
                padding: "6px 8px",
                background: "rgba(255,255,255,0.05)",
                borderRadius: 4,
                fontSize: 12,
              }}
            >
              <div style={{ color: "var(--fg-secondary)", fontSize: 10 }}>
                [{s.speaker}] {new Date(s.timestamp_ms).toLocaleTimeString()}
              </div>
              <div>{s.source_text}</div>
              {s.translation_text && (
                <div style={{ color: "var(--fg-primary)", marginTop: 2 }}>
                  {s.translation_text}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
