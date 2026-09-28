import { useEffect, useRef } from "react";
import type { ReactElement, ReactNode } from "react";

export type WorkspacePanel =
  "design" | "camera" | "rendering" | "diagnostics" | "help" | "information" | "overflow" | null;

export function isWorkspaceShortcut(event: KeyboardEvent): boolean {
  if (
    event.defaultPrevented ||
    event.repeat ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.isComposing ||
    document.fullscreenElement
  )
    return false;
  const target = event.target instanceof Element ? event.target : document.activeElement;
  return !target?.closest(
    'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="searchbox"], [role="spinbutton"]',
  );
}

/** Non-modal panels leave the viewport usable and return keyboard focus on dismissal. */
export function TransientPanel({
  id,
  title,
  open,
  onClose,
  children,
  drawer = false,
}: {
  id: string;
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  drawer?: boolean;
}): ReactElement {
  const panel = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement;
    panel.current?.focus();
    const dismiss = (event: KeyboardEvent): void => {
      if (event.key !== "Escape" || document.fullscreenElement) return;
      event.preventDefault();
      close.current();
    };
    const outside = (event: PointerEvent): void => {
      if (
        event.target instanceof Node &&
        !panel.current?.contains(event.target) &&
        !(event.target instanceof Element && event.target.closest(".primary-toolbar"))
      )
        close.current();
    };
    window.addEventListener("keydown", dismiss);
    window.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("keydown", dismiss);
      window.removeEventListener("pointerdown", outside);
      if (
        panel.current?.contains(document.activeElement) &&
        trigger instanceof HTMLElement &&
        trigger.isConnected
      )
        trigger.focus();
    };
  }, [open]);
  return (
    <section
      ref={panel}
      id={id}
      role="dialog"
      aria-label={title}
      tabIndex={-1}
      hidden={!open}
      className={`transient-panel${drawer ? " diagnostics-drawer" : ""}`}
    >
      <div className="panel-heading">
        <h2>{title}</h2>
        <button aria-label={`Close ${title}`} onClick={onClose}>
          ×
        </button>
      </div>
      {children}
    </section>
  );
}

export function NavigationHelp({
  mode,
}: {
  mode: "2D" | "inspection" | "walk" | "embedded";
}): ReactElement {
  return (
    <>
      {mode === "2D" ? (
        <p>Drag to pan · Scroll or pinch to zoom · Arrow keys to pan · + / − to zoom · 0 to fit</p>
      ) : mode === "walk" ? (
        <p>
          WASD / arrows to walk · Left-drag to look · Shift: fast · Option (Mac) / Space (Windows,
          Linux): slow · No collisions
        </p>
      ) : mode === "inspection" ? (
        <p>Drag to orbit · Right-drag to pan · Scroll to zoom</p>
      ) : (
        <p>
          Embedded camera uses the Apartment SVG position and field of view. Choose Inspection to
          orbit or Walk to move.
        </p>
      )}
      <p>
        2: 2D · 3: 3D · W: Walk (in 3D) · I: Inspection (in 3D) · Escape: close a panel or exit full
        screen
      </p>
    </>
  );
}
