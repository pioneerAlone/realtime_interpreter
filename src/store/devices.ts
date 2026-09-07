import { create } from "zustand";

export interface AudioDevice {
  id: string;
  name: string;
  channels: number;
  is_default: boolean;
}

interface DevicesSlice {
  devices: AudioDevice[];
  selectedMic: string | null;
  selectedOutput: string | null;
  setDevices: (devices: AudioDevice[]) => void;
  selectMic: (id: string) => void;
  selectOutput: (id: string) => void;
}

export const useDevicesStore = create<DevicesSlice>((set) => ({
  devices: [],
  selectedMic: null,
  selectedOutput: null,
  setDevices: (devices) => set({ devices }),
  selectMic: (id) => set({ selectedMic: id }),
  selectOutput: (id) => set({ selectedOutput: id }),
}));
