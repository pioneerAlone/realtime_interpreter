/**
 * Sidebar — left navigation rail for the MainView shell.
 * ----------------------------------------------------------------------
 * T-G-3 ticket #20 — Halo 启发 full-height Sidebar v2：
 *
 * 1. **宽度 200 → 280** (HaloVoice 启发)
 * 2. **顶部 macOS traffic-light 避让 30px** (Open-Less
 *    MAC_TRAFFIC_LIGHT_CLEARANCE = 30, FloatingShell.tsx:50)
 * 3. **5 个 nav 项**（Halo 顺序）：实时翻译 / 通道详情 / 快捷键 / 设置 / 退出
 * 4. **底部 3 段**：
 *    - **场景模式**：3 个 mock toggle（游戏 / 直播 / 会议；v0 不接 TTS/ASR）
 *    - **本月配额**：XX:XX / XX:XX 进度条（mock = "60:00 / 60:00"）
 *    - **用户卡片**：avatar + 用户名 + 在线状态点 + 折叠箭头
 * 5. **3 状态 nav 视觉**：base / hover / active 走 className（不写
 *    inline background — Open-Less 在 FloatingShell.tsx:551-553
 *    明确：「全走 class: sidebar 按钮不写 inline background, :hover /
 *    active 底色才能生效」）
 * 6. **保留 NavItemId enum**（main / channels / hotkeys / about / quit）
 *    以兼容 MainView 现有路由 — 仅 display label 改为 Halo 顺序
 *
 * 不做什么（明确边界）：
 * - 不接场景模式后端（v0 全 mock）
 * - 不接用户登录 / 真实配额
 * - 不做移动端响应式（v0 桌面 1240px 固定）
 * - 不动 MainView 内容（仅 nav 顺序 / label 调整，不动 channel cards 等）
 */

import { Tooltip } from "@/components/ui/Tooltip";
import { Switch } from "@/components/ui/Switch";

export type NavItemId = "main" | "channels" | "hotkeys" | "about" | "quit";

interface NavItem {
  id: NavItemId;
  label: string;
  hint: string;
  icon: string;
}

/* 4 个功能 nav 项 — 顺序按 HaloVoice 启发。
 * 退出单独放在 footer 顶部分隔下方（与用户卡片视觉一致）— 这是
 * Open-Less + Halo 共有的「致命操作放最远」模式。 */
const NAV_ITEMS: NavItem[] = [
  {
    id: "main",
    label: "实时翻译",
    hint: "实时翻译主面板：选择设备、查看翻译状态。",
    icon: "译",
  },
  {
    id: "channels",
    label: "通道详情",
    hint: "查看「我的声音」和「对方声音」两个通道的详细说明。",
    icon: "通",
  },
  {
    id: "hotkeys",
    label: "快捷键",
    hint: "全局快捷键（切换字幕、屏蔽翻译、隐藏字幕）。",
    icon: "键",
  },
  {
    id: "about",
    label: "设置",
    hint: "版本、仓库地址、协议信息。",
    icon: "设",
  },
];

/* 场景模式：3 个 mock toggle（v0 不接 TTS/ASR）。视觉上每个 row 是
 * icon + 名称 + 受控 Switch。HaloVoice 截图中"会议模式"被打开是
 * 我们的默认值（v0 主推场景）。 */
interface SceneRow {
  id: "game" | "live" | "meeting";
  icon: string;
  name: string;
  enabled: boolean;
}

const QUIT_HINT = "退出 realtime_interpreter.";

const DEFAULT_SCENES: SceneRow[] = [
  { id: "meeting", icon: "议", name: "会议模式", enabled: true },
  { id: "live", icon: "播", name: "直播模式", enabled: false },
  { id: "game", icon: "戏", name: "游戏模式", enabled: false },
];

interface SidebarProps {
  active: NavItemId;
  onSelect: (id: NavItemId) => void;
  /** Optional version string for footer chip. */
  version?: string;
  /** 场景模式 toggle 状态（受控，由 MainView 持有以支持后续持久化） */
  scenes?: SceneRow[];
  onSceneToggle?: (id: SceneRow["id"], enabled: boolean) => void;
  /** 配额（受控；不传则用 mock 默认值） */
  quota?: { used: number; total: number };
  /** 用户信息（受控；不传则用 mock 默认值） */
  user?: { name: string; status: string; initial: string };
}

export function Sidebar({
  active,
  onSelect,
  version,
  scenes = DEFAULT_SCENES,
  onSceneToggle,
  quota = { used: 60, total: 60 },
  user = { name: "bakewell", status: "在线", initial: "b" },
}: SidebarProps) {
  const quotaPct = Math.max(0, Math.min(100, (quota.used / quota.total) * 100));

  return (
    <aside className="rt-sidebar" aria-label="Primary navigation">
      <div className="rt-sidebar__brand">
        <span className="rt-sidebar__brand-mark" aria-hidden>◐</span>
        <span className="rt-sidebar__brand-name">realtime_interpreter</span>
        {version && <span className="rt-sidebar__brand-version">v{version}</span>}
      </div>

      <nav className="rt-sidebar__nav">
        {NAV_ITEMS.filter((i) => i.id !== "quit").map((item) => {
          const isActive = item.id === active;
          return (
            <Tooltip key={item.id} content={item.hint} wrap>
              <button
                type="button"
                className={`rt-sidebar__nav-btn${isActive ? " rt-sidebar__nav-btn--active" : ""}`}
                aria-current={isActive ? "page" : undefined}
                onClick={() => onSelect(item.id)}
              >
                <span className="rt-sidebar__nav-icon" aria-hidden>
                  {item.icon}
                </span>
                <span className="rt-sidebar__nav-label">{item.label}</span>
              </button>
            </Tooltip>
          );
        })}
      </nav>

      {/* Footer: 4 段（场景模式 / 配额 / 用户卡片 / 退出） — Halo + Open-Less 启发
       *  - 场景模式：3 个 mock toggle
       *  - 配额：进度条 + 文本
       *  - 用户卡片：avatar + 名字 + 状态 + 折叠箭头
       *  - 退出：最后一项，独立 .rt-sidebar__quit 块（与 nav 视觉断开） */}
      <div className="rt-sidebar__footer">
        {/* 场景模式：3 个 mock toggle */}
        <div className="rt-sidebar__scene" role="group" aria-label="场景模式">
          <div className="rt-sidebar__scene-label">场景模式</div>
          {scenes.map((scene) => (
            <div key={scene.id} className="rt-sidebar__scene-row">
              <span className="rt-sidebar__scene-icon" aria-hidden>
                {scene.icon}
              </span>
              <span className="rt-sidebar__scene-name">{scene.name}</span>
              <Switch
                on={scene.enabled}
                onChange={
                  onSceneToggle
                    ? (next) => onSceneToggle(scene.id, next)
                    : undefined
                }
                ariaLabel={`${scene.name} toggle`}
              />
            </div>
          ))}
        </div>

        {/* 本月配额：进度条 + 文本 */}
        <div className="rt-sidebar__quota" aria-label="本月配额">
          <div className="rt-sidebar__quota-label">
            <span>本月剩余</span>
          </div>
          <div
            className="rt-sidebar__quota-bar"
            role="progressbar"
            aria-valuenow={quota.used}
            aria-valuemin={0}
            aria-valuemax={quota.total}
          >
            <div
              className="rt-sidebar__quota-fill"
              style={{ width: `${quotaPct}%` }}
            />
          </div>
          <div className="rt-sidebar__quota-text">
            <span>
              {quota.used.toString().padStart(2, "0")}:00 /{" "}
              {quota.total.toString().padStart(2, "0")}:00
            </span>
            <span>{Math.round(quotaPct)}%</span>
          </div>
        </div>

        {/* 用户卡片：avatar + 名字 + 状态 + 折叠箭头 */}
        <div
          className="rt-sidebar__user"
          role="button"
          tabIndex={0}
          aria-label={`${user.name}，${user.status}，点击展开菜单`}
        >
          <div className="rt-sidebar__user-avatar" aria-hidden>
            {user.initial}
            <span className="rt-sidebar__user-avatar-dot" aria-hidden />
          </div>
          <div className="rt-sidebar__user-info">
            <span className="rt-sidebar__user-name">{user.name}</span>
            <span className="rt-sidebar__user-status">{user.status}</span>
          </div>
          <span className="rt-sidebar__user-chevron" aria-hidden>▾</span>
        </div>

        {/* 退出按钮：footer 最底，柔和红 danger 样式 */}
        <Tooltip content={QUIT_HINT} wrap>
          <button
            type="button"
            className="rt-sidebar__nav-btn rt-sidebar__nav-btn--danger"
            onClick={() => onSelect("quit")}
          >
            <span className="rt-sidebar__nav-icon" aria-hidden>退</span>
            <span className="rt-sidebar__nav-label">退出</span>
          </button>
        </Tooltip>
      </div>
    </aside>
  );
}

export type { SceneRow };
