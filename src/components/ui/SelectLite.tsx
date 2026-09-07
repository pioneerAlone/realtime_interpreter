/**
 * SelectLite — minimal custom dropdown. Architecture pattern borrowed from
 * Open-Less (`openless-all/app/src/components/ui/SelectLite.tsx`).
 *
 * Why custom (not native <select>):
 * - WKWebView renders native <select> as NSPopUpButton which can look
 *   jarring in a system-themed card; Win32 ComboBox is uglier.
 * - We need keyboard navigation (Arrow/Enter/Esc/Tab), click-outside
 *   close, an exit animation, and a check-glyph on the selected row —
 *   all of which are awkward on the native element.
 *
 * What this implementation does NOT carry from Open-Less (intentional
 * simplification, not feature drift):
 * - CSS-zoom compensation (we don't ship a fontScale feature at v0).
 * - i18n label plumbing (English/Chinese labels are hard-coded at call
 *   sites until we adopt i18next).
 * - trailing-level-meter slot (Topology pickers don't need mic level at
 *   the panel; audio-level monitoring is its own ticket).
 *
 * Visual contract — mirrors Open-Less tokens.css palette so the v0
 * Topology panel feels native next to any future Open-Less-style UI:
 * - trigger: 32px tall, 0.5px border, 8px radius, system-aware bg
 * - popover: portal, 0.5px border, 6px radius, 280px maxHeight,
 *           selected row tinted bg + check on right
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectLiteProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  style?: CSSProperties;
  ariaLabel?: string;
  /** Render in the option row (right side, before check). */
  trailing?: ReactNode;
  /** Loading skeleton state — disables + shows spinner instead of value. */
  loading?: boolean;
  /** Trigger label when loading=true. Default: "Loading..." */
  loadingLabel?: string;
}

const EXIT_ANIM_MS = 140;

export function SelectLite({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  style,
  ariaLabel,
  trailing,
  loading = false,
  loadingLabel,
}: SelectLiteProps) {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [highlight, setHighlight] = useState<number>(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [anchor, setAnchor] = useState<{ left: number; top: number; width: number } | null>(null);
  const [popoverMounted, setPopoverMounted] = useState(false);

  const selected = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value],
  );
  const displayLabel = loading
    ? loadingLabel ?? "Loading..."
    : selected?.label ?? placeholder ?? "";

  const positionPopover = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const popoverHeight = popoverRef.current?.getBoundingClientRect().height ?? 280;
    const spaceBelow = window.innerHeight - rect.bottom;
    const flipUp = spaceBelow < popoverHeight + 8 && rect.top > popoverHeight + 8;
    const visualTop = flipUp ? rect.top - popoverHeight - 4 : rect.bottom + 4;
    const minLeft = 8;
    const maxLeft = Math.max(minLeft, window.innerWidth - rect.width - 8);
    const visualLeft = Math.min(Math.max(rect.left, minLeft), maxLeft);
    setAnchor({
      left: visualLeft,
      top: visualTop,
      width: rect.width,
    });
  }, []);

  const setPopoverRef = useCallback((node: HTMLDivElement | null) => {
    popoverRef.current = node;
    setPopoverMounted(!!node);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    positionPopover();
  }, [open, popoverMounted, positionPopover]);

  useEffect(() => {
    if (!open || highlight < 0) return;
    const target = popoverRef.current?.querySelector(
      `[data-option-index="${highlight}"]`,
    ) as HTMLElement | null;
    target?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      closeMenu();
    };
    const handleScrollOutside = (event: Event) => {
      const target = event.target as Node | null;
      if (target && popoverRef.current?.contains(target)) return;
      closeMenu();
    };
    const handleResize = () => closeMenu();

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("scroll", handleScrollOutside, { capture: true, passive: true });
    window.addEventListener("wheel", handleScrollOutside, { capture: true, passive: true });
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("scroll", handleScrollOutside, true);
      window.removeEventListener("wheel", handleScrollOutside, true);
      window.removeEventListener("resize", handleResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const openMenu = () => {
    if (disabled || loading) return;
    const initial = options.findIndex((opt) => opt.value === value && !opt.disabled);
    setHighlight(initial >= 0 ? initial : options.findIndex((opt) => !opt.disabled));
    setLeaving(false);
    setOpen(true);
  };

  const closeMenu = () => {
    if (!open) return;
    setLeaving(true);
    window.setTimeout(() => {
      setOpen(false);
      setLeaving(false);
      setHighlight(-1);
      setAnchor(null);
    }, EXIT_ANIM_MS);
  };

  const selectIndex = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    closeMenu();
    triggerRef.current?.focus();
  };

  const moveHighlight = (direction: 1 | -1) => {
    if (options.length === 0) return;
    let next = highlight;
    for (let i = 0; i < options.length; i += 1) {
      next = (next + direction + options.length) % options.length;
      if (!options[next]?.disabled) {
        setHighlight(next);
        return;
      }
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;
    if (!open) {
      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();
        openMenu();
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      moveHighlight(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveHighlight(-1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (highlight >= 0) selectIndex(highlight);
    } else if (event.key === "Tab") {
      closeMenu();
    }
  };

  const triggerStyle: CSSProperties = {
    ...style,
    opacity: disabled || loading ? 0.5 : 1,
    cursor: disabled || loading ? "not-allowed" : "default",
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="select-lite__trigger"
        style={triggerStyle}
        disabled={disabled || loading}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-busy={loading || undefined}
      >
        <span className="select-lite__value">{displayLabel}</span>
        <span className="select-lite__chevron" aria-hidden>
          {loading ? "⋯" : open ? "▴" : "▾"}
        </span>
      </button>

      {open && anchor
        ? createPortal(
            <div
              ref={setPopoverRef}
              className={`select-lite__popover${leaving ? " select-lite__popover--leaving" : ""}`}
              role="listbox"
              aria-label={ariaLabel}
              style={{
                left: anchor.left,
                top: anchor.top,
                width: anchor.width,
              }}
            >
              {options.length === 0 ? (
                <div className="select-lite__empty">No options</div>
              ) : (
                options.map((option, idx) => {
                  const isSelected = option.value === value;
                  const isHighlight = idx === highlight;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      data-option-index={idx}
                      className={`select-lite__option${
                        isHighlight ? " select-lite__option--highlight" : ""
                      }${isSelected ? " select-lite__option--selected" : ""}`}
                      onMouseEnter={() => setHighlight(idx)}
                      onClick={() => selectIndex(idx)}
                      disabled={option.disabled}
                    >
                      <span className="select-lite__option-label">{option.label}</span>
                      {trailing && (
                        <span className="select-lite__option-trailing">{trailing}</span>
                      )}
                      {isSelected && (
                        <span className="select-lite__option-check" aria-hidden>
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}