import { create } from "zustand";
import {
  checkTopology,
  topologyStatus,
  MOCK_TOPOLOGY_REPORT,
  type TopologyReport,
  type TopologyCheckResult,
} from "@/lib/ipc/topology";

interface TopologySlice {
  /** Latest topology report (null until the first IPC call resolves). */
  status: TopologyReport | null;
  /** Set true while `recheck()` is in flight. */
  loading: boolean;
  /** Last re-check error message (null on success). */
  lastError: string | null;
  /** Whether a hot-unplug event has been signalled by the Rust side
   *  since the last successful check. UI renders a banner. */
  deviceLostSinceCheck: boolean;

  /** Re-run the topology check synchronously and update the store. */
  recheck: () => Promise<void>;
  /** Fetch the cached report without re-probing CoreAudio. */
  refreshFromCache: () => Promise<void>;
  /** Mark that a hot-unplug event has been signalled. */
  flagDeviceLost: () => void;
  /** Reset the hot-unplug banner after the user re-checks. */
  clearDeviceLostFlag: () => void;
}

export const useTopologyStore = create<TopologySlice>((set, _get) => ({
  status: null,
  loading: false,
  lastError: null,
  deviceLostSinceCheck: false,

  recheck: async () => {
    set({ loading: true, lastError: null });
    try {
      const report = await checkTopology();
      set({
        status: report,
        loading: false,
        lastError: null,
        deviceLostSinceCheck: false,
      });
    } catch (e) {
      set({
        loading: false,
        lastError: e instanceof Error ? e.message : String(e),
      });
    }
  },

  refreshFromCache: async () => {
    try {
      const report = await topologyStatus();
      if (report) {
        set({ status: report, lastError: null });
      }
    } catch {
      // Non-fatal: leave the previous status in place.
    }
  },

  flagDeviceLost: () => set({ deviceLostSinceCheck: true }),
  clearDeviceLostFlag: () => set({ deviceLostSinceCheck: false }),
}));

// Default export for the browser-preview fallback (used when the
// store has never received an IPC response yet).
export const BROWSER_PREVIEW_TOPOLOGY = MOCK_TOPOLOGY_REPORT;

// Re-export the check-result type so consumers can typecheck
// without reaching into the IPC module.
export type { TopologyCheckResult };
