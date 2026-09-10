/**
 * IPC barrel — re-exports typed wrappers for every Tauri command.
 *
 * T-G-04 adds: getPreferences / savePreset / deletePreset / setActivePreset
 *              startSession / stopSession stub succeed (R3/R4 audio engine 接
 *              入属于 #03 / #04 ticket 范围)
 */

import { invokeOrMock } from "./shared";

export * from "./shared";

/* ================ diagnostics (existing) ================ */

export async function ping(): Promise<string> {
  return invokeOrMock<string>("ping", undefined, {
    mock: () => "browser-preview-pong",
  });
}

export async function version(): Promise<{ version: string; contract: string }> {
  return invokeOrMock("version", undefined, {
    mock: () => ({ version: "0.0.1-browser-preview", contract: "1.0.0" }),
  });
}

export async function bootstrapReady(): Promise<void> {
  await invokeOrMock<void>("bootstrap_ready");
}

/* ================ preferences + preset (T-G-04) ================ */

import type { Preferences, Preset } from "../../store/presets";

/** 与 Rust Preferences::default() 保持一致 — 浏览器 preview mock 用 */
const BROWSER_DEFAULT_PREFERENCES: Preferences = {
  schemaVersion: 2,
  activeId: "daily-meeting",
  presets: [
    {
      id: "daily-meeting",
      name: "日常会议",
      status: "active",
      progress: 100,
      devices: {
        microphone: "macbook-mic",
        translationOutput: "blackhole-2ch",
        remoteInput: "vb-cable",
        monitor: "iflybuds-nano",
      },
      r3Direction: "zh→en",
      r4Caption: "bilingual-stacked",
      description: "v0 默认配置。适合一般商务会议 / 1v1 沟通。",
      lastLaunched: "3 天前",
      launchCount: 4,
    },
    {
      id: "demo-mode",
      name: "演示模式",
      status: "disabled-stub",
      progress: 25,
      devices: {
        microphone: "macbook-mic",
        translationOutput: "blackhole-2ch",
        remoteInput: "vb-cable",
        monitor: "iflybuds-nano",
      },
      r3Direction: "zh→en",
      r4Caption: "bilingual-stacked",
      description: "演示场景（即将推出）。",
      lastLaunched: "—",
      launchCount: 0,
    },
    {
      id: "one-on-one",
      name: "1v1 沟通",
      status: "disabled-stub",
      progress: 0,
      devices: {
        microphone: "macbook-mic",
        translationOutput: "blackhole-2ch",
        remoteInput: "vb-cable",
        monitor: "iflybuds-nano",
      },
      r3Direction: "zh→en",
      r4Caption: "bilingual-stacked",
      description: "1v1 沟通场景（即将推出）。",
      lastLaunched: "—",
      launchCount: 0,
    },
  ],
};

export async function getPreferences(): Promise<Preferences> {
  return invokeOrMock<Preferences>("get_preferences", undefined, {
    mock: () => BROWSER_DEFAULT_PREFERENCES,
  });
}

export async function savePreset(preset: Preset): Promise<void> {
  return invokeOrMock<void>("save_preset", { preset });
}

export async function deletePreset(id: string): Promise<void> {
  return invokeOrMock<void>("delete_preset", { id });
}

export async function setActivePreset(id: string): Promise<void> {
  return invokeOrMock<void>("set_active_preset", { id });
}

/* ================ session (T-G-04 stub) ================ */

import type { Channel, SessionState } from "../../store/session";

export async function startSession(channel: Channel): Promise<SessionState> {
  return invokeOrMock<SessionState>("start_session", { channel }, {
    mock: () => "running",
  });
}

export async function stopSession(channel: Channel): Promise<SessionState> {
  return invokeOrMock<SessionState>("stop_session", { channel }, {
    mock: () => "idle",
  });
}

export async function sessionStatus(channel: Channel): Promise<SessionState> {
  return invokeOrMock<SessionState>("session_status", { channel }, {
    mock: () => "idle",
  });
}

/* ================ engine credentials (T-G-06) ================ */

import type { EngineCredentials } from "../../store/engine";

const BROWSER_DEFAULT_CREDENTIALS: EngineCredentials = {
  apiKeySet: true,
  maskedKey: "3F2A",
  lastTestAt: "2 小时前",
  lastTestResult: "success",
  lastRttMs: 412,
  lastNode: "火山引擎北京节点",
  lastError: null,
};

export async function getEngineCredentials(): Promise<EngineCredentials> {
  return invokeOrMock<EngineCredentials>("get_engine_credentials", undefined, {
    mock: () => BROWSER_DEFAULT_CREDENTIALS,
  });
}

export async function setApiKey(key: string): Promise<EngineCredentials> {
  return invokeOrMock<EngineCredentials>("set_api_key", { key }, {
    mock: () => ({
      ...BROWSER_DEFAULT_CREDENTIALS,
      maskedKey: key.slice(-4),
    }),
  });
}

export async function clearApiKey(): Promise<EngineCredentials> {
  return invokeOrMock<EngineCredentials>("clear_api_key", undefined, {
    mock: () => ({
      apiKeySet: false,
      maskedKey: "",
      lastTestAt: null,
      lastTestResult: null,
      lastRttMs: null,
      lastNode: null,
      lastError: null,
    }),
  });
}

export async function testEngineConnection(): Promise<EngineCredentials> {
  return invokeOrMock<EngineCredentials>("test_engine_connection", undefined, {
    // mock 模拟 RTT 测量 + 95% 概率成功
    mock: () => ({
      ...BROWSER_DEFAULT_CREDENTIALS,
      lastTestAt: "刚刚",
      lastRttMs: 180 + Math.floor(Math.random() * 200),
      lastTestResult: Math.random() < 0.95 ? "success" : "fail",
    }),
  });
}
