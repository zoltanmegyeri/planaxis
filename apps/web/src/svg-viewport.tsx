import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactElement } from "react";
import { fitDrawing, panDrawing, zoomDrawing } from "./view-transform.js";
import type { ViewPoint, ViewSize, ViewTransform } from "./view-transform.js";

export function SvgViewport({
  source,
  name,
  isFocusView = false,
}: {
  source: string;
  name: string;
  isFocusView?: boolean;
}): ReactElement {
  const [preview, setPreview] = useState<{ url: string } | { error: string }>();
  useEffect(() => {
    let url: string;
    try {
      url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml" }));
      setPreview({ url });
    } catch {
      setPreview({ error: "Preview unavailable: the browser could not create the SVG image." });
      return;
    }
    return () => URL.revokeObjectURL(url);
  }, [source]);
  if (!preview) return <p>Preparing preview…</p>;
  if ("error" in preview) return <p role="status">{preview.error}</p>;
  return (
    <ImageViewport key={preview.url} url={preview.url} name={name} isFocusView={isFocusView} />
  );
}

function ImageViewport({
  url,
  name,
  isFocusView,
}: {
  url: string;
  name: string;
  isFocusView: boolean;
}): ReactElement {
  const container = useRef<HTMLDivElement>(null);
  const intrinsic = useRef<ViewSize | undefined>(undefined);
  const pointers = useRef(new Map<number, ViewPoint>());
  const [view, setView] = useState<ViewTransform>({ x: 0, y: 0, scale: 1 });
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [isFitted, setIsFitted] = useState(true);

  function fit(): void {
    if (container.current && intrinsic.current) {
      setView(fitDrawing(container.current.getBoundingClientRect(), intrinsic.current));
      setIsFitted(true);
    }
  }
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      if (isFitted && intrinsic.current)
        setView(fitDrawing(element.getBoundingClientRect(), intrinsic.current));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [isFitted]);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    function wheel(event: WheelEvent): void {
      event.preventDefault();
      if (!intrinsic.current || !element) return;
      const bounds = element.getBoundingClientRect();
      const delta =
        event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? bounds.height : 1);
      setIsFitted(false);
      setView((previous) =>
        zoomDrawing(previous, Math.exp(-Math.max(-500, Math.min(500, delta)) * 0.002), {
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
        }),
      );
    }
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, []);

  function zoom(factor: number): void {
    const bounds = container.current?.getBoundingClientRect();
    if (!bounds) return;
    setIsFitted(false);
    setView((previous) =>
      zoomDrawing(previous, factor, { x: bounds.width / 2, y: bounds.height / 2 }),
    );
  }
  function position(event: ReactPointerEvent<HTMLDivElement>): ViewPoint {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }
  function move(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!pointers.current.has(event.pointerId)) return;
    const before = [...pointers.current.values()];
    pointers.current.set(event.pointerId, position(event));
    const after = [...pointers.current.values()];
    const firstBefore = before[0];
    const firstAfter = after[0];
    if (!firstBefore || !firstAfter) return;
    setIsFitted(false);
    const secondBefore = before[1];
    const secondAfter = after[1];
    if (secondBefore && secondAfter) {
      const oldCenter = midpoint(firstBefore, secondBefore);
      const newCenter = midpoint(firstAfter, secondAfter);
      const oldDistance = Math.hypot(
        firstBefore.x - secondBefore.x,
        firstBefore.y - secondBefore.y,
      );
      const newDistance = Math.hypot(firstAfter.x - secondAfter.x, firstAfter.y - secondAfter.y);
      setView((previous) =>
        panDrawing(
          zoomDrawing(previous, oldDistance > 0 ? newDistance / oldDistance : 1, oldCenter),
          { x: newCenter.x - oldCenter.x, y: newCenter.y - oldCenter.y },
        ),
      );
    } else {
      setView((previous) =>
        panDrawing(previous, { x: firstAfter.x - firstBefore.x, y: firstAfter.y - firstBefore.y }),
      );
    }
  }
  return (
    <section className="viewer" aria-label="2D floor plan">
      <div className="viewer-toolbar focus-view-hidden" hidden={isFocusView}>
        <span>
          2D floor plan <small>Read only</small>
        </span>
        <div className="view-buttons">
          <button
            disabled={status !== "ready"}
            onClick={() => zoom(1 / 1.25)}
            aria-label="Zoom out"
          >
            −
          </button>
          <output aria-label="Zoom level">{Math.round(view.scale * 100)}%</output>
          <button disabled={status !== "ready"} onClick={() => zoom(1.25)} aria-label="Zoom in">
            +
          </button>
          <button disabled={status !== "ready"} onClick={fit}>
            Fit / Reset
          </button>
        </div>
      </div>
      <div
        ref={container}
        className="drawing-surface"
        tabIndex={0}
        role="region"
        aria-label="Drawing navigation"
        aria-describedby="navigation-help"
        onKeyDown={(event) => {
          if (status !== "ready") return;
          const directions: Record<string, ViewPoint> = {
            ArrowLeft: { x: -40, y: 0 },
            ArrowRight: { x: 40, y: 0 },
            ArrowUp: { x: 0, y: -40 },
            ArrowDown: { x: 0, y: 40 },
          };
          const delta = directions[event.key];
          if (delta) {
            event.preventDefault();
            setIsFitted(false);
            setView((previous) => panDrawing(previous, delta));
          } else if (event.key === "+" || event.key === "=") {
            event.preventDefault();
            zoom(1.25);
          } else if (event.key === "-") {
            event.preventDefault();
            zoom(1 / 1.25);
          } else if (event.key === "0") {
            event.preventDefault();
            fit();
          }
        }}
        onPointerDown={(event) => {
          if (status !== "ready" || event.button !== 0) return;
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          pointers.current.set(event.pointerId, position(event));
        }}
        onPointerMove={move}
        onPointerUp={(event) => {
          pointers.current.delete(event.pointerId);
        }}
        onPointerCancel={(event) => {
          pointers.current.delete(event.pointerId);
        }}
        onLostPointerCapture={(event) => {
          pointers.current.delete(event.pointerId);
        }}
      >
        {status === "loading" && <p className="preview-message">Loading SVG preview…</p>}
        {status === "unavailable" && (
          <p className="preview-message" role="status">
            Preview unavailable: the browser could not render this SVG. Validation results remain
            available.
          </p>
        )}
        <img
          src={url}
          alt={`Original SVG floor plan: ${name}`}
          draggable={false}
          style={{
            visibility: status === "ready" ? "visible" : "hidden",
            width: intrinsic.current?.width,
            height: intrinsic.current?.height,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          }}
          onLoad={(event) => {
            const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
            if (width <= 0 || height <= 0) {
              setStatus("unavailable");
              return;
            }
            intrinsic.current = { width, height };
            setStatus("ready");
            fit();
          }}
          onError={() => setStatus("unavailable")}
        />
      </div>
      <p id="navigation-help" className="navigation-help focus-view-hidden" hidden={isFocusView}>
        Drag to pan · Scroll or pinch to zoom · Arrow keys to pan · + / − to zoom · 0 to fit
      </p>
    </section>
  );
}

function midpoint(a: ViewPoint, b: ViewPoint): ViewPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
