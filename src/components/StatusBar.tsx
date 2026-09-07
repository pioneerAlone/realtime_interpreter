/**
 * StatusBar — IDE-style 28px footer summary.
 *
 * Shows live snapshot of:
 *  - Topology verdict (OK / warn / fail + observed devices count)
 *  - R3 channel state (idle / running / error)
 *  - R4 channel state (idle / running / error)
 *  - Hotkey readiness (granted / pending / denied)
 *
 * Each segment is a click-target that jumps the sidebar to the
 * relevant nav item — same pattern as VS Code's status bar.
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
  if (!verdict) return { label: "Topology: checking…", color: "var(--text-secondary)" };
  const c = count ?? 0;
  if (verdict === "pass") return { label: `Topology: OK (${c} devices)`, color: "var(--accent-green)" };
  if (verdict === "warn")
    return { label: `Topology: warn (${c} devices)`, color: "var(--accent-amber)" };
  return { label: `Topology: blocking (${c} devices)`, color: "var(--accent-red)" };
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
        title="Click to open Setup"
      >
        <span className="rt-statusbar__chip-dot" style={{ background: top.color }} aria-hidden />
        <span>{top.label}</span>
      </button>

      <button
        type="button"
        className="rt-statusbar__chip"
        onClick={() => onNavigate("channels")}
        title="Click to open Channels"
      >
        <span
          className="rt-statusbar__chip-dot"
          style={{ background: r3 === "running" ? "var(--accent-green)" : r3 === "error" ? "var(--accent-red)" : "var(--text-tertiary)" }}
          aria-hidden
        />
        <span>R3: {r3}</span>
      </button>

      <button
        type="button"
        className="rt-statusbar__chip"
        onClick={() => onNavigate("channels")}
        title="Click to open Channels"
      >
        <span
          className="rt-statusbar__chip-dot"
          style={{ background: r4 === "running" ? "var(--accent-green)" : r4 === "error" ? "var(--accent-red)" : "var(--text-tertiary)" }}
          aria-hidden
        />
        <span>R4: {r4}</span>
      </button>

      <div className="rt-statusbar__spacer" />

      <button
        type="button"
        className="rt-statusbar__chip rt-statusbar__chip--muted"
        onClick={() => onNavigate("hotkeys")}
        title="Click to open Hotkeys"
      >
        <span className="rt-statusbar__kbd">⌥</span>
        <span className="rt-statusbar__kbd">⌃</span>
        <span className="rt-statusbar__kbd">⌥</span>
        <span className="rt-statusbar__kbd">P</span>
        <span className="rt-statusbar__kbd">⌃</span>
        <span className="rt-statusbar__kbd">⌥</span>
        <span className="rt-statusbar__kbd">H</span>
        <span className="rt-statusbar__chip-hint">Hotkeys</span>
      </button>
    </footer>
  );
}