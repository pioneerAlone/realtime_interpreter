import React, { useEffect, useState } from "react";
import { useCaptionStore, type SubtitleEntry } from "../store/caption";

/**
 * SubtitleView — 字幕胶囊窗（T-G-07 完整实装）
 *
 * 5 态 UI（per design freeze §6.3）：
 *   empty       — "字幕将在翻译启动后出现"
 *   single      — 最新 1 句
 *   multi       — 最近 3 行 stacked + 旧行 opacity 渐淡 + 自动滚动
 *   streaming   — partial italic + caret "▍"
 *   disconnected— 红色半透明 + "连接中断 · 重连中..."
 *
 * 双语 stacked（per Q7 · v0 hardcode）：
 *   - 翻译行 17pt bold #FFE7C2（沉浸式翻译 + Hermeneus 暖米色）
 *   - 源行 13pt italic rgba(255,255,255,0.7)
 *   - 行间 1px divider rgba(255,255,255,0.06)
 *
 * 决策来源: `.scratch/gui-rebuild-v0.md` §6 + §10.1 T-G-07
 * Ticket:    #33 (T-G-07)
 */
export default function SubtitleView(): React.ReactElement {
  const state = useCaptionStore((s) => s.state);
  const subtitles = useCaptionStore((s) => s.subtitles);
  const currentPartial = useCaptionStore((s) => s.currentPartial);
  const loadSettings = useCaptionStore((s) => s.loadSettings);
  const settings = useCaptionStore((s) => s.settings);

  const [opacity, setOpacity] = useState(0.82);
  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    setOpacity(settings.opacity / 100);
  }, [settings.opacity]);

  return (
    <div
      className="rt-caption"
      data-component="caption"
      data-state={state}
      style={{ opacity }}
    >
      {state === "empty" && <EmptyState />}
      {state === "single" && <SingleState entries={subtitles} />}
      {state === "multi" && <MultiState entries={subtitles} />}
      {state === "streaming" && <StreamingState partial={currentPartial} />}
      {state === "disconnected" && <DisconnectedState />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 5 态组件                                                            */
/* ------------------------------------------------------------------ */

function EmptyState(): React.ReactElement {
  return (
    <div className="rt-caption-empty" data-state="empty">
      <p>字幕将在翻译启动后出现</p>
    </div>
  );
}

function SingleState({ entries }: { entries: SubtitleEntry[] }): React.ReactElement {
  const last = entries[entries.length - 1];
  if (!last) return <EmptyState />;
  return (
    <div className="rt-caption-single" data-state="single">
      <SubtitleRow entry={last} fresh />
    </div>
  );
}

function MultiState({ entries }: { entries: SubtitleEntry[] }): React.ReactElement {
  const recent = entries.slice(-3);
  return (
    <div className="rt-caption-multi" data-state="multi">
      {recent.map((entry, idx) => {
        const isLatest = idx === recent.length - 1;
        const fadeLevel = recent.length - 1 - idx;
        return (
          <SubtitleRow
            key={entry.id}
            entry={entry}
            fresh={isLatest}
            faded={fadeLevel > 0}
            fadeLevel={fadeLevel}
          />
        );
      })}
    </div>
  );
}

function StreamingState({ partial }: { partial: SubtitleEntry | null }): React.ReactElement {
  if (!partial) {
    return (
      <div className="rt-caption-streaming" data-state="streaming">
        <div className="rt-caption-row" data-fresh>
          <p className="rt-caption-translation">
            <em>正在识别</em>
            <span className="rt-caption-caret" aria-hidden="true">▍</span>
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="rt-caption-streaming" data-state="streaming">
      <div className="rt-caption-row" data-fresh>
        <p className="rt-caption-translation">
          <em>{partial.translation}</em>
          <span className="rt-caption-caret" aria-hidden="true">▍</span>
        </p>
        <p className="rt-caption-source">{partial.source}</p>
      </div>
    </div>
  );
}

function DisconnectedState(): React.ReactElement {
  return (
    <div className="rt-caption-disconnected" data-state="disconnected">
      <div className="rt-caption-warn-icon" aria-hidden="true">⚠</div>
      <p>连接中断 · 重连中…</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SubtitleRow — 双语 stacked 行                                       */
/* ------------------------------------------------------------------ */

interface SubtitleRowProps {
  entry: SubtitleEntry;
  fresh?: boolean;
  faded?: boolean;
  fadeLevel?: number;
}

function SubtitleRow({
  entry,
  fresh = false,
  faded = false,
  fadeLevel = 0,
}: SubtitleRowProps): React.ReactElement {
  const opacity = faded ? Math.max(0.32, 0.55 - fadeLevel * 0.12) : 1;
  return (
    <div
      className="rt-caption-row"
      data-fresh={fresh}
      data-faded={faded}
      style={{ opacity }}
    >
      <p className="rt-caption-translation">{entry.translation}</p>
      <p className="rt-caption-source">{entry.source}</p>
    </div>
  );
}
