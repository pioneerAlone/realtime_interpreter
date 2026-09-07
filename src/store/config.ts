import { create } from "zustand";

export type BypassOutputTarget = "headphones" | "speakers" | "mute" | string;
export type SampleRate = 16000 | 24000 | 48000;

interface ConfigSlice {
  bypass: boolean;
  bypassOutputTarget: BypassOutputTarget;
  sourceLanguage: "zh" | "en";
  targetLanguage: "en" | "zh";
  sampleRate: SampleRate;
  setBypass: (bypass: boolean) => void;
  setBypassOutputTarget: (target: BypassOutputTarget) => void;
  setLanguages: (src: "zh" | "en", tgt: "en" | "zh") => void;
}

export const useConfigStore = create<ConfigSlice>((set) => ({
  bypass: false,
  bypassOutputTarget: "headphones",
  sourceLanguage: "zh",
  targetLanguage: "en",
  sampleRate: 48000,
  setBypass: (bypass) => set({ bypass }),
  setBypassOutputTarget: (target) => set({ bypassOutputTarget: target }),
  setLanguages: (sourceLanguage, targetLanguage) =>
    set({ sourceLanguage, targetLanguage }),
}));
