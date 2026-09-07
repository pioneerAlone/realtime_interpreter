/**
 * IPC barrel — re-exports typed wrappers for every Tauri command.
 * Per Open-Less `lib/ipc/<domain>.ts` + `index.ts` pattern.
 *
 * Commands covered (per docs/spec/v0/01-architecture.md §6):
 *   session (5): start_session, stop_session, session_status, list_sessions, ...
 *   device (4):  list_devices, set_mic, set_output, get_topo_summary
 *   subtitle (2): append_subtitle, clear_subtitles
 *   topology (2): check_topology, fix_topology_hint
 *   config (3):   get_config, set_config, get_api_key_status
 *   diagnostics (4): latency_probe, topology_check, ping, version
 *
 * For the v0 scaffold, only `ping()` is wired end-to-end; the rest are
 * declared as typed stubs that throw if invoked. Tickets #03-#13 fill
 * the bodies in.
 */

import { invokeOrMock } from "./shared";

export * from "./shared";
export * from "./topology";

export async function ping(): Promise<string> {
  return invokeOrMock<string>("ping", undefined, {
    mock: () => "browser-preview-pong",
  });
}

export async function version(): Promise<{ version: string; contract: string }> {
  return invokeOrMock("version", undefined, {
    mock: () => ({ version: "0.0.1-browser-preview", contract: "1.0.0" }),
  });
}

export async function bootstrapReady(): Promise<void> {
  await invokeOrMock<void>("bootstrap_ready");
}
