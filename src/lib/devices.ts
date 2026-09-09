/**
 * devices.ts — 4 设备 mock 数据（T-G-03）
 *
 * v0 不接真实 enumerateDevices()（属于 audio pipeline scope）· T-G-03 仅用 mock。
 * 真实设备枚举 + 黑名单/白名单属于 T-G-04 preset 数据层范围。
 *
 * 决策来源: `.scratch/gui-rebuild-v0.md` §2.3 (4 picker 语义) + §13 (v0 音频架构修正)
 * Ticket:    #28 (T-G-03)
 */

/** 单个音频设备的 mock 表示（v0 不含 ID / sampleRate / channels · 属于 audio 范围） */
export interface MockDevice {
  id: string;
  name: string;
  isVirtual: boolean;
}

/** 4 picker 各自的设备列表（v0 mock · 真实枚举在 audio pipeline 接入后） */
export const MOCK_DEVICES = {
  /** R3 上行源 · 麦克风（Q2.3 picker 1） */
  microphone: [
    { id: "macbook-mic", name: "MacBook Air 麦克风 (Built-in)", isVirtual: false },
    { id: "iflybuds-nano", name: "iFLYBUDS Nano+", isVirtual: false },
    { id: "airpods-pro", name: "AirPods Pro", isVirtual: false },
    { id: "blackhole-2ch", name: "BlackHole 2ch", isVirtual: true },
  ] as ReadonlyArray<MockDevice>,

  /** R3 TTS 输出目的 = Teams 麦克风绑定值（Q2.3 picker 2） */
  translationOutput: [
    { id: "blackhole-2ch", name: "BlackHole 2ch", isVirtual: true },
    { id: "vb-cable", name: "VB-Cable", isVirtual: true },
  ] as ReadonlyArray<MockDevice>,

  /** R4 回采源 = Teams 扬声器绑定值（Q2.3 picker 3） */
  remoteInput: [
    { id: "vb-cable", name: "VB-Cable", isVirtual: true },
    { id: "blackhole-16ch", name: "BlackHole 16ch", isVirtual: true },
  ] as ReadonlyArray<MockDevice>,

  /** bypass 直出目的 = 你听对端原声（Q2.3 picker 4） */
  monitor: [
    { id: "iflybuds-nano", name: "iFLYBUDS Nano+", isVirtual: false },
    { id: "macbook-speaker", name: "MacBook 扬声器", isVirtual: false },
    { id: "airpods-pro", name: "AirPods Pro", isVirtual: false },
  ] as ReadonlyArray<MockDevice>,
} as const;

/** picker 语义对应的标签 + 流向后端 + wire-hint 提示文本 */
export const PICKER_META = {
  microphone: {
    label: "麦克风输入",
    icon: "♪",
    flow: "→ R3 上行",
    wireHint: null,
  },
  translationOutput: {
    label: "翻译输出",
    icon: "🔊",
    flow: "← R3 TTS",
    wireHint: "Teams 麦克风 绑定这里",
  },
  remoteInput: {
    label: "对方声音输入",
    icon: "☁",
    flow: "→ R4 回采",
    wireHint: "Teams 扬声器 绑定这里",
  },
  monitor: {
    label: "对端监听",
    icon: "🎧",
    flow: "← bypass 直出",
    wireHint: "R4 直通 · 0 延迟听原声",
  },
} as const;

export type PickerKey = keyof typeof MOCK_DEVICES;
