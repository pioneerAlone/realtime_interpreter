/**
 * Shared IPC utilities for the realtime_interpreter frontend.
 *
 * Per Open-Less `lib/ipc/shared.ts` pattern (architecture only, no code copy):
 * - isTauri(): detect whether running inside the Tauri webview or in a
 *   browser preview (vite preview).
 * - requireBackendReady(): block invoke calls until the Rust IPC
 *   handshake reports ready.
 * - invokeOrMock(): invoke a Tauri command, or return a mock if running
 *   in browser preview.
 */

import { invoke } from "@tauri-apps/api/core";

export const IPC_CONTRACT_VERSION = "1.0.0";

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

let backendReadyPromise: Promise<void> | null = null;

export async function requireBackendReady(): Promise<void> {
  if (!isTauri()) return;
  if (!backendReadyPromise) {
    backendReadyPromise = invoke<void>("bootstrap_ready").then(() => undefined);
  }
  return backendReadyPromise;
}

export type InvokeOptions<T> = {
  mock?: () => T | Promise<T>;
  timeoutMs?: number;
};

export async function invokeOrMock<T>(
  cmd: string,
  args?: Record<string, unknown>,
  opts: InvokeOptions<T> = {},
): Promise<T> {
  if (!isTauri()) {
    if (!opts.mock) {
      throw new Error(`invokeOrMock(${cmd}) called in browser without mock`);
    }
    return Promise.resolve(opts.mock());
  }
  await requireBackendReady();
  return invoke<T>(cmd, args);
}
