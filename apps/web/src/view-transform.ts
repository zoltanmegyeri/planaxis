// All values here are image/viewport pixels, never authoritative apartment geometry.
export interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}
export interface ViewSize {
  width: number;
  height: number;
}
export interface ViewPoint {
  x: number;
  y: number;
}

export function fitDrawing(viewport: ViewSize, image: ViewSize): ViewTransform {
  const scale = Math.min(
    Math.max(1, viewport.width - 48) / image.width,
    Math.max(1, viewport.height - 48) / image.height,
  );
  return {
    scale,
    x: (viewport.width - image.width * scale) / 2,
    y: (viewport.height - image.height * scale) / 2,
  };
}

export function zoomDrawing(view: ViewTransform, factor: number, anchor: ViewPoint): ViewTransform {
  const scale = Math.max(0.000001, Math.min(10000, view.scale * factor));
  const ratio = scale / view.scale;
  return {
    scale,
    x: anchor.x - (anchor.x - view.x) * ratio,
    y: anchor.y - (anchor.y - view.y) * ratio,
  };
}

export function panDrawing(view: ViewTransform, delta: ViewPoint): ViewTransform {
  return { ...view, x: view.x + delta.x, y: view.y + delta.y };
}
