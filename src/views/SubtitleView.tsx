import React from "react";
import { useSubtitlesStore } from "../store/subtitles";

export default function SubtitleView(): React.ReactElement {
  const subtitles = useSubtitlesStore((s) => s.subtitles);

  return (
    <div
      style={{
        height: "100vh",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        overflow: "hidden",
        color: "var(--fg)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--fg-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontWeight: 600,
        }}
      >
        realtime_interpreter — subtitles
      </div>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {subtitles.length === 0 ? (
          <p style={{ color: "var(--fg-muted)", fontSize: 12 }}>
            No subtitles yet. R4 stream wires up in ticket #04.
          </p>
        ) : (
          subtitles.map((s) => (
            <div
              key={s.id}
              style={{
                padding: "8px 10px",
                background: "var(--bg-card)",
                border: "1px solid var(--bg-card-border)",
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              <div style={{ color: "var(--fg-muted)", fontSize: 10, marginBottom: 2 }}>
                [{s.speaker}] {new Date(s.timestamp_ms).toLocaleTimeString()}
              </div>
              <div style={{ color: "var(--fg)" }}>{s.source_text}</div>
              {s.translation_text && (
                <div style={{ color: "var(--accent)", marginTop: 2 }}>
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
