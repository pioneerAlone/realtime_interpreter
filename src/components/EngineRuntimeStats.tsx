import React from "react";
import { useEngineStore } from "../store/engine";

/**
 * EngineRuntimeStats — running 状态 R3/R4 实时数据（T-G-05）
 *
 * 视觉：
 *   ● R3 上行  RTT 138ms · 0 丢包           ● 正常
 *   ● R4 回采  已识别 12 句 · 最近 3s        ● 正常
 *   ✓ 已发出句子  R3 8 句 · R4 12 句        双通道
 *
 * 决策来源: `.scratch/gui-rebuild-v0.md` §5.2
 * Ticket:    #31 (T-G-05)
 */
export default function EngineRuntimeStats(): React.ReactElement {
  const r3Stats = useEngineStore((s) => s.r3Stats);
  const r4Stats = useEngineStore((s) => s.r4Stats);
  const r3Sentences = useEngineStore((s) => s.r3Sentences);
  const r4Sentences = useEngineStore((s) => s.r4Sentences);

  return (
    <div className="rt-engine-stats" data-component="engine-runtime-stats">
      <div className="rt-engine-stat-row">
        <span className="rt-engine-stat-dot" data-tone="success" aria-hidden="true">
          ●
        </span>
        <span className="rt-engine-stat-label">R3 上行</span>
        <span className="rt-engine-stat-value">
          {r3Stats ? `RTT ${r3Stats.rttMs}ms · ${r3Stats.packetLoss} 丢包` : "—"}
        </span>
        <span className="rt-engine-stat-status" data-tone="success">
          正常
        </span>
      </div>

      <div className="rt-engine-stat-row">
        <span className="rt-engine-stat-dot" data-tone="success" aria-hidden="true">
          ●
        </span>
        <span className="rt-engine-stat-label">R4 回采</span>
        <span className="rt-engine-stat-value">
          {r4Stats
            ? `已识别 ${r4Stats.recognizedSentences} 句 · 最近 ${r4Stats.lastSentenceAgeSec}s`
            : "—"}
        </span>
        <span className="rt-engine-stat-status" data-tone="success">
          正常
        </span>
      </div>

      <div className="rt-engine-stat-row">
        <span className="rt-engine-stat-dot" data-tone="success" aria-hidden="true">
          ✓
        </span>
        <span className="rt-engine-stat-label">已发出句子</span>
        <span className="rt-engine-stat-value">
          R3 {r3Sentences} 句 · R4 {r4Sentences} 句
        </span>
        <span className="rt-engine-stat-status" data-tone="success">
          双通道
        </span>
      </div>
    </div>
  );
}
