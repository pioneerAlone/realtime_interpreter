import React from "react";
import WireHint from "./ui/WireHint";
import MockMeter from "./MockMeter";
import {
  MOCK_DEVICES,
  PICKER_META,
  type MockDevice,
  type PickerKey,
} from "../lib/devices";

interface PickerRowProps {
  picker: PickerKey;
  /** 当前选中设备 id（来自 Preset.devices[picker]） */
  value: string;
  onChange: (next: string) => void;
  /** 显示 mock 电平 · 默认 50（视觉占位） */
  mockLevel?: number;
}

/**
 * PickerRow — OBS / Discord 风格 1 行 3 列（T-G-03）
 *
 *   [icon] [label]  [native dropdown ▾]  [test 🔊]  [meter━━━━│━━]
 *
 * 视觉：dropdown 1fr + test btn auto + meter 50px · 单行紧凑。
 * picker 展开时如果 PICKER_META[picker].wireHint 存在，下方显示 WireHint。
 *
 * 决策来源: `.scratch/gui-rebuild-v0.md` §4.3 (picker 行) + §4.4 (wire-hint)
 * Ticket:    #28 (T-G-03)
 */
export default function PickerRow({
  picker,
  value,
  onChange,
  mockLevel = 50,
}: PickerRowProps): React.ReactElement {
  const meta = PICKER_META[picker];
  const devices: ReadonlyArray<MockDevice> = MOCK_DEVICES[picker];

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    onChange(e.target.value);
  };

  const handleTest = (): void => {
    // TODO: 真实 test 调 audio engine 属于 T-G-04 / T-G-05 · 当前 stub
    console.log(`[picker:${picker}] test ${value}`);
  };

  return (
    <div className="rt-picker-row" data-component="picker-row" data-picker={picker}>
      <div className="rt-picker-row-head">
        <span className="rt-picker-row-icon" aria-hidden="true">
          {meta.icon}
        </span>
        <label className="rt-picker-row-label" htmlFor={`picker-${picker}`}>
          <span>{meta.label}</span>
          <span className="rt-picker-row-flow">{meta.flow}</span>
        </label>
      </div>

      <div className="rt-picker-row-controls">
        <select
          id={`picker-${picker}`}
          className="rt-picker-row-dropdown"
          value={value}
          onChange={handleChange}
        >
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="rt-picker-row-test"
          onClick={handleTest}
          aria-label="测试设备"
          title="测试设备"
        >
          🔊
        </button>

        <MockMeter level={mockLevel} />
      </div>

      {meta.wireHint && (
        <WireHint icon={picker === "monitor" ? "↻" : "↓"}>
          {meta.wireHint}
        </WireHint>
      )}
    </div>
  );
}
