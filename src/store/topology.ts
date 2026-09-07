import { create } from "zustand";
import {
  checkTopology,
  topologyStatus,
  getTopologyPrefs,
  setTopologyPrefs,
  MOCK_TOPOLOGY_REPORT,
  EMPTY_TOPOLOGY_PREFS,
  type TopologyReport,
  type TopologyCheckResult,
  type TopologyPrefs,
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

  /** Current user-picked device preferences, hydrated from the Rust
   *  store at app start. */
  prefs: TopologyPrefs;

  /** Hydrate prefs + run the first check. Called from
   *  TopologyCheckPanel on mount. */
  hydrate: () => Promise<void>;

  /** Re-run the topology check synchronously and update the store. */
  recheck: () => Promise<void>;
  /** Fetch the cached report without re-probing CoreAudio. */
  refreshFromCache: () => Promise<void>;
  /** Mark that a hot-unplug event has been signalled. */
  flagDeviceLost: () => void;
  /** Reset the hot-unplug banner after the user re-checks. */
  clearDeviceLostFlag: () => void;

  /** Update a single prefs slot + persist + recheck. The check is
   *  what drives the per-row verdict so we always re-run after a
   *  pick. */
  pickMic: (name: string | null) => Promise<void>;
  pickR3OutVac: (name: string | null) => Promise<void>;
  pickR4InVac: (name: string | null) => Promise<void>;
  pickR4OutDevice: (name: string | null) => Promise<void>;
}

export const useTopologyStore = create<TopologySlice>((set, get) => ({
  status: null,
  loading: false,
  lastError: null,
  deviceLostSinceCheck: false,
  prefs: EMPTY_TOPOLOGY_PREFS,

  hydrate: async () => {
    set({ loading: true, lastError: null });
    try {
      const prefs = await getTopologyPrefs();
      const report = await checkTopology();
      set({
        prefs,
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

  pickMic: async (name) => {
    const next: TopologyPrefs = { ...get().prefs, mic_name: name };
    set({ prefs: next, loading: true, lastError: null });
    try {
      const report = await setTopologyPrefs(next);
      set({
        status: report,
        loading: false,
        deviceLostSinceCheck: false,
      });
    } catch (e) {
      set({
        loading: false,
        lastError: e instanceof Error ? e.message : String(e),
      });
    }
  },
  pickR3OutVac: async (name) => {
    const next: TopologyPrefs = { ...get().prefs, r3_out_vac_name: name };
    set({ prefs: next, loading: true, lastError: null });
    try {
      const report = await setTopologyPrefs(next);
      set({
        status: report,
        loading: false,
        deviceLostSinceCheck: false,
      });
    } catch (e) {
      set({
        loading: false,
        lastError: e instanceof Error ? e.message : String(e),
      });
    }
  },
  pickR4InVac: async (name) => {
    const next: TopologyPrefs = { ...get().prefs, r4_in_vac_name: name };
    set({ prefs: next, loading: true, lastError: null });
    try {
      const report = await setTopologyPrefs(next);
      set({
        status: report,
        loading: false,
        deviceLostSinceCheck: false,
      });
    } catch (e) {
      set({
        loading: false,
        lastError: e instanceof Error ? e.message : String(e),
      });
    }
  },
  pickR4OutDevice: async (name) => {
    const next: TopologyPrefs = { ...get().prefs, r4_out_device_name: name };
    set({ prefs: next, loading: true, lastError: null });
    try {
      const report = await setTopologyPrefs(next);
      set({
        status: report,
        loading: false,
        deviceLostSinceCheck: false,
      });
    } catch (e) {
      set({
        loading: false,
        lastError: e instanceof Error ? e.message : String(e),
      });
    }
  },
}));

// Default export for the browser-preview fallback (used when the
// store has never received an IPC response yet).
export const BROWSER_PREVIEW_TOPOLOGY = MOCK_TOPOLOGY_REPORT;

// Re-export the check-result type so consumers can typecheck
// without reaching into the IPC module.
export type { TopologyCheckResult, TopologyPrefs };