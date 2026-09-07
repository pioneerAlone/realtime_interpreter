import React, { useEffect, useState } from "react";
import { ping, version } from "../lib/ipc";
import { useSessionStore } from "../store/session";
import { APP_ICON_DATA_URL } from "../assets/icon";

type PingResult = { status: "ok" | "err"; text: string };

export default function MainView(): React.ReactElement {
  const r3 = useSessionStore((s) => s.r3);
  const r4 = useSessionStore((s) => s.r4);
  const [pingRes, setPingRes] = useState<PingResult>({ status: "err", text: "…" });
  const [ver, setVer] = useState<string>("…");

  useEffect(() => {
    ping()
      .then((p) => setPingRes({ status: "ok", text: p }))
      .catch((e: unknown) => setPingRes({ status: "err", text: String(e) }));
    version()
      .then((v) => setVer(v.version))
      .catch((e: unknown) => setVer(`error: ${String(e)}`));
  }, []);

  return (
    <div className="app">
      <div className="app-header">
        <img className="app-icon" src={APP_ICON_DATA_URL} alt="realtime_interpreter" />
        <div className="app-title">realtime_interpreter</div>
        <div className="spacer" />
        <span className="muted">v0 scaffold</span>
      </div>

      <div className="app-body">
        <section className="app-section">
          <div className="section-title">Backend handshake</div>
          <div className="card">
            <div className="card-grid">
              <div className="stat">
                <span className="stat-label">IPC</span>
                <span className="stat-value">
                  <span
                    className={`status-dot ${pingRes.status === "ok" ? "running" : "error"}`}
                  />
                  {pingRes.text}
                </span>
              </div>
              <div className="stat">
                <span className="stat-label">Version</span>
                <span className="stat-value">{ver}</span>
              </div>
              <div className="stat">
                <span className="stat-label">IPC contract</span>
                <span className="stat-value">1.0.0</span>
              </div>
            </div>
          </div>
        </section>

        <section className="app-section">
          <div className="section-title">Channels</div>
          <div className="card">
            <div className="card-grid">
              <div className="stat">
                <span className="stat-label">R3 — 你 → 客户 (s2s)</span>
                <span className="stat-value">
                  <span
                    className={`status-dot ${
                      r3 === "running" ? "running" : r3 === "error" ? "error" : "idle"
                    }`}
                  />
                  {r3}
                </span>
              </div>
              <div className="stat">
                <span className="stat-label">R4 — 客户 → 字幕 (s2t)</span>
                <span className="stat-value">
                  <span
                    className={`status-dot ${
                      r4 === "running" ? "running" : r4 === "error" ? "error" : "idle"
                    }`}
                  />
                  {r4}
                </span>
              </div>
            </div>
            <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>
              Channels are wired in tickets <span className="kbd">#03</span> (R3) and{" "}
              <span className="kbd">#04</span> (R4).
            </p>
          </div>
        </section>

        <section className="app-section">
          <div className="section-title">Hotkeys</div>
          <div className="card">
            <div className="card-grid">
              <div className="stat">
                <span className="stat-label">Toggle subtitle</span>
                <span className="stat-value">
                  <span className="kbd">Right Option</span>
                </span>
              </div>
              <div className="stat">
                <span className="stat-label">原声直出 toggle</span>
                <span className="stat-value">
                  <span className="kbd">⌃</span>
                  <span className="kbd">⌥</span>
                  <span className="kbd">P</span>
                </span>
              </div>
              <div className="stat">
                <span className="stat-label">Hide subtitle</span>
                <span className="stat-value">
                  <span className="kbd">⌃</span>
                  <span className="kbd">⌥</span>
                  <span className="kbd">H</span>
                </span>
              </div>
            </div>
            <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>
              Hotkeys require Accessibility permission (System Settings → Privacy &amp;
              Security → Accessibility). On first launch macOS prompts automatically.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
