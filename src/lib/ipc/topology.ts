//! Typed wrapper around the `topology::*` Tauri IPC commands.
//!
//! `check_topology` re-runs the check synchronously and returns the
//! latest `TopologyReport`. `topology_status` returns the cached
//! report without re-probing CoreAudio. `fix_topology_hint` returns
//! a generic backward-compat hint (per-row hints live in
//! `TopologyReport.checks[i].action`).
//!
//! Browser-preview fallback: when running outside Tauri (e.g. via
//! `pnpm dev` without `pnpm tauri dev`), the wrappers return a
//! synthetic PASS report so the UI renders end-to-end. The
//! `isTauri()` check lives in `shared.ts`.

import { invokeOrMock } from "./shared";

export interface TopologyCheckResult {
  id: string;
  label: string;
  severity: "ok" | "warn" | "fail";
  observed: string | null;
  action: string;
}

export interface AudioDevice {
  id: number;
  name: string;
  transport: string;
  channel_count_in: number;
  channel_count_out: number;
}

export interface TopologyReport {
  verdict: "pass" | "warn" | "fail";
  devices: AudioDevice[];
  checks: TopologyCheckResult[];
  checked_at_ms: number;
  fix_summary: string;
}

/// User-picked device names for the 4 topology slots.
///
/// Mirrors `audio::TopologyPrefs` in Rust. `null` = not picked yet
/// (use OS default or heuristic fallback); `""` = explicitly "system
/// default"; a non-empty string = a specific CoreAudio device name.
export interface TopologyPrefs {
  mic_name: string | null;
  r3_out_vac_name: string | null;
  r4_in_vac_name: string | null;
  r4_out_device_name: string | null;
}

export const EMPTY_TOPOLOGY_PREFS: TopologyPrefs = {
  mic_name: null,
  r3_out_vac_name: null,
  r4_in_vac_name: null,
  r4_out_device_name: null,
};

export const MOCK_TOPOLOGY_PREFS: TopologyPrefs = {
  mic_name: "MacBook Air Microphone",
  r3_out_vac_name: "BlackHole 2ch",
  r4_in_vac_name: "BlackHole 16ch",
  r4_out_device_name: "MacBook Air Speakers",
};

export const MOCK_TOPOLOGY_REPORT: TopologyReport = {
  verdict: "pass",
  devices: [
    { id: 1, name: "MacBook Air Microphone", transport: "Built-in", channel_count_in: 1, channel_count_out: 0 },
    { id: 2, name: "MacBook Air Speakers", transport: "Built-in", channel_count_in: 0, channel_count_out: 2 },
    { id: 3, name: "BlackHole 2ch", transport: "Virtual", channel_count_in: 2, channel_count_out: 2 },
    { id: 4, name: "BlackHole 16ch", transport: "Virtual", channel_count_in: 16, channel_count_out: 16 },
  ],
  checks: [
    { id: "platform_supported", label: "Platform supported", severity: "ok", observed: "browser preview", action: "" },
    { id: "mic_present", label: "Microphone (R3 input)", severity: "ok", observed: "MacBook Air Microphone (Built-in)", action: "" },
    { id: "bh_2ch_present", label: "BlackHole 2ch (R3 output)", severity: "ok", observed: "BlackHole 2ch (Virtual)", action: "" },
    { id: "bh_16ch_present", label: "BlackHole 16ch (R4 input)", severity: "ok", observed: "BlackHole 16ch (Virtual)", action: "" },
    { id: "real_output_present", label: "Headphones or speakers", severity: "ok", observed: "MacBook Air Speakers (Built-in)", action: "" },
    { id: "r3_out_vac_differs_from_r4_in_vac", label: "误区 1: R3 输出 VAC != R4 输入 VAC", severity: "ok", observed: "R3 = BlackHole 2ch, R4 = BlackHole 16ch", action: "" },
    { id: "meeting_app_mic_is_r3_vac", label: "误区 2: 会议软件麦克风 = R3 虚拟声卡", severity: "warn", observed: "candidate: BlackHole 2ch", action: "Open your meeting app (Zoom / Teams / Tencent Meeting / ...) Audio Settings, and select BlackHole 2ch as the microphone input." },
    { id: "peer_audio_to_real_output_only", label: "误区 3: 对方翻译输出走真实耳机", severity: "ok", observed: "MacBook Air Speakers (Built-in)", action: "" },
  ],
  checked_at_ms: Date.now(),
  fix_summary: "Topology OK with warnings: 误区 2 (meeting app mic not yet confirmed).",
};

export async function checkTopology(): Promise<TopologyReport> {
  return invokeOrMock<TopologyReport>("check_topology", undefined, {
    mock: () => MOCK_TOPOLOGY_REPORT,
  });
}

export async function topologyStatus(): Promise<TopologyReport | null> {
  return invokeOrMock<TopologyReport | null>("topology_status", undefined, {
    mock: () => MOCK_TOPOLOGY_REPORT,
  });
}

export async function fixTopologyHint(): Promise<string> {
  return invokeOrMock<string>("fix_topology_hint", undefined, {
    mock: () => "Browser preview: install BlackHole 2ch + BlackHole 16ch via brew; wire meeting app to BlackHole 2ch; route BlackHole 16ch to headphones.",
  });
}

export async function getTopologyPrefs(): Promise<TopologyPrefs> {
  return invokeOrMock<TopologyPrefs>("get_topology_prefs", undefined, {
    mock: () => MOCK_TOPOLOGY_PREFS,
  });
}

export async function setTopologyPrefs(
  prefs: TopologyPrefs,
): Promise<TopologyReport> {
  return invokeOrMock<TopologyReport>("set_topology_prefs", { ...prefs }, {
    mock: () => MOCK_TOPOLOGY_REPORT,
  });
}
