/**
 * Sidebar — left navigation rail for the MainView shell.
 * ----------------------------------------------------------------------
 * v0.1 收尾 (2026-09-08 用户反馈) — Open-Less 极简风：
 *  - 宽度 280 → 200 (Open-Less SIDEBAR_WIDTH = 188 → 凑整 200)
 *  - icon: 1 个中文字 → lucide-react 14px 真图标 (Languages / Cable /
 *    Keyboard / Settings)
 *  - brand: 去掉 v0.0.1 chip (版本信息进 "设置" 页)
 *  - footer: 砍掉场景模式 / 配额 / 用户卡片 (v0 全部 mock 都不要)
 *  - footer: 只剩「退出」1 个按钮 (Open-Less 极简模式)
 *  - 会议模式 toggle 移到 Main 区顶部 SettingRow (见 MainView.tsx)
 *
 * 保留的视觉契约：
 *  - 顶部 macOS traffic-light 避让 30px
 *  - 3 状态 nav 视觉 (base / hover / active 走 className —
 *    Open-Less FloatingShell.tsx:551-553 纪律)
 *  - 退出按钮柔和红 danger 样式
 *
 * 不做什么（明确边界）：
 *  - 不接用户登录 / 配额 / 场景模式后端 (v0 全 mock)
 *  - 不做移动端响应式 (v0 桌面 1240px 固定)
 */

import {
  Cable,
  Keyboard,
  Languages,
  LogOut,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItemId = "main" | "channels" | "hotkeys" | "about" | "quit";

interface NavItem {
  id: NavItemId;
  label: string;
  hint: string;
  Icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "main",
    label: "实时翻译",
    hint: "实时翻译主面板：选择设备、查看翻译状态。",
    Icon: Languages,
  },
  {
    id: "channels",
    label: "通道详情",
    hint: "查看「我的声音」和「对方声音」两个通道的详细说明。",
    Icon: Cable,
  },
  {
    id: "hotkeys",
    label: "快捷键",
    hint: "全局快捷键（切换字幕、屏蔽翻译、隐藏字幕）。",
    Icon: Keyboard,
  },
  {
    id: "about",
    label: "设置",
    hint: "版本、仓库地址、协议信息。",
    Icon: Settings,
  },
];

const QUIT_HINT = "退出 realtime_interpreter.";

interface SidebarProps {
  active: NavItemId;
  onSelect: (id: NavItemId) => void;
}

export function Sidebar({ active, onSelect }: SidebarProps) {
  return (
    <aside className="rt-sidebar" aria-label="Primary navigation">
      <div className="rt-sidebar__brand">
        <span className="rt-sidebar__brand-mark" aria-hidden>◐</span>
        <span className="rt-sidebar__brand-name">realtime_interpreter</span>
      </div>

      <nav className="rt-sidebar__nav">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              className={`rt-sidebar__nav-btn${isActive ? " rt-sidebar__nav-btn--active" : ""}`}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onSelect(item.id)}
              title={item.hint}
            >
              <item.Icon
                className="rt-sidebar__nav-icon"
                size={14}
                strokeWidth={1.75}
                aria-hidden
              />
              <span className="rt-sidebar__nav-label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="rt-sidebar__footer">
        <button
          type="button"
          className="rt-sidebar__nav-btn rt-sidebar__nav-btn--danger"
          onClick={() => onSelect("quit")}
          title={QUIT_HINT}
        >
          <LogOut
            className="rt-sidebar__nav-icon"
            size={14}
            strokeWidth={1.75}
            aria-hidden
          />
          <span className="rt-sidebar__nav-label">退出</span>
        </button>
      </div>
    </aside>
  );
}
