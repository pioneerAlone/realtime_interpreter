import { create } from "zustand";
import { getPreferences, savePreset, setActivePreset } from "../lib/ipc";

/**
 * presets.ts — preset state（T-G-04 接入持久化）
 *
 * 真实持久化通过 Tauri IPC：
 *   - getPreferences()  on init 加载
 *   - savePreset()       on 编辑
 *   - setActivePreset()  on 切换 active
 *
 * 不接 Keychain / preferences.json 直写 · 都走 Tauri 命令 · Rust 侧用
 * `~/Library/Application Support/com.pioneeralone.realtime-interpreter/preferences.json`。
 *
 * 决策来源: `.scratch/gui-rebuild-v0.md` §4.6 + §10.1 T-G-04
 * Ticket:    #30 (T-G-04)
 */

export interface Preset {
  id: string;
  name: string;
  status: "active" | "disabled-stub";
  progress: number;
  devices: {
    microphone: string;
    translationOutput: string;
    remoteInput: string;
    monitor: string;
  };
  r3Direction: "zh→en" | "en→zh";
  r4Caption: "bilingual-stacked";
  description: string;
  lastLaunched: string;
  launchCount: number;
}

export interface Preferences {
  schemaVersion: number;
  activeId: string;
  presets: Preset[];
}

interface PresetSlice {
  /** 已加载标志 · 避免 init 前误用 */
  loaded: boolean;
  presets: Preset[];
  activeId: string;
  /** 启动 Tauri IPC 加载 · 应用启动时调用一次 */
  load: () => Promise<void>;
  setActive: (id: string) => Promise<void>;
  save: (preset: Preset) => Promise<void>;
  /** sync version · 不等 Tauri · 立即更新 UI + 后台持久化 */
  setActiveSync: (id: string) => void;
  saveSync: (preset: Preset) => void;
}

export const usePresetStore = create<PresetSlice>((set, get) => ({
  loaded: false,
  presets: [],
  activeId: "",

  load: async () => {
    try {
      const prefs = await getPreferences();
      set({
        loaded: true,
        presets: prefs.presets,
        activeId: prefs.activeId,
      });
    } catch (e) {
      console.error("[presets] load failed:", e);
      set({ loaded: true, presets: [], activeId: "" });
    }
  },

  setActive: async (id) => {
    const prev = get().activeId;
    set({ activeId: id });
    try {
      await setActivePreset(id);
    } catch (e) {
      console.error("[presets] setActive failed:", e);
      set({ activeId: prev });
    }
  },

  save: async (preset) => {
    const prev = get().presets.find((p) => p.id === preset.id);
    set((s) => ({
      presets: s.presets.map((p) => (p.id === preset.id ? preset : p)),
    }));
    try {
      await savePreset(preset);
    } catch (e) {
      console.error("[presets] save failed:", e);
      if (prev) {
        set((s) => ({
          presets: s.presets.map((p) => (p.id === preset.id ? prev : p)),
        }));
      }
    }
  },

  // sync versions: 不等 Tauri · 立即更新 UI · 后台 save
  setActiveSync: (id) => {
    set({ activeId: id });
    void setActivePreset(id).catch((e) =>
      console.error("[presets] setActiveSync background failed:", e),
    );
  },

  saveSync: (preset) => {
    set((s) => ({
      presets: s.presets.map((p) => (p.id === preset.id ? preset : p)),
    }));
    void savePreset(preset).catch((e) =>
      console.error("[presets] saveSync background failed:", e),
    );
  },
}));
