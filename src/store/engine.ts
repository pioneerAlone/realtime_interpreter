import { create } from "zustand";
import { useSessionStore } from "./session";
import { startSession, stopSession } from "../lib/ipc";

/**
 * engine.ts — 实时翻译 engine 状态（T-G-05）
 *
 * 包含：
 *   - engine 状态 (idle / starting / running / stopping / error)
 *   - 启动时间戳（用于「已运行 04:38」）
 *   - R3/R4 实时 stats（running 状态显示）
 *   - 引擎凭证 last_test_result（mock · T-G-06 实装）
 *
 * 决策来源: `.scratch/gui-rebuild-v0.md` §5 + §10.1 T-G-05
 * Ticket:    #31 (T-G-05)
 */

export type EngineState = "idle" | "starting" | "running" | "stopping" | "error";

export interface R3Stats {
  rttMs: number;
  packetLoss: number;
}

export interface R4Stats {
  recognizedSentences: number;
  lastSentenceAgeSec: number;
}

export interface EngineCredentials {
  apiKeySet: boolean;
  lastTestAt: string | null;
  lastTestResult: "success" | "fail" | null;
  lastRttMs: number | null;
}

interface EngineSlice {
  engineState: EngineState;
  startedAt: number | null;

  /** R3 stats · running 时填充 */
  r3Stats: R3Stats | null;
  /** R4 stats · running 时填充 */
  r4Stats: R4Stats | null;
  /** 已发出句子数 · running 时 */
  r3Sentences: number;
  r4Sentences: number;

  /** 引擎凭证 last_test_result（v0 mock · T-G-06 实装持久化） */
  credentials: EngineCredentials;

  /** 切换 running 状态 · 调 start_session / stop_session IPC */
  start: () => Promise<void>;
  stop: () => Promise<void>;
  /** tick 用于实时刷新"已运行 04:38" · useEffect 1s interval */
  tick: () => void;
  /** dev-only · 模拟凭证状态用于截图 */
  setCredentialsMock: (c: Partial<EngineCredentials>) => void;
}

const DEFAULT_CREDENTIALS: EngineCredentials = {
  apiKeySet: true,
  lastTestAt: "2 小时前",
  lastTestResult: "success",
  lastRttMs: 412, // > 200ms → 触发黄 warn
};

export const useEngineStore = create<EngineSlice>((set, get) => ({
  engineState: "idle",
  startedAt: null,
  r3Stats: null,
  r4Stats: null,
  r3Sentences: 0,
  r4Sentences: 0,
  credentials: DEFAULT_CREDENTIALS,

  start: async () => {
    if (get().engineState !== "idle") return;
    set({ engineState: "starting" });
    try {
      // 并行启动 R3 + R4
      const [r3Res, r4Res] = await Promise.all([
        startSession("R3"),
        startSession("R4"),
      ]);
      // 同步到 useSessionStore
      useSessionStore.getState().setState("R3", r3Res);
      useSessionStore.getState().setState("R4", r4Res);

      set({
        engineState: "running",
        startedAt: Date.now(),
        r3Stats: { rttMs: 138, packetLoss: 0 },
        r4Stats: { recognizedSentences: 0, lastSentenceAgeSec: 0 },
        r3Sentences: 0,
        r4Sentences: 0,
      });
    } catch (e) {
      console.error("[engine] start failed:", e);
      set({ engineState: "error" });
    }
  },

  stop: async () => {
    if (get().engineState !== "running") return;
    set({ engineState: "stopping" });
    try {
      const [r3Res, r4Res] = await Promise.all([
        stopSession("R3"),
        stopSession("R4"),
      ]);
      useSessionStore.getState().setState("R3", r3Res);
      useSessionStore.getState().setState("R4", r4Res);
    } catch (e) {
      console.error("[engine] stop failed:", e);
    } finally {
      set({
        engineState: "idle",
        startedAt: null,
        r3Stats: null,
        r4Stats: null,
        r3Sentences: 0,
        r4Sentences: 0,
      });
    }
  },

  tick: () => {
    // 1s interval · 用于实时刷新"已运行"计时 + 模拟 R3/R4 增长
    const s = get();
    if (s.engineState !== "running" || !s.startedAt) return;
    const elapsedSec = Math.floor((Date.now() - s.startedAt) / 1000);
    const minutes = Math.floor(elapsedSec / 60);
    const seconds = elapsedSec % 60;
    const r4 = s.r4Stats ?? { recognizedSentences: 0, lastSentenceAgeSec: 0 };
    set({
      r4Stats: {
        recognizedSentences: r4.recognizedSentences + (elapsedSec % 5 === 0 ? 1 : 0),
        lastSentenceAgeSec: elapsedSec % 5,
      },
      r4Sentences: r4.recognizedSentences,
    });
    // suppress unused
    void minutes;
    void seconds;
  },

  setCredentialsMock: (c) => {
    set((s) => ({ credentials: { ...s.credentials, ...c } }));
  },
}));

/** 格式化"已运行 04:38" */
export function formatElapsed(startedAt: number | null): string {
  if (!startedAt) return "00:00";
  const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
  const m = Math.floor(elapsedSec / 60)
    .toString()
    .padStart(2, "0");
  const s = (elapsedSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
