import React, { useEffect, useState } from "react";
import { ping, version } from "../lib/ipc";
import { useSessionStore } from "../store/session";

export default function MainView(): React.ReactElement {
  const r3 = useSessionStore((s) => s.r3);
  const r4 = useSessionStore((s) => s.r4);
  const [pong, setPong] = useState<string>("(not yet called)");
  const [ver, setVer] = useState<string>("(checking...)");

  useEffect(() => {
    ping()
      .then(setPong)
      .catch((e: unknown) => setPong(`error: ${String(e)}`));
    version()
      .then((v) => setVer(`${v.version} (contract ${v.contract})`))
      .catch((e: unknown) => setVer(`error: ${String(e)}`));
  }, []);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ fontSize: 18, fontWeight: 600 }}>realtime_interpreter</h1>
      <p style={{ color: "var(--fg-secondary)" }}>v0 scaffold — main window</p>

      <section
        style={{
          background: "var(--bg-secondary)",
          borderRadius: 8,
          padding: 16,
        }}
      >
        <h2 style={{ fontSize: 14, marginBottom: 8 }}>Backend handshake</h2>
        <p>ping: <code>{pong}</code></p>
        <p>version: <code>{ver}</code></p>
      </section>

      <section
        style={{
          background: "var(--bg-secondary)",
          borderRadius: 8,
          padding: 16,
        }}
      >
        <h2 style={{ fontSize: 14, marginBottom: 8 }}>Session state</h2>
        <p>R3 (你→客户): <code>{r3}</code></p>
        <p>R4 (客户→字幕): <code>{r4}</code></p>
        <p style={{ color: "var(--fg-secondary)", fontSize: 11, marginTop: 8 }}>
          Channels are wired in tickets #03 (R3) and #04 (R4).
        </p>
      </section>
    </div>
  );
}
