import React from "react";
import PageHead from "../components/PageHead";
import PreCheckGrid from "../components/PreCheckGrid";
import EngineRuntimeStats from "../components/EngineRuntimeStats";
import CtaBar from "../components/CtaBar";
import { useEngineStore } from "../store/engine";
import { usePresetStore } from "../store/presets";
import { MOCK_DEVICES } from "../lib/devices";

/**
 * TranslateView — 实时翻译 dashboard v0（T-G-05）
 *
 * Layout:
 *   ┌────────────────────────────────────┐
 *   │ PageHead (实时翻译 + subtitle)      │
 *   ├────────────────────────────────────┤
 *   │ 当前 preset · <name> · 4 设备已就绪  │
 *   ├────────────────────────────────────┤
 *   │ [idle] 5 预检卡 grid                 │
 *   │ [running] R3/R4 实时 stats grid      │
 *   ├────────────────────────────────────┤
 *   │ (engine warn)                       │
 *   │ CtaBar sticky bottom (idle/running) │
 *   └────────────────────────────────────┘
 *
 * 决策来源: `.scratch/gui-rebuild-v0.md` §5 + §10.1 T-G-05
 * Ticket:    #31 (T-G-05)
 */
export default function TranslateView(): React.ReactElement {
  const engineState = useEngineStore((s) => s.engineState);
  const activeId = usePresetStore((s) => s.activeId);
  const activePreset = usePresetStore((s) =>
    s.presets.find((p) => p.id === activeId),
  );

  const subtitle = activePreset
    ? `当前 preset · ${activePreset.name} · 4 设备已就绪`
    : "选择一台设备或预设，启动后开始把对方的声音翻译成你能听懂的语言";

  const isRunning = engineState === "running";

  return (
    <div className="rt-page rt-page-translate" data-component="translate-view">
      <PageHead title="实时翻译" subtitle={subtitle} />

      <main className="rt-page-body rt-translate-page-body">
        <div className="rt-translate-stack">
          {activePreset && (
            <div className="rt-translate-preset-info">
              <span>当前 preset：</span>
              <strong>{activePreset.name}</strong>
              <span>·</span>
              <span>麦克风 {deviceName(activePreset.devices.microphone, MOCK_DEVICES.microphone)}</span>
              <span>·</span>
              <span>翻译输出 {deviceName(activePreset.devices.translationOutput, MOCK_DEVICES.translationOutput)}</span>
            </div>
          )}

          {!isRunning ? <PreCheckGrid /> : <EngineRuntimeStats />}
        </div>
      </main>

      <CtaBar />
    </div>
  );
}

function deviceName(
  id: string,
  list: ReadonlyArray<{ id: string; name: string }>,
): string {
  return list.find((d) => d.id === id)?.name ?? "—";
}
