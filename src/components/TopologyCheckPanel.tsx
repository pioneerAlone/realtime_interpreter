/**
 * TopologyCheckPanel — red/amber/green topology check UI
 * with per-row actionable fix text.
 *
 * Spec reference: docs/spec/v0/01-architecture.md §7 +
 * docs/spec/v0/06-deliverables.md §3.1.
 *
 * Renders inside MainView (main window). The capsule window does
 * NOT show this panel -- the floating subtitle is a passive
 * display; the topology check UI lives in the main window.
 */

import { useEffect, useMemo } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  useTopologyStore,
  type TopologyCheckResult,
} from "@/store/topology";

type Verdict = "pass" | "warn" | "fail";

const VERDICT_COLOR: Record<Verdict, string> = {
  pass: "var(--accent-green, #22c55e)",
  warn: "var(--accent-amber, #f59e0b)",
  fail: "var(--accent-red, #ef4444)",
};

const VERDICT_LABEL: Record<Verdict, string> = {
  pass: "OK",
  warn: "OK with warnings",
  fail: "Blocking issues",
};

const SEVERITY_GLYPH: Record<TopologyCheckResult["severity"], string> = {
  ok: "\u2713", // checkmark
  warn: "!",
  fail: "X",
};

const SEVERITY_FG: Record<TopologyCheckResult["severity"], string> = {
  ok: "var(--accent-green, #22c55e)",
  warn: "var(--accent-amber, #f59e0b)",
  fail: "var(--accent-red, #ef4444)",
};

export function TopologyCheckPanel() {
  const status = useTopologyStore((s) => s.status);
  const loading = useTopologyStore((s) => s.loading);
  const lastError = useTopologyStore((s) => s.lastError);
  const deviceLost = useTopologyStore((s) => s.deviceLostSinceCheck);
  const recheck = useTopologyStore((s) => s.recheck);
  const flagDeviceLost = useTopologyStore((s) => s.flagDeviceLost);
  const clearDeviceLostFlag = useTopologyStore((s) => s.clearDeviceLostFlag);

  // First-render: kick a check.
  useEffect(() => {
    if (status === null && !loading) {
      void recheck();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe to device-loss events from the Rust side.
  // When the CoreAudio HAL reports a device added/removed, the Rust
  // listener (src-tauri/src/audio/monitor_macos.rs) emits "device:lost".
  // We surface that as a banner so the user knows to re-check.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const u = await listen("device:lost", () => {
          flagDeviceLost();
        });
        unlisten = u;
      } catch {
        // Browser preview (not running under Tauri): listen() throws
        // synchronously. Silently ignore so the panel renders.
      }
    })();
    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [flagDeviceLost]);

  // Auto-clear the device-lost flag once a new check completes.
  useEffect(() => {
    if (deviceLost && status !== null) {
      clearDeviceLostFlag();
    }
  }, [deviceLost, status, clearDeviceLostFlag]);

  const verdict = status?.verdict;
  const verdictColor = useMemo(
    () => (verdict ? VERDICT_COLOR[verdict] : "var(--text-secondary, #6b7280)"),
    [verdict],
  );

  return (
    <section className="topology-panel" aria-label="Topology check">
      <header className="topology-panel__header">
        <div className="topology-panel__title">
          <span
            className="topology-panel__verdict-dot"
            style={{ background: verdictColor }}
            aria-hidden
          />
          <h2>Topology</h2>
          <span className="topology-panel__verdict-label" style={{ color: verdictColor }}>
            {verdict ? VERDICT_LABEL[verdict] : "checking..."}
          </span>
        </div>
        <button
          type="button"
          className="topology-panel__recheck"
          onClick={() => {
            void recheck();
          }}
          disabled={loading}
        >
          {loading ? "Checking..." : "Re-check"}
        </button>
      </header>

      {deviceLost && (
        <div className="topology-panel__banner topology-panel__banner--warn">
          Audio device changed since the last check. Click Re-check to update the
          topology. (Per R6, CoreAudio hot-unplug detector fired.)
        </div>
      )}

      {lastError && (
        <div className="topology-panel__banner topology-panel__banner--fail">
          Topology check failed: {lastError}
        </div>
      )}

      {status && (
        <>
          <p className="topology-panel__summary">{status.fix_summary}</p>

          <ul className="topology-panel__checks">
            {status.checks.map((c) => (
              <li
                key={c.id}
                className={`topology-check topology-check--${c.severity}`}
              >
                <span
                  className="topology-check__glyph"
                  style={{ color: SEVERITY_FG[c.severity] }}
                  aria-hidden
                >
                  {SEVERITY_GLYPH[c.severity]}
                </span>
                <div className="topology-check__body">
                  <div className="topology-check__label">{c.label}</div>
                  {c.observed && (
                    <div className="topology-check__observed">
                      observed: <code>{c.observed}</code>
                    </div>
                  )}
                  {c.action && c.severity !== "ok" && (
                    <div className="topology-check__action">{c.action}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <details className="topology-panel__devices">
            <summary>
              {status.devices.length} audio device{status.devices.length === 1 ? "" : "s"} found
            </summary>
            <ul>
              {status.devices.map((d) => (
                <li key={d.id}>
                  <code>{d.name}</code> [{d.transport}] in={d.channel_count_in}{" "}
                  out={d.channel_count_out}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  );
}
