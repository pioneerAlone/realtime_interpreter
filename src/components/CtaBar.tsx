import React, { useEffect, useState } from "react";
import { useEngineStore, formatElapsed } from "../store/engine";
import { usePresetStore } from "../store/presets";

/**
 * CtaBar — sticky bottom CTA bar（T-G-05）
 *
 * 双态：
 *   idle   — 状态行 "▶ 启动后将使用「日常会议」" + "▶ 开始翻译" 按钮
 *            可选 warn 行 "⚠ 引擎 RTT 偏高 · 去设置 → 引擎凭证 重测"
 *   running — 状态行 "已运行 04:38" + "● 停止翻译" 按钮
 *            可选 help 行 "⌘⇧S 暂停 · ⌘⇧M 静音 · ⌘⇧H 字幕显隐"
 *
 * 决策来源: `.scratch/gui-rebuild-v0.md` §5.1 / §5.2
 * Ticket:    #31 (T-G-05)
 */
export default function CtaBar(): React.ReactElement {
  const engineState = useEngineStore((s) => s.engineState);
  const startedAt = useEngineStore((s) => s.startedAt);
  const start = useEngineStore((s) => s.start);
  const stop = useEngineStore((s) => s.stop);
  const tick = useEngineStore((s) => s.tick);
  const credentials = useEngineStore((s) => s.credentials);
  const activeId = usePresetStore((s) => s.activeId);
  const activePreset = usePresetStore((s) =>
    s.presets.find((p) => p.id === activeId),
  );

  const [elapsed, setElapsed] = useState("00:00");

  // running 状态每秒 tick 刷新"已运行 04:38"
  useEffect(() => {
    if (engineState !== "running") return;
    const id = window.setInterval(() => {
      tick();
      setElapsed(formatElapsed(startedAt));
    }, 1000);
    return () => window.clearInterval(id);
  }, [engineState, startedAt, tick]);

  const isRunning = engineState === "running";
  const isWarnEngine =
    !isRunning &&
    credentials.lastRttMs !== null &&
    credentials.lastRttMs > 200;

  return (
    <div className="rt-cta-bar" data-component="cta-bar" data-state={engineState}>
      <div className="rt-cta-bar-content">
        {!isRunning ? (
          <>
            <div className="rt-cta-bar-status">
              <span className="rt-cta-bar-icon" aria-hidden="true">
                ▶
              </span>
              <span>
                启动后将使用「<strong>{activePreset?.name ?? "—"}</strong>」
              </span>
            </div>
            <button
              type="button"
              className="rt-btn rt-btn-dark rt-cta-bar-btn"
              onClick={() => void start()}
              disabled={engineState === "starting"}
            >
              {engineState === "starting" ? "启动中…" : "▶ 开始翻译"}
            </button>
          </>
        ) : (
          <>
            <div className="rt-cta-bar-status">
              <span className="rt-cta-bar-dot" data-tone="success" aria-hidden="true">
                ●
              </span>
              <span>
                已运行 <strong>{elapsed}</strong> · {activePreset?.name ?? "—"} · 运行中
              </span>
            </div>
            <StopButton onStop={() => void stop()} />
          </>
        )}
      </div>

      {!isRunning && isWarnEngine && (
        <div className="rt-cta-bar-warn">
          <span className="rt-cta-bar-icon" aria-hidden="true">
            ⚠
          </span>
          <span>
            引擎 RTT 偏高（{credentials.lastRttMs}ms）·{" "}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                // v0 不实现跳转 · T-G-03 settings 已能直接展开引擎凭证 section
                console.log("[stub] 去设置 → 引擎凭证 section");
              }}
            >
              去设置 → 引擎凭证 重测
            </a>
          </span>
        </div>
      )}

      {isRunning && (
        <div className="rt-cta-bar-help">
          <span>
            <span className="rt-kbd">⌘</span>
            <span className="rt-kbd">⇧</span>
            <span className="rt-kbd">S</span>
            暂停
          </span>
          <span>
            <span className="rt-kbd">⌘</span>
            <span className="rt-kbd">⇧</span>
            <span className="rt-kbd">M</span>
            静音
          </span>
          <span>
            <span className="rt-kbd">⌘</span>
            <span className="rt-kbd">⇧</span>
            <span className="rt-kbd">H</span>
            字幕显隐
          </span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* StopButton — 拆出来避免 TS 窄化 engineState 后 comparing stopping 报错 */
/* ------------------------------------------------------------------ */

function StopButton({ onStop }: { onStop: () => void }): React.ReactElement {
  const state = useEngineStore((s) => s.engineState);
  const isStopping = state === "stopping";
  return (
    <button
      type="button"
      className="rt-btn rt-btn-dark rt-cta-bar-btn"
      onClick={onStop}
      disabled={isStopping}
    >
      {isStopping ? "停止中…" : "● 停止翻译"}
    </button>
  );
}
