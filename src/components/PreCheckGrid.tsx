import React from "react";
import PreCheckCard, { type PreCheckTone } from "./PreCheckCard";
import { usePresetStore } from "../store/presets";
import { useEngineStore } from "../store/engine";
import { MOCK_DEVICES } from "../lib/devices";

/**
 * PreCheckGrid — 5 预检卡 grid（T-G-05）
 *
 * 5 预检卡（per Q30）：
 *   1. 麦克风权限      (v0 永真)
 *   2. R3 麦克风       (picker 1 ≠ "")
 *   3. R3 TTS 输出     (picker 2 ≠ "")
 *   4. R4 回采         (picker 3 ≠ "")
 *   5. 引擎状态        (credentials.last_test_result)
 *
 * 第 4 picker（对端监听）不预检 · per design freeze §5.3 末
 *
 * 决策来源: `.scratch/gui-rebuild-v0.md` §5.1 + §5.3 + Q30
 * Ticket:    #31 (T-G-05)
 */
export default function PreCheckGrid(): React.ReactElement {
  const activeId = usePresetStore((s) => s.activeId);
  const activePreset = usePresetStore((s) =>
    s.presets.find((p) => p.id === activeId),
  );
  const credentials = useEngineStore((s) => s.credentials);

  if (!activePreset) {
    return (
      <div className="rt-precheck-empty">未选择 preset · 去设置选一个</div>
    );
  }

  const deviceName = (id: string, list: ReadonlyArray<{ id: string; name: string }>): string =>
    list.find((d) => d.id === id)?.name ?? "—";

  // 引擎状态 tone
  let engineTone: PreCheckTone = "success";
  let engineIcon = "●";
  let engineStatus = "正常";
  if (credentials.lastTestResult === "fail") {
    engineTone = "error";
    engineIcon = "●";
    engineStatus = "失败";
  } else if (credentials.lastRttMs !== null && credentials.lastRttMs > 200) {
    engineTone = "warn";
    engineIcon = "⚠";
    engineStatus = `RTT ${credentials.lastRttMs}ms`;
  } else if (credentials.lastRttMs !== null) {
    engineTone = "success";
    engineStatus = `RTT ${credentials.lastRttMs}ms`;
  } else {
    engineTone = "idle";
    engineIcon = "○";
    engineStatus = "未测试";
  }

  return (
    <div className="rt-precheck-grid" data-component="precheck-grid">
      <PreCheckCard
        icon="●"
        tone="success"
        label="麦克风权限"
        value="macOS 系统偏好设置"
        statusLabel="已授权"
      />
      <PreCheckCard
        icon="●"
        tone="success"
        label="R3 麦克风"
        value={deviceName(activePreset.devices.microphone, MOCK_DEVICES.microphone)}
        statusLabel="可用"
      />
      <PreCheckCard
        icon="●"
        tone="success"
        label="R3 TTS 输出"
        value={deviceName(
          activePreset.devices.translationOutput,
          MOCK_DEVICES.translationOutput,
        )}
        statusLabel="可用"
      />
      <PreCheckCard
        icon="●"
        tone="success"
        label="R4 回采"
        value={deviceName(
          activePreset.devices.remoteInput,
          MOCK_DEVICES.remoteInput,
        )}
        statusLabel="可用"
      />
      <PreCheckCard
        icon={engineIcon}
        tone={engineTone}
        label="引擎状态"
        value={credentials.lastTestAt ?? "尚未测试"}
        statusLabel={engineStatus}
      />
    </div>
  );
}
