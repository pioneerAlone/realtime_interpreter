import { create } from "zustand";

export interface Subtitle {
  id: string;
  timestamp_ms: number;
  speaker: "Client" | "Unknown";
  source_text: string;
  translation_text: string;
  is_final: boolean;
}

interface SubtitlesSlice {
  subtitles: Subtitle[];
  appendSubtitle: (subtitle: Subtitle) => void;
  clearSubtitles: () => void;
}

const MAX_SUBTITLES = 200;

export const useSubtitlesStore = create<SubtitlesSlice>((set) => ({
  subtitles: [],
  appendSubtitle: (subtitle) =>
    set((prev) => ({
      subtitles: [...prev.subtitles, subtitle].slice(-MAX_SUBTITLES),
    })),
  clearSubtitles: () => set({ subtitles: [] }),
}));
