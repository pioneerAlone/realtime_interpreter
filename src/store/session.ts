import { create } from "zustand";

export type Channel = "R3" | "R4";
export type SessionState = "idle" | "starting" | "running" | "stopping" | "error";

interface SessionSlice {
  r3: SessionState;
  r4: SessionState;
  setState: (channel: Channel, state: SessionState) => void;
}

export const useSessionStore = create<SessionSlice>((set) => ({
  r3: "idle",
  r4: "idle",
  setState: (channel, state) =>
    set((prev) => ({ ...prev, [channel.toLowerCase()]: state })),
}));
