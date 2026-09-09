import React from "react";
import { useSubtitlesStore } from "../store/subtitles";

/**
 * SubtitleView — capsule 窗口占位（待 T-G-07 重写）
 *
 * 当前任务（T-G-01）：
 *   - 保持可渲染（避免旧 styles.css 依赖崩溃）
 *   - 应用 de-jargon（Q6）
 *
 * 决策来源: `.scratch/gui-rebuild-v0.md` §6 (字幕胶囊窗 v0)
 * Ticket:    #26 (T-G-01) · 完整实装 T-G-07
 */
export default function SubtitleView(): React.ReactElement {
  const subtitles = useSubtitlesStore((s) => s.subtitles);

  return (
    <div
      style={{
        height: "100vh",
        padding: "var(--space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        overflow: "hidden",
        background: "var(--surface-capsule)",
        color: "var(--fg-on-capsule)",
        fontFamily: "var(--font-text)",
      }}
    >
      <div className="rt-eyebrow" style={{ color: "rgba(255,255,255,0.6)" }}>
        实时字幕
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
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "var(--fs-12)" }}>
            翻译启动后字幕会出现在这里
          </p>
        ) : (
          subtitles.map((s) => (
            <div
              key={s.id}
              style={{
                padding: "var(--space-2) var(--space-3)",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "var(--radius-2)",
                fontSize: "var(--fs-13)",
              }}
            >
              <div
                style={{
                  color: "rgba(255,255,255,0.55)",
                  fontSize: 10,
                  marginBottom: 2,
                }}
              >
                {s.speaker} · {new Date(s.timestamp_ms).toLocaleTimeString()}
              </div>
              <div style={{ color: "var(--fg-on-capsule)" }}>{s.source_text}</div>
              {s.translation_text && (
                <div
                  style={{
                    color: "#FFE7C2",
                    marginTop: 2,
                    fontWeight: 500,
                  }}
                >
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
