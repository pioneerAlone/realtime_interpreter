import React, { useState, useEffect } from "react";
import { useEngineStore } from "../store/engine";

/**
 * EngineCredentialsSection — 设置 → 引擎凭证 section v0（T-G-06）
 *
 * Layout（per design freeze §7.2）：
 *   API Key  [•••••••••••••••3F2A] [修改]
 *           ─────────────────────────────────────
 *           [⚡ 测试连接]  [保存]
 *           ─────────────────────────────────────
 *           ⚠ RTT 412ms · 偏高
 *             上次测试 · 火山引擎北京节点 · 建议换个时段重测
 *
 * 状态机（per design freeze §7.1）：
 *   未设置 / 已保存 / 测试中 / 成功 / 失败
 *
 * 决策来源: `.scratch/gui-rebuild-v0.md` §7 + §10.1 T-G-06
 * Ticket:    #32 (T-G-06)
 */
export default function EngineCredentialsSection(): React.ReactElement {
  const credentials = useEngineStore((s) => s.credentials);
  const loadCredentials = useEngineStore((s) => s.loadCredentials);
  const setApiKey = useEngineStore((s) => s.setApiKey);
  const clearApiKey = useEngineStore((s) => s.clearApiKey);
  const testConnection = useEngineStore((s) => s.testConnection);

  const [editing, setEditing] = useState(!credentials.apiKeySet);
  const [draftKey, setDraftKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // mount 时加载
  useEffect(() => {
    void loadCredentials();
  }, [loadCredentials]);

  const rttTone: "success" | "warn" | "error" =
    credentials.lastRttMs === null
      ? "error"
      : credentials.lastRttMs < 200
        ? "success"
        : credentials.lastRttMs < 500
          ? "warn"
          : "error";

  const statusLabel = !credentials.apiKeySet
    ? "未设置"
    : credentials.lastTestResult === null
      ? "已保存 · 待测试"
      : credentials.lastTestResult === "success"
        ? `已保存 · RTT ${credentials.lastRttMs}ms`
        : "已保存 · 测试失败";

  const handleSave = async (): Promise<void> => {
    if (!draftKey.trim()) {
      setError("API Key 不能为空");
      return;
    }
    setError(null);
    try {
      await setApiKey(draftKey);
      setDraftKey("");
      setEditing(false);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleClear = async (): Promise<void> => {
    await clearApiKey();
    setEditing(true);
    setDraftKey("");
  };

  const handleTest = async (): Promise<void> => {
    setTesting(true);
    setError(null);
    try {
      await testConnection();
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rt-engine-creds" data-component="engine-credentials">
      {/* API Key input row */}
      <div className="rt-engine-creds-row">
        <label className="rt-engine-creds-label" htmlFor="engine-api-key">
          API Key
        </label>
        {!editing && credentials.apiKeySet ? (
          <div className="rt-engine-creds-display">
            <span className="rt-engine-creds-masked">
              •••••••••••••••{credentials.maskedKey}
            </span>
            <button
              type="button"
              className="rt-btn rt-btn-ghost rt-engine-creds-edit-btn"
              onClick={() => setEditing(true)}
            >
              修改
            </button>
          </div>
        ) : (
          <div className="rt-engine-creds-edit">
            <input
              id="engine-api-key"
              type="password"
              className="rt-engine-creds-input"
              placeholder="输入 API Key"
              value={draftKey}
              onChange={(e) => setDraftKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              className="rt-btn rt-btn-dark rt-engine-creds-save-btn"
              onClick={handleSave}
              disabled={!draftKey.trim()}
            >
              保存
            </button>
            {credentials.apiKeySet && (
              <button
                type="button"
                className="rt-btn rt-btn-ghost"
                onClick={() => {
                  setEditing(false);
                  setDraftKey("");
                }}
              >
                取消
              </button>
            )}
          </div>
        )}
      </div>

      <div className="rt-engine-creds-divider" />

      {/* Test + clear actions */}
      <div className="rt-engine-creds-actions">
        <button
          type="button"
          className="rt-btn rt-btn-dark rt-engine-creds-test-btn"
          onClick={handleTest}
          disabled={!credentials.apiKeySet || testing}
        >
          {testing ? "测试中…" : "⚡ 测试连接"}
        </button>
        {credentials.apiKeySet && (
          <button
            type="button"
            className="rt-btn rt-btn-ghost rt-btn-danger"
            onClick={handleClear}
          >
            清除 Key
          </button>
        )}
      </div>

      <div className="rt-engine-creds-divider" />

      {/* Status panel */}
      <div className="rt-engine-creds-status">
        {credentials.lastTestResult === "success" && credentials.lastRttMs !== null && (
          <div className="rt-engine-creds-status-row" data-tone={rttTone}>
            <span
              className="rt-engine-creds-status-icon"
              data-tone={rttTone}
              aria-hidden="true"
            >
              {rttTone === "success" ? "●" : "⚠"}
            </span>
            <div className="rt-engine-creds-status-text">
              <div>
                <strong>RTT {credentials.lastRttMs}ms</strong>
                {rttTone === "warn" && " · 偏高"}
                {rttTone === "error" && " · 过高"}
              </div>
              <div className="rt-engine-creds-status-meta">
                上次测试 · {credentials.lastTestAt ?? "—"} · {credentials.lastNode ?? "—"}
                {rttTone === "warn" && " · 建议换个时段重测"}
              </div>
            </div>
          </div>
        )}

        {credentials.lastTestResult === "fail" && (
          <div className="rt-engine-creds-status-row" data-tone="error">
            <span
              className="rt-engine-creds-status-icon"
              data-tone="error"
              aria-hidden="true"
            >
              ●
            </span>
            <div className="rt-engine-creds-status-text">
              <div>
                <strong>连接失败</strong>
                {credentials.lastError ? ` · ${credentials.lastError}` : ""}
              </div>
              <div className="rt-engine-creds-status-meta">
                上次测试 · {credentials.lastTestAt ?? "—"} · {credentials.lastNode ?? "—"}
                · 检查 API Key 是否有效
              </div>
            </div>
          </div>
        )}

        {!credentials.apiKeySet && (
          <div className="rt-engine-creds-status-row" data-tone="idle">
            <span
              className="rt-engine-creds-status-icon"
              data-tone="idle"
              aria-hidden="true"
            >
              ○
            </span>
            <div className="rt-engine-creds-status-text">
              <div>
                <strong>尚未设置 API Key</strong>
              </div>
              <div className="rt-engine-creds-status-meta">
                输入 API Key 后可点测试连接验证
              </div>
            </div>
          </div>
        )}

        {credentials.apiKeySet && credentials.lastTestResult === null && (
          <div className="rt-engine-creds-status-row" data-tone="idle">
            <span
              className="rt-engine-creds-status-icon"
              data-tone="idle"
              aria-hidden="true"
            >
              ○
            </span>
            <div className="rt-engine-creds-status-text">
              <div>
                <strong>已保存 · 待测试</strong>
              </div>
              <div className="rt-engine-creds-status-meta">
                点「⚡ 测试连接」测引擎 RTT
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="rt-engine-creds-error" role="alert">
            {error}
          </div>
        )}
      </div>

      <div className="rt-engine-creds-status-summary">
        <span>状态：</span>
        <span className={`rt-precheck-status`} data-tone={
          !credentials.apiKeySet ? "idle" :
          credentials.lastTestResult === null ? "warn" :
          credentials.lastTestResult === "success" ? "success" : "error"
        }>
          {statusLabel}
        </span>
      </div>
    </div>
  );
}
