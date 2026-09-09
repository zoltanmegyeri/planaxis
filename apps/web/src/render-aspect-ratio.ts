export const RENDER_ASPECT_RATIO_OPTIONS = [
  { value: "fill", label: "Fill", ratio: null },
  { value: "16:9", label: "16:9", ratio: 16 / 9 },
  { value: "3:2", label: "3:2", ratio: 3 / 2 },
  { value: "1:1", label: "1:1", ratio: 1 },
  { value: "2:3", label: "2:3", ratio: 2 / 3 },
  { value: "9:16", label: "9:16", ratio: 9 / 16 },
] as const;

export type RenderAspectRatio = (typeof RENDER_ASPECT_RATIO_OPTIONS)[number]["value"];

export interface RenderSurfaceFrame {
  readonly width: number;
  readonly height: number;
  readonly left: number;
  readonly top: number;
}

export function isRenderAspectRatio(value: string): value is RenderAspectRatio {
  return RENDER_ASPECT_RATIO_OPTIONS.some((option) => option.value === value);
}

export function fitRenderSurface(
  availableWidth: number,
  availableHeight: number,
  selection: RenderAspectRatio,
): RenderSurfaceFrame {
  const width = Math.max(0, availableWidth);
  const height = Math.max(0, availableHeight);
  const ratio = RENDER_ASPECT_RATIO_OPTIONS.find((option) => option.value === selection)?.ratio;
  if (ratio === null || ratio === undefined || height === 0) {
    return { width, height, left: 0, top: 0 };
  }

  const fittedWidth = width / height > ratio ? height * ratio : width;
  const fittedHeight = width / height > ratio ? height : width / ratio;
  return {
    width: fittedWidth,
    height: fittedHeight,
    left: (width - fittedWidth) / 2,
    top: (height - fittedHeight) / 2,
  };
}
