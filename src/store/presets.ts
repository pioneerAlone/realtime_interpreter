import { create } from "zustand";

/**
 * presets.ts — preset state（T-G-03）
 *
 * v0 mock state · 不持久化 · 不接 Keychain · 真实持久化属于 T-G-04。
 *
 * 决策来源: `.scratch/gui-rebuild-v0.md` §4 (preset 列表) + §10.1 T-G-03
 * Ticket:    #28 (T-G-03)
 */

export interface Preset {
  id: string;
  name: string;
  /** v0 stub: 'active' | 'disabled-stub' · 区分可用 vs v1 待实装 */
  status: "active" | "disabled-stub";
  /** 0..100 · 默认 0 (空环) */
  progress: number;
  /** 4 picker 当前选择 · id 对应 MOCK_DEVICES 中的 id */
  devices: {
    microphone: string;
    translationOutput: string;
    remoteInput: string;
    monitor: string;
  };
  /** R3 翻译方向（v0 hardcode 中↔英）· 真实配置属于 T-G-04 */
  r3Direction: "zh→en" | "en→zh";
  /** R4 字幕格式（v0 hardcode 双语 stacked）· 真实配置属于 T-G-04 */
  r4Caption: "bilingual-stacked";
  /** 简介（stub）· 真实编辑属于 T-G-04 */
  description: string;
  /** 上次启动时间戳（mock · stub） */
  lastLaunched: string;
  /** 上次启动次数（mock · stub） */
  launchCount: number;
}

interface PresetSlice {
  presets: Preset[];
  /** 当前激活的 preset id（v0 只有 1 个 · 多 preset 切换属于 v0.1） */
  activeId: string;
  setActive: (id: string) => void;
}

const DEFAULT_PRESET: Preset = {
  id: "daily-meeting",
  name: "日常会议",
  status: "active",
  progress: 100,
  devices: {
    microphone: "macbook-mic",
    translationOutput: "blackhole-2ch",
    remoteInput: "vb-cable",
    monitor: "iflybuds-nano",
  },
  r3Direction: "zh→en",
  r4Caption: "bilingual-stacked",
  description: "v0 默认配置。适合一般商务会议 / 1v1 沟通。",
  lastLaunched: "3 天前",
  launchCount: 4,
};

const STUB_PRESETS: Preset[] = [
  {
    id: "demo-mode",
    name: "演示模式",
    status: "disabled-stub",
    progress: 25,
    devices: DEFAULT_PRESET.devices,
    r3Direction: "zh→en",
    r4Caption: "bilingual-stacked",
    description: "演示场景（即将推出）。",
    lastLaunched: "—",
    launchCount: 0,
  },
  {
    id: "one-on-one",
    name: "1v1 沟通",
    status: "disabled-stub",
    progress: 0,
    devices: DEFAULT_PRESET.devices,
    r3Direction: "zh→en",
    r4Caption: "bilingual-stacked",
    description: "1v1 沟通场景（即将推出）。",
    lastLaunched: "—",
    launchCount: 0,
  },
];

export const usePresetStore = create<PresetSlice>((set) => ({
  presets: [DEFAULT_PRESET, ...STUB_PRESETS],
  activeId: DEFAULT_PRESET.id,
  setActive: (id) => set({ activeId: id }),
}));
