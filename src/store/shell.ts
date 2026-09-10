import { create } from "zustand";

/**
 * shell.ts — 主窗 view state（T-G-02）
 *
 * 简单 useState<View> 切换，不接 react-router（v0 简单需求）。
 * 决策来源: `.scratch/gui-rebuild-v0.md` §3 + §10.1 T-G-02
 * Ticket:    #27 (T-G-02)
 */

export type ShellView = "translate" | "settings";

interface ShellSlice {
  view: ShellView;
  setView: (next: ShellView) => void;
}

export const useShellStore = create<ShellSlice>((set) => ({
  view: "translate",
  setView: (next) => set({ view: next }),
}));
