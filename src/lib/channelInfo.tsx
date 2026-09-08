/**
 * Channel info — central definition of the two audio channels.
 *
 * Per session policy: end-users must NEVER see technical channel
 * code names (R3, R4, A-channel, B-channel, s2s, s2t, VAC, etc.)
 * — those belong to engineering docs, not to a product surface.
 * `internalName` is exposed only via `data-channel` HTML attributes
 * so devs can grep the DOM, never as visible text.
 *
 * One source of truth so the ChannelCard, Live Stage, status bar,
 * and future docs auto-sync. Anything the user might ask about a
 * channel lives here.
 */

export interface ChannelInfo {
  /** Internal dev reference (e.g. "R3 A-channel"). Never shown to
   *  end-users; only included as `data-channel` HTML attr so devs
   *  can grep the DOM. */
  internalName: string;
  /** User-facing title ("我的声音"). Always shown. */
  title: string;
  /** User-facing one-line summary. */
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
  internalName: "R3 A-channel",
  title: "我的声音",
  summary: "把中文翻译成英文，让会议里的其他人听到你说话。",
  srcLang: "中文",
  tgtLang: "英文",
  latencyTarget: "≤ 3 秒（首音延迟）",
  startupConditions: [
    "麦克风权限已授权（系统设置 → 麦克风）",
    "会议软件选了虚拟声卡作为麦克风输入",
    "API key 已配置",
  ],
  dependencies: [
    "#08 OGG 解码",
    "#09 鉴权",
    "#10 消息格式",
  ],
  errorModes: [
    "鉴权失败：请检查 API key",
    "网络卡顿（延迟 > 500 ms）：建议改用有线网络",
    "虚拟声卡被其他应用占用：请重启音频服务",
  ],
  longDescription:
    "这个通道负责把你的声音从中文翻译成英文，让会议软件像听到「你说的英文」那样工作。" +
    "我们采集你的麦克风音频，做音量均衡和静音抑制，然后实时发送到翻译服务。" +
    "翻译后的英文通过虚拟声卡输出，会议软件把虚拟声卡当作你的麦克风输入，" +
    "所以别人听到的是翻译后的英文（保留你的音色）。整个流程延迟 ≤ 3 秒。"
};

export const R4_INFO: ChannelInfo = {
  internalName: "R4 B-channel",
  title: "对方声音",
  summary: "把对方的英文翻译成中英双语字幕，显示在屏幕上。",
  srcLang: "英文",
  tgtLang: "中文",
  latencyTarget: "≤ 1.5 秒（字幕上屏延迟）",
  startupConditions: [
    "会议软件选了虚拟声卡作为扬声器输出",
    "耳机和虚拟声卡组合好了（Audio MIDI Setup）",
    "API key 已配置",
  ],
  dependencies: [
    "#05 字幕窗 UI",
    "#09 鉴权",
    "#10 消息格式",
  ],
  errorModes: [
    "字幕不显示：检查虚拟声卡是否被会议软件使用",
    "字幕滞后（> 3 秒）：网络问题，建议改有线",
    "字幕乱码：联系反馈（可能需要重装）",
  ],
  longDescription:
    "这个通道负责把会议里其他人的英文实时翻译成字幕，显示在你的屏幕上。" +
    "我们捕获会议软件输出的音频（通过虚拟声卡），发送给翻译服务，" +
    "翻译结果（中英文双语）实时滚动显示。" +
    "你戴耳机听原声英文 + 看字幕，听觉和视觉同步。"
};