import { create } from "zustand";
import {
  getCaptionSettings,
  setCaptionPosition,
  setCaptionOpacity,
  setCaptionLocked,
  setCaptionClickThrough,
  setCaptionShareHidden,
  setCaptionDisplayIndex,
} from "../lib/ipc";

/**
 * caption.ts — 字幕胶囊窗状态（T-G-07）
 *
 * 包含：
 *   - 6 项能力设置（position / opacity / locked / click_through / share_hidden / display_index）
 *   - 字幕内容列表（partial + final 状态）
 *   - 连接状态（disconnected 检测）
 *
 * 决策来源: `.scratch/gui-rebuild-v0.md` §6 + §10.1 T-G-07
 * Ticket:    #33 (T-G-07)
 */

export interface Position {
  x: number;
  y: number;
}

export interface CaptionSettings {
  position: Position | null;
  /** 0-100 */
  opacity: number;
  locked: boolean;
  clickThrough: boolean;
  shareHidden: boolean;
  displayIndex: number;
}

export type SubtitleKind = "partial" | "final";

export interface SubtitleEntry {
  id: string;
  speaker: string;
  /** 原文 · 英文 */
  source: string;
  /** 翻译 · 中文 */
  translation: string;
  kind: SubtitleKind;
  timestamp: number;
}

export type CaptionState =
  | "empty"
  | "single"
  | "multi"
  | "streaming"
  | "disconnected";

interface CaptionSlice {
  settings: CaptionSettings;
  subtitles: SubtitleEntry[];
  state: CaptionState;
  /** 当前 streaming partial（覆盖字幕流） */
  currentPartial: SubtitleEntry | null;

  loadSettings: () => Promise<void>;
  setPosition: (x: number, y: number) => Promise<void>;
  setOpacity: (opacity: number) => Promise<void>;
  setLocked: (locked: boolean) => Promise<void>;
  setClickThrough: (clickThrough: boolean) => Promise<void>;
  setShareHidden: (shareHidden: boolean) => Promise<void>;
  setDisplayIndex: (displayIndex: number) => Promise<void>;

  pushSubtitle: (entry: SubtitleEntry) => void;
  pushPartial: (partial: SubtitleEntry) => void;
  clearSubtitles: () => void;
  setConnectionState: (state: CaptionState) => void;
  /** v0 mock 触发 · 由 URL ?sim= 在 main.tsx 调用 */
  setMockState: (state: CaptionState, entries?: SubtitleEntry[]) => void;
  setMockSettings: (settings: Partial<CaptionSettings>) => void;
}

const DEFAULT_SETTINGS: CaptionSettings = {
  position: null,
  opacity: 82,
  locked: false,
  clickThrough: false,
  shareHidden: false,
  displayIndex: 0,
};

const SAMPLE_ENTRIES: SubtitleEntry[] = [
  {
    id: "1",
    speaker: "Speaker A",
    source: "Let me walk you through the Q4 numbers.",
    translation: "让我给你过一下第四季度的数字。",
    kind: "final",
    timestamp: Date.now() - 12000,
  },
  {
    id: "2",
    speaker: "Speaker B",
    source: "Revenue grew 18% year over year.",
    translation: "收入同比增长 18%。",
    kind: "final",
    timestamp: Date.now() - 8000,
  },
  {
    id: "3",
    speaker: "Speaker A",
    source: "And our gross margin improved to 42%.",
    translation: "我们的毛利率提升到了 42%。",
    kind: "final",
    timestamp: Date.now() - 4000,
  },
];

const SAMPLE_STREAMING: SubtitleEntry = {
  id: "streaming",
  speaker: "Speaker A",
  source: "Looking at the regional break",
  translation: "看一下地区分布",
  kind: "partial",
  timestamp: Date.now(),
};

export const useCaptionStore = create<CaptionSlice>((set) => ({
  settings: DEFAULT_SETTINGS,
  subtitles: [],
  state: "empty",
  currentPartial: null,

  loadSettings: async () => {
    try {
      const s = await getCaptionSettings();
      set({ settings: s });
    } catch (e) {
      console.error("[caption] loadSettings failed:", e);
    }
  },

  setPosition: async (x, y) => {
    set((s) => ({ settings: { ...s.settings, position: { x, y } } }));
    try {
      await setCaptionPosition(x, y);
    } catch (e) {
      console.error("[caption] setPosition failed:", e);
    }
  },

  setOpacity: async (opacity) => {
    set((s) => ({ settings: { ...s.settings, opacity } }));
    try {
      await setCaptionOpacity(opacity);
    } catch (e) {
      console.error("[caption] setOpacity failed:", e);
    }
  },

  setLocked: async (locked) => {
    set((s) => ({ settings: { ...s.settings, locked } }));
    try {
      await setCaptionLocked(locked);
    } catch (e) {
      console.error("[caption] setLocked failed:", e);
    }
  },

  setClickThrough: async (clickThrough) => {
    set((s) => ({ settings: { ...s.settings, clickThrough } }));
    try {
      await setCaptionClickThrough(clickThrough);
    } catch (e) {
      console.error("[caption] setClickThrough failed:", e);
    }
  },

  setShareHidden: async (shareHidden) => {
    set((s) => ({ settings: { ...s.settings, shareHidden } }));
    try {
      await setCaptionShareHidden(shareHidden);
    } catch (e) {
      console.error("[caption] setShareHidden failed:", e);
    }
  },

  setDisplayIndex: async (displayIndex) => {
    set((s) => ({ settings: { ...s.settings, displayIndex } }));
    try {
      await setCaptionDisplayIndex(displayIndex);
    } catch (e) {
      console.error("[caption] setDisplayIndex failed:", e);
    }
  },

  pushSubtitle: (entry) => {
    set((s) => {
      const next = [...s.subtitles, entry].slice(-10); // 保留最近 10 条
      const state = next.length === 0 ? "empty" : next.length === 1 ? "single" : "multi";
      return { subtitles: next, state, currentPartial: null };
    });
  },

  pushPartial: (partial) => {
    set({ currentPartial: partial, state: "streaming" });
  },

  clearSubtitles: () => {
    set({ subtitles: [], currentPartial: null, state: "empty" });
  },

  setConnectionState: (state) => set({ state }),

  setMockState: (state, entries) => {
    if (state === "empty") {
      set({ subtitles: [], currentPartial: null, state });
    } else if (state === "streaming") {
      set({ currentPartial: SAMPLE_STREAMING, state });
    } else if (state === "disconnected") {
      set({ subtitles: [], state });
    } else {
      set({
        subtitles: entries ?? SAMPLE_ENTRIES,
        currentPartial: null,
        state,
      });
    }
  },

  setMockSettings: (settings) => {
    set((s) => ({ settings: { ...s.settings, ...settings } }));
  },
}));
