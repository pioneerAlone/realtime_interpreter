/**
 * StatusBar — IDE-style 28px footer summary.
 *
 * Shows live snapshot of:
 *  - 音频检查 verdict
 *  - 我的声音 / 对方声音 channel state
 *
 * Each segment is a click-target that jumps the sidebar to the
 * relevant nav item.
 */

import { useTopologyStore } from "@/store/topology";
import { useSessionStore } from "@/store/session";
import type { NavItemId } from "@/components/Sidebar";

interface StatusBarProps {
  onNavigate: (id: NavItemId) => void;
}

function verdictChip(verdict: string | undefined, count: number | undefined): {
  label: string;
  color: string;
} {
  if (!verdict) return { label: "音频检查中…", color: "var(--text-secondary)" };
  const c = count ?? 0;
  if (verdict === "pass") return { label: `音频: 已就绪 (${c} 设备)`, color: "var(--accent-green)" };
  if (verdict === "warn")
    return { label: `音频: 可启动 (${c} 设备)`, color: "var(--accent-amber)" };
  return { label: `音频: 需要修正 (${c} 设备)`, color: "var(--accent-red)" };
}

export function StatusBar({ onNavigate }: StatusBarProps) {
  const verdict = useTopologyStore((s) => s.status?.verdict);
  const deviceCount = useTopologyStore((s) => s.status?.devices.length);
  const r3 = useSessionStore((s) => s.r3);
  const r4 = useSessionStore((s) => s.r4);

  const top = verdictChip(verdict, deviceCount);

  return (
    <footer className="rt-statusbar" aria-label="Status bar">
      <button
        type="button"
        className="rt-statusbar__chip"
        onClick={() => onNavigate("setup")}
        title="打开音频设置"
      >
        <span className="rt-statusbar__chip-dot" style={{ background: top.color }} aria-hidden />
        <span>{top.label}</span>
      </button>

      <button
        type="button"
        className="rt-statusbar__chip"
        onClick={() => onNavigate("channels")}
        title="查看通道详情"
      >
        <span
          className="rt-statusbar__chip-dot"
          style={{ background: r3 === "running" ? "var(--accent-green)" : r3 === "error" ? "var(--accent-red)" : "var(--text-tertiary)" }}
          aria-hidden
        />
        <span>我的声音: {r3 === "idle" ? "未启动" : r3}</span>
      </button>

      <button
        type="button"
        className="rt-statusbar__chip"
        onClick={() => onNavigate("channels")}
        title="查看通道详情"
      >
        <span
          className="rt-statusbar__chip-dot"
          style={{ background: r4 === "running" ? "var(--accent-green)" : r4 === "error" ? "var(--accent-red)" : "var(--text-tertiary)" }}
          aria-hidden
        />
        <span>对方声音: {r4 === "idle" ? "未启动" : r4}</span>
      </button>

      <div className="rt-statusbar__spacer" />
    </footer>
  );
}