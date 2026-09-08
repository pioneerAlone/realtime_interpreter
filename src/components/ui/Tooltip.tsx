/**
 * Tooltip — minimal hover/focus hint bubble, Open-Less architecture.
 *
 * v0 simplification vs Open-Less:
 * - placement: `top` only (we don't need right/bottom for v0; saves
 *   the flip-up-vs-down flip logic).
 * - No WARM_DELAY_MS or warmUntil singleton — first hover shows
 *   immediately (we don't ship a tooltip-first impression yet).
 * - No focusable mode — desktop Tauri webview + mouse-first users;
 *   keyboard users can rely on the inlined `desc` we already show
 *   inside cards (R3 / R4 panels).
 *
 * Visual contract matches Open-Less tokens: ink-2 foreground,
 * ink-1 surface, line-strong border, r-md radius, shadow-md.
 */

import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  content: ReactNode;
  /** Allowed: `top`. Other placements reserved for v1+ per spec. */
  placement?: "top";
  /** Allow multi-line content (default false = single line). */
  wrap?: boolean;
  children: ReactNode;
}

const OFFSET_PX = 6;

export function Tooltip({ content, wrap = false, children }: TooltipProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);

  const updatePos = () => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const bubbleHeight = bubbleRef.current?.getBoundingClientRect().height ?? 24;
    const minLeft = 8;
    const maxLeft = Math.max(minLeft, window.innerWidth - rect.width - 8);
    const visualLeft = Math.min(Math.max(rect.left, minLeft), maxLeft);
    const visualTop = rect.top - bubbleHeight - OFFSET_PX;
    setPos({
      left: visualLeft,
      top: visualTop,
      width: rect.width,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleScroll = () => setOpen(false);
    const handleResize = () => setOpen(false);
    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [open]);

  const bubbleStyle: CSSProperties = {
    position: "fixed",
    zIndex: 1000,
    left: pos?.left ?? 0,
    top: pos?.top ?? 0,
    width: pos?.width,
    maxWidth: 320,
    padding: "5px 9px",
    background: "var(--tooltip-bg, #1f2937)",
    color: "var(--tooltip-fg, #f9fafb)",
    fontSize: 11.5,
    lineHeight: 1.45,
    borderRadius: 6,
    border: "0.5px solid var(--tooltip-border, rgba(0,0,0,0.18))",
    boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
    pointerEvents: "none",
    whiteSpace: wrap ? "normal" : "nowrap",
    wordBreak: wrap ? "break-word" : undefined,
  };

  /* v0.1 收尾：wrapper span 从 `display: inline-flex` 改成
   * `display: block` (默认 block 行为) + `width: 100%`。
   *  - 在 flex column 父级里 block 元素会 stretch 占满 100%
   *  - child button 内部 `display: flex` row 不受影响 (因为 button
   *    自己定位了, 跟 wrapper 是不是 flex 容器无关)
   *  - block-level wrapper 让 Tooltip 像普通容器一样参与父级
   *    flex column 的 stretch
   *  - rect tracking 用 wrapper box (与 button 同位/同宽) */
  return (
    <span
      ref={anchorRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      style={{ display: "block", width: "100%" }}
    >
      {children}
      {open && pos
        ? createPortal(
            <div
              ref={(node) => {
                bubbleRef.current = node;
              }}
              style={bubbleStyle}
              role="tooltip"
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}