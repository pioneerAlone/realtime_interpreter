import { create } from "zustand";

export interface TopologyStatus {
  mic: { name: string; ok: boolean } | null;
  bh_2ch: { name: string; ok: boolean } | null;
  bh_16ch_agg: { name: string; ok: boolean } | null;
  headphones: { name: string; ok: boolean } | null;
  feedback_risk: "none" | "warning" | "error";
  last_check_ms: number | null;
}

interface TopologySlice {
  status: TopologyStatus | null;
  setStatus: (status: TopologyStatus) => void;
}

export const useTopologyStore = create<TopologySlice>((set) => ({
  status: null,
  setStatus: (status) => set({ status }),
}));
