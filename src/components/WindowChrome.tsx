/**
 * WindowChrome — outer wrapper for the main window.
 *
 * Architecture borrowed from Open-Less
 * (`/tmp/openless/openless-all/app/src/components/WindowChrome.tsx`).
 * Why we need this:
 * - `tauri.conf.json` `titleBarStyle: "Overlay"` + `decorations: true`
 *   draws the macOS native title bar (with traffic lights) but
 *   does NOT add a drag region inside the WebView — clicks below
 *   the traffic-light strip don't move the window.
 * - Open-Less solves this with a 28-px absolute-positioned drag
 *   strip (with `data-tauri-drag-region` attribute) that covers
 *   the right 1164 px of row 0 (76 px is reserved for traffic
 *   lights at x=14 y=20).
 * - We copy that exact pattern.
 *
 * `data-tauri-drag-region` is the Tauri 2 official way to make
 * content drag the window — it injects NSWindow drag handlers
 * into the WebView's element. (See Tauri 2 docs: "Custom window
 * chrome" → "Data-tauri-drag-region".)
 *
 * On Linux / Windows, the macOS title bar doesn't exist, so we
 * render a full-width drag strip.
 */

import { type ReactNode } from "react";

const MAC_TITLEBAR_HEIGHT = 28;
const MAC_SYSTEM_CONTROLS_RESERVED_WIDTH = 76;

export function WindowChrome({ children }: { children: ReactNode }) {
  // macOS-only path; Linux/Windows fall through to a full-width
  // drag strip. (Open-Less's full Linux title bar implementation is
  // complex; for v0 we just ship a drag strip + the user can resize
  // the window via its native chrome.)
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const isLinux = typeof navigator !== "undefined" && /Linux/.test(navigator.platform);

  return (
    <div className="rt-winchrome">
      {/* Drag region for the top strip. On macOS, the strip starts
       * 76 px from the left (skipping the traffic-light area); on
       * Linux/Windows the strip covers the full width. */}
      {isMac && (
        <div
          data-tauri-drag-region
          className="rt-winchrome__drag-strip"
          style={{
            position: "absolute",
            top: 0,
            left: MAC_SYSTEM_CONTROLS_RESERVED_WIDTH,
            right: 0,
            height: MAC_TITLEBAR_HEIGHT,
            zIndex: 50,
          }}
        />
      )}
      {!isMac && !isLinux && (
        <div
          data-tauri-drag-region
          className="rt-winchrome__drag-strip"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: MAC_TITLEBAR_HEIGHT,
            zIndex: 50,
          }}
        />
      )}
      <div className="rt-winchrome__body">{children}</div>
    </div>
  );
}