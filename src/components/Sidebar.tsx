/**
 * Sidebar — left navigation rail for the MainView shell.
 *
 * Mirrors Open-Less FloatingShell's `<aside>` structure (5-tab single-
 * layer navigation): logo + product name at top, then a vertical list
 * of nav buttons, then footer with Quit.
 *
 * Active state is controlled by the parent (`MainView`) — Sidebar is
 * presentational only.
 *
 * Token names follow Open-Less `tokens.css` convention so the visual
 * feel matches even though we don't ship OL's tokens verbatim:
 *   --ol-surface / --ol-line / --ol-ink / --ol-blue
 *   (mapped to our CSS vars in styles.css)
 */

import { Tooltip } from "@/components/ui/Tooltip";

export type NavItemId = "setup" | "channels" | "hotkeys" | "about" | "quit";

interface NavItem {
  id: NavItemId;
  label: string;
  hint: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "setup",
    label: "Setup",
    hint: "Pre-flight topology check + device wiring (4 device pickers).",
    icon: "⚙",
  },
  {
    id: "channels",
    label: "Channels",
    hint: "R3 A-channel (zh→en s2s) + R4 B-channel (en→zh s2t 字幕).",
    icon: "🎙",
  },
  {
    id: "hotkeys",
    label: "Hotkeys",
    hint: "Global keyboard shortcuts (toggle subtitle, bypass, hide).",
    icon: "⌨",
  },
  {
    id: "about",
    label: "About",
    hint: "Version, repository, license, attribution.",
    icon: "ℹ",
  },
  {
    id: "quit",
    label: "Quit",
    hint: "退出 realtime_interpreter.",
    icon: "⏻",
  },
];

interface SidebarProps {
  active: NavItemId;
  onSelect: (id: NavItemId) => void;
  /** Optional version string for footer chip. */
  version?: string;
}

export function Sidebar({ active, onSelect, version }: SidebarProps) {
  return (
    <aside className="rt-sidebar" aria-label="Primary navigation">
      <div className="rt-sidebar__brand">
        <span className="rt-sidebar__brand-mark" aria-hidden>◐</span>
        <span className="rt-sidebar__brand-name">realtime_interpreter</span>
        {version && <span className="rt-sidebar__brand-version">v{version}</span>}
      </div>

      <nav className="rt-sidebar__nav">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === active;
          // The Quit item is rendered as a footer button (not part of
          // the main nav) so we skip the active styling on it.
          if (item.id === "quit") return null;
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

      <div className="rt-sidebar__footer">
        {NAV_ITEMS.filter((i) => i.id === "quit").map((item) => (
          <Tooltip key={item.id} content={item.hint} wrap>
            <button
              type="button"
              className="rt-sidebar__nav-btn rt-sidebar__nav-btn--danger"
              onClick={() => onSelect(item.id)}
            >
              <span className="rt-sidebar__nav-icon" aria-hidden>
                {item.icon}
              </span>
              <span className="rt-sidebar__nav-label">{item.label}</span>
            </button>
          </Tooltip>
        ))}
      </div>
    </aside>
  );
}