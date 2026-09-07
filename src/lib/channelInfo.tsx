/**
 * Channel info — central definition of the R3 / R4 long-form
 * descriptions, startup conditions, dependencies, and error modes.
 *
 * One source of truth so the ChannelCard, status bar, and future
 * docs auto-sync. Anything that the user might ask about a channel
 * lives here.
 */

export interface ChannelInfo {
  /** Short label ("R3 A-channel"). */
  shortLabel: string;
  /** Full name for accessibility / tooltip. */
  fullName: string;
  /** Title shown in card header. */
  title: string;
  /** One-line summary shown in the card body. */
  summary: string;
  srcLang: string;
  tgtLang: string;
  /** Latency target as human-readable string. */
  latencyTarget: string;
  startupConditions: string[];
  /** Dependency ticket labels (#08 etc.). */
  dependencies: string[];
  /** Common error modes + handling. */
  errorModes: string[];
  /** Long-form inline description (also shown in ⓘ tooltip). */
  longDescription: string;
}

export const R3_INFO: ChannelInfo = {
  shortLabel: "R3 A-channel",
  fullName: "R3 A-channel (zh→en realtime s2s)",
  title: "你 → 客户 (s2s)",
  summary: "你说中文，会议软件以你的英文音色输出。链路：mic → AGC → Doubao S2S WS → OGG → opus 解码 → ring buffer → VAC。",
  srcLang: "中文 (zh)",
  tgtLang: "英文 (en)",
  latencyTarget: "≤ 3 s first-sound median (v0 软目标，v1 cascade 收 ≤ 2 s)",
  startupConditions: [
    "Topology pre-flight = OK 或 OK-with-warnings",
    "Doubao API key 已设置 (macOS Keychain)",
    "Mic 未被静音、未被其他 app 独占占用",
    "会议软件麦克风输入 = R3 输出虚拟声卡 (黑名单: 实麦克风)",
    "BlackHole 2ch 在 Audio MIDI Setup 中启用",
  ],
  dependencies: [
    "#08 内联 OGG demuxer (opus crate 流式解码)",
    "#09 2-header auth (X-Api-Key + X-Api-Resource-Id)",
    "#10 Protobuf 重生成 (prost，从 Doppelvoice .proto)",
    "#11 原声直出 parallel-route 安全路由 (D24)",
  ],
  errorModes: [
    "API 401: 鉴权失败 → 检查 Keychain 中 API key + resource_id",
    "API 429: 配额超限 → Doubao 控制台查看用量",
    "RTT >500 ms: 网络抖动 → 警告「请插网线」",
    "BlackHole 16ch 占用: 16ch 同名冲突 → 重启 coreaudiod",
    "OGG 解码失败: 服务器返回非 ogg_opus → 自动重连 (重连策略见 D30-Q3)",
  ],
  longDescription:
    "A-channel R3 是 realtime 双通道中的「你说 → 对方听」通道。" +
    "你说中文，mic 捕获到 cpal 流 (48 kHz)，AGC 做 −16 dBFS peak-tracker (attack 5 ms, release 100 ms) + " +
    "limiter −3 dBFS。AGC 之后帧 40 ms 切片通过 tokio-tungstenite 上行到 Doubao 同传 2.0 S2S endpoint " +
    "(wss://openspeech.bytedance.com/api/v4/ast/v2/translate, mode=s2s, speaker_id=\"\" 即时零样本音色复刻)。" +
    "下行二进制 OGG/Opus 流经 ~50 LoC 内联 demuxer + opus crate 解码到 PCM，crossbeam-channel SPSC ring buffer " +
    "(40 ms 初始蓄能)，cpal 写入 BlackHole 2ch 输出。会议软件麦克风输入选 BlackHole 2ch 即可听到你的英文。" +
    "v0 ≤ 3 s first-sound median 是软目标，D30 lock 的 6 项配置级优化 (preconnect / keep-alive / VAD 0.3-0.4 / " +
    "opus 流式 / 直连 / 单 OS 设备) 追 v1 的 2 s。"
};

export const R4_INFO: ChannelInfo = {
  shortLabel: "R4 B-channel",
  fullName: "R4 B-channel (en→zh realtime s2t 字幕)",
  title: "客户 → 字幕 (s2t)",
  summary: "对方说英文，你看到中英双语字幕悬浮窗。链路：BlackHole 16ch loopback → Rubato 48→16 kHz resample → Doubao S2T WS → event 650-655 → Subtitle store → NSPanel。",
  srcLang: "英文 (en)",
  tgtLang: "中文 (zh)",
  latencyTarget: "subtitle event emit ≤ 1.5 s after speaker start (D18 soft)",
  startupConditions: [
    "Topology pre-flight = OK 或 OK-with-warnings",
    "Doubao API key 已设置 (macOS Keychain)",
    "BlackHole 16ch 已安装并被会议软件选为 speaker output",
    "Aggregate Device 在 Audio MIDI Setup 中正确组合 (real headphones + BlackHole 16ch)",
    "字幕窗未被用户禁用 (tray menu / hotkey)",
  ],
  dependencies: [
    "#05 B-channel 字幕 UI (Tauri-NSPanel + Zustand + 650-655 events)",
    "#09 2-header auth (X-Api-Key + X-Api-Resource-Id)",
    "#10 Protobuf 重生成 (prost，从 Doppelvoice .proto)",
    "#11 原声直出 parallel-route 安全路由 (D24, headphones 总是听对方原声)",
  ],
  errorModes: [
    "字幕窗不显示: NSPanel 转换 panic (catch_unwind) → 重启 app",
    "字幕滞后 > 3 s: 网络 RTT 升高 → 检查 Wi-Fi",
    "event 650 (start) 但无 655 (end): 对方静音超时 → 显示半句",
    "字幕乱码: Protobuf 序列化错 → 检查 #10 重新生成的 bindings",
    "BlackHole 16ch 占用: 同 R3",
  ],
  longDescription:
    "B-channel R4 是 realtime 双通道中的「对方说 → 你看字幕」通道。" +
    "会议软件 speaker 输出走 BlackHole 16ch loopback (D13 锁的「virtual sound card」实现 + D25 锁的 Aggregate Device " +
    "组合方案，避免用 ScreenCaptureKit)。cpal loopback 读 48 kHz 流，Rubato resample 48→16 kHz (Doubao S2T 接受率)，" +
    "tokio-tungstenite 上行到 Doubao 同传 2.0 S2T endpoint (mode=s2t, denoise=false 在 v0)。下行 Protobuf 事件 650 " +
    "(transcription start) / 651 (partial) / 652 (translation start) / 653 / 654 / 655 (end)，doubao::event::Decoder " +
    "解析后通过 app.emit(\"subtitle:append\", Subtitle) 推到 React。Zustand `subtitles` store 累积，SubtitleWindow " +
    "(tauri-nspanel 转换的 NSPanel) 重渲染。Hotkey `Right Option` toggle 显示 / 隐藏；`Ctrl+Alt+H` 直接隐藏。" +
    "D24 原声直出 parallel-route: headphones 总是听对方原声英文，bypass 关闭时字幕同步上屏。"
};