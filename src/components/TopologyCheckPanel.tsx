/**
 * TopologyCheckPanel — pre-flight 4-device topology picker +
 * red/amber/green check result UI.
 *
 * Spec reference: docs/spec/v0/01-architecture.md §7 +
 * docs/spec/v0/06-deliverables.md §3.1.
 *
 * Layout (top to bottom):
 *   1. Header with verdict dot + verdict label + Re-check button.
 *   2. Hot-unplug banner (only when device:lost event fired).
 *   3. Last-error banner (only when an IPC call failed).
 *   4. 4 picker rows: mic / R3-out VAC / R4-in VAC / R4-out device.
 *      Each row is `label + observed-state chip + SelectLite picker`.
 *   5. Fix summary.
 *   6. 3-misconception self-check rows (read-only + actionable text).
 *   7. Audio devices <details> (collapsed by default).
 *
 * Renders inside MainView (main window). The capsule window does
 * NOT show this panel -- the floating subtitle is a passive
 * display; the topology check UI lives in the main window.
 */

import { useEffect, useMemo } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  useTopologyStore,
  resolveEffectivePrefs,
} from "@/store/topology";
import type { AudioDevice } from "@/lib/ipc/topology";
import { SelectLite } from "@/components/ui/SelectLite";

type Verdict = "pass" | "warn" | "fail";

const VERDICT_COLOR: Record<Verdict, string> = {
  pass: "var(--accent-green, #22c55e)",
  warn: "var(--accent-amber, #f59e0b)",
  fail: "var(--accent-red, #ef4444)",
};

const VERDICT_LABEL: Record<Verdict, string> = {
  pass: "已就绪",
  warn: "可以启动",
  fail: "需要修正",
};

// (SEVERITY_GLYPH / SEVERITY_FG removed: the 3-misconception rows
// are no longer rendered to the end-user. Kept as `undefined`
// reference in case a future "advanced diagnostics" UI surfaces
// them.)

/** Build a dropdown option list for a picker row. We always include
 *  "System default" (value `""`) as the first option so the user can
 *  fall back to OS-chosen device, then the candidates filtered from
 *  `devices`.
 *
 *  `currentPicked` = the user's stored pick (may be `null` meaning
 *  "not picked yet"). When `currentPicked` is non-null but does not
 *  match any discovered device, we still surface it (e.g. the user
 *  unplugged then replugged BlackHole — show the saved name so the
 *  recheck finds it again). */
function buildOptions(
  devices: AudioDevice[],
  currentPicked: string | null,
  filter: (d: AudioDevice) => boolean,
): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [
    { value: "", label: "(System default)" },
  ];
  const candidates = devices.filter(filter);
  for (const d of candidates) {
    opts.push({ value: d.name, label: `${d.name} (${d.transport})` });
  }
  // Surface the user's stored pick even if it doesn't match a
  // candidate (so they can keep their choice after a VAC unplug).
  if (
    currentPicked &&
    currentPicked !== "" &&
    !candidates.some((d) => d.name === currentPicked)
  ) {
    opts.push({ value: currentPicked, label: `${currentPicked} (not currently visible)` });
  }
  return opts;
}

export function TopologyCheckPanel() {
  const status = useTopologyStore((s) => s.status);
  const loading = useTopologyStore((s) => s.loading);
  const lastError = useTopologyStore((s) => s.lastError);
  const deviceLost = useTopologyStore((s) => s.deviceLostSinceCheck);
  const prefs = useTopologyStore((s) => s.prefs);
  const recheck = useTopologyStore((s) => s.recheck);
  const hydrate = useTopologyStore((s) => s.hydrate);
  const flagDeviceLost = useTopologyStore((s) => s.flagDeviceLost);
  const clearDeviceLostFlag = useTopologyStore((s) => s.clearDeviceLostFlag);
  const pickMic = useTopologyStore((s) => s.pickMic);
  const pickR3OutVac = useTopologyStore((s) => s.pickR3OutVac);
  const pickR4InVac = useTopologyStore((s) => s.pickR4InVac);
  const pickR4OutDevice = useTopologyStore((s) => s.pickR4OutDevice);

  // First-render: hydrate prefs + run the first check.
  useEffect(() => {
    if (status === null && !loading) {
      void hydrate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe to device-loss events from the Rust side.
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

  const devices = status?.devices ?? [];

  // Resolve prefs against discovered devices so the pickers pre-select
  // a sensible default when the user has not picked yet (or the saved
  // pick matches a discovered device). Mirrors `lookup()` in
  // `src-tauri/src/audio/topology.rs`.
  const effective = useMemo(
    () => resolveEffectivePrefs(prefs, devices),
    [prefs, devices],
  );

  // Build per-row picker options. The picker dropdowns always
  // include the user's stored pick (even when invisible) so the
  // selection is sticky across CoreAudio churn.
  const micOptions = useMemo(
    () => buildOptions(devices, prefs.mic_name, (d) => d.channel_count_in > 0 && d.transport !== "Virtual"),
    [devices, prefs.mic_name],
  );
  const r3OutOptions = useMemo(
    () => buildOptions(devices, prefs.r3_out_vac_name, (d) => d.channel_count_out >= 2 && d.transport === "Virtual"),
    [devices, prefs.r3_out_vac_name],
  );
  const r4InOptions = useMemo(
    () => buildOptions(devices, prefs.r4_in_vac_name, (d) => d.channel_count_in >= 16 || d.channel_count_out >= 16),
    [devices, prefs.r4_in_vac_name],
  );
  const r4OutOptions = useMemo(
    () => buildOptions(devices, prefs.r4_out_device_name, (d) => d.channel_count_out > 0 && d.transport !== "Virtual"),
    [devices, prefs.r4_out_device_name],
  );

  // Lookup helper for "observed" chip: pick value → AudioDevice.
  // The filter parameter is unused at the moment — we look up by
  // exact name first, fall back to "(not currently visible)" if the
  // pick is missing from CoreAudio. The filter argument was retained
  // in earlier iterations for future role-restricted lookups; remove
  // when callers stop passing it.
  const observedFor = (picked: string | null): string | null => {
    if (!picked) return null;
    const exact = devices.find((d) => d.name === picked);
    if (exact) return `${exact.name} (${exact.transport})`;
    if (picked === "") return "(system default)";
    return `${picked} (not currently visible)`;
  };

  // (3-misconception rows hidden from end-users; reserved for
  // future "advanced diagnostics" disclosure behind a developer
  // toggle.)

  return (
    <section className="topology-panel" aria-label="Topology check">
      <header className="topology-panel__header">
        <div className="topology-panel__title">
          <span
            className="topology-panel__verdict-dot"
            style={{ background: verdictColor }}
            aria-hidden
          />
          <h2>音频连接</h2>
          <span className="topology-panel__verdict-label" style={{ color: verdictColor }}>
            {verdict ? VERDICT_LABEL[verdict] : "检查中…"}
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
          {loading ? "检查中…" : "重新检查"}
        </button>
      </header>

      {deviceLost && (
        <div className="topology-panel__banner topology-panel__banner--warn">
          音频设备有变化。点「重新检查」刷新连接状态。
        </div>
      )}

      {lastError && (
        <div className="topology-panel__banner topology-panel__banner--fail">
          检查失败：{lastError}
        </div>
      )}

      {status && (
        <>
          {/* ---- 4 picker rows: device assignment ---- */}
          <ul className="topology-panel__pickers">
            <li className="topology-picker">
              <div className="topology-picker__label">
                我的麦克风
              </div>
              <SelectLite
                value={effective.mic_name ?? ""}
                onChange={(v) => void pickMic(v || null)}
                options={micOptions}
                placeholder="(System default)"
                ariaLabel="我的麦克风"
                loading={loading}
              />
              {observedFor(effective.mic_name) && (
                <div className="topology-picker__observed">
                  当前: <code>{observedFor(effective.mic_name)}</code>
                </div>
              )}
            </li>

            <li className="topology-picker">
              <div className="topology-picker__label">
                我的翻译输出
              </div>
              <SelectLite
                value={effective.r3_out_vac_name ?? ""}
                onChange={(v) => void pickR3OutVac(v || null)}
                options={r3OutOptions}
                placeholder="(System default)"
                ariaLabel="我的翻译输出虚拟声卡"
                loading={loading}
              />
              {observedFor(effective.r3_out_vac_name) && (
                <div className="topology-picker__observed">
                  当前: <code>{observedFor(effective.r3_out_vac_name)}</code>
                </div>
              )}
            </li>

            <li className="topology-picker">
              <div className="topology-picker__label">
                对方的说话输入
              </div>
              <SelectLite
                value={effective.r4_in_vac_name ?? ""}
                onChange={(v) => void pickR4InVac(v || null)}
                options={r4InOptions}
                placeholder="(System default)"
                ariaLabel="对方的说话输入虚拟声卡"
                loading={loading}
              />
              {observedFor(effective.r4_in_vac_name) && (
                <div className="topology-picker__observed">
                  当前: <code>{observedFor(effective.r4_in_vac_name)}</code>
                </div>
              )}
            </li>

            <li className="topology-picker">
              <div className="topology-picker__label">
                我的耳机或扬声器
              </div>
              <SelectLite
                value={effective.r4_out_device_name ?? ""}
                onChange={(v) => void pickR4OutDevice(v || null)}
                options={r4OutOptions}
                placeholder="(System default)"
                ariaLabel="我的耳机或扬声器"
                loading={loading}
              />
              {observedFor(effective.r4_out_device_name) && (
                <div className="topology-picker__observed">
                  当前: <code>{observedFor(effective.r4_out_device_name)}</code>
                </div>
              )}
            </li>
          </ul>

          <details className="topology-panel__devices">
            <summary>
              高级诊断信息（开发用）
            </summary>
            <ul>
              {status.devices.map((d) => (
                <li key={d.id}>
                  <code>{d.name}</code> [{d.transport}] in=
                  {d.channel_count_in} out={d.channel_count_out}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  );
}