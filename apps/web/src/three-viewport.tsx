import type { ArchitecturalModel3D } from "@planaxis/model-3d";
import {
  createApartmentRenderer,
  FULL_FRAME_FOCAL_LENGTHS,
  isFullFrameFocalLength,
  DEFAULT_PRESENTATION_SETTINGS,
  PRESENTATION_TONE_MAPPINGS,
  isPresentationToneMapping,
} from "@planaxis/renderer-three";
import type {
  ApartmentRenderer,
  FullFrameFocalLength,
  RendererPresentationSettings,
} from "@planaxis/renderer-three";
import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import {
  fitRenderSurface,
  isRenderAspectRatio,
  RENDER_ASPECT_RATIO_OPTIONS,
} from "./render-aspect-ratio.js";
import type { RenderAspectRatio } from "./render-aspect-ratio.js";

// Not a valid Apartment SVG ID, so an embedded camera cannot shadow this choice.
const WALK_VIEW = "@walk";

export function ThreeViewport({
  model,
  onFailure,
  isFocusView = false,
}: {
  model: ArchitecturalModel3D;
  onFailure: (error: unknown) => void;
  isFocusView?: boolean;
}): ReactElement {
  const renderArea = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ApartmentRenderer | null>(null);
  const resizeRenderer = useRef<() => void>(() => undefined);
  const [cameraId, setCameraId] = useState("");
  const [focalLength, setFocalLength] = useState<FullFrameFocalLength | null>(null);
  const [aspectRatio, setAspectRatio] = useState<RenderAspectRatio>("fill");
  const aspectRatioRef = useRef<RenderAspectRatio>(aspectRatio);
  aspectRatioRef.current = aspectRatio;
  const [ready, setReady] = useState(false);
  const [presentation, setPresentation] = useState(DEFAULT_PRESENTATION_SETTINGS);
  const presentationRef = useRef(presentation);
  presentationRef.current = presentation;
  const updatePresentation = (update: Partial<RendererPresentationSettings>): void => {
    const next = { ...presentationRef.current, ...update };
    try {
      renderer.current?.setPresentationSettings(next);
      presentationRef.current = next;
      setPresentation(next);
    } catch (error) {
      onFailure(error);
    }
  };
  useEffect(() => {
    const element = canvas.current;
    const area = renderArea.current;
    if (!element || !area) return;
    let active = true;
    let instance: ApartmentRenderer | undefined;
    let observer: ResizeObserver | undefined;
    setReady(false);
    const fail = (error: unknown): void => {
      if (active) onFailure(error);
    };
    try {
      instance = createApartmentRenderer(element, fail);
      renderer.current = instance;
      instance.setPresentationSettings(presentationRef.current);
      const resize = (): void => {
        try {
          const rect = area.getBoundingClientRect();
          const frame = fitRenderSurface(rect.width, rect.height, aspectRatioRef.current);
          element.style.width = `${frame.width}px`;
          element.style.height = `${frame.height}px`;
          element.style.left = `${frame.left}px`;
          element.style.top = `${frame.top}px`;
          instance?.resize(frame.width, frame.height, window.devicePixelRatio);
        } catch (error) {
          fail(error);
        }
      };
      resizeRenderer.current = resize;
      resize();
      instance.setModel(model);
      observer = new ResizeObserver(resize);
      observer.observe(area);
      void instance
        .initialize()
        .then(() => {
          if (active) setReady(true);
        })
        .catch(fail);
    } catch (error) {
      fail(error);
    }
    return () => {
      active = false;
      observer?.disconnect();
      instance?.dispose();
      renderer.current = null;
      resizeRenderer.current = () => undefined;
    };
  }, [model, onFailure]);
  useEffect(() => {
    resizeRenderer.current();
  }, [aspectRatio, isFocusView]);
  return (
    <section className="three-viewport" aria-label="3D apartment view">
      <div className="three-toolbar focus-view-hidden" hidden={isFocusView}>
        <label>
          Camera{" "}
          <select
            aria-label="3D camera"
            value={cameraId}
            disabled={!ready}
            onChange={(event) => {
              const id = event.target.value;
              try {
                if (id === WALK_VIEW) {
                  if (model.cameras.length === 0) return;
                  renderer.current?.selectWalk();
                } else {
                  renderer.current?.selectCamera(id || null);
                }
                setCameraId(id);
              } catch (error) {
                onFailure(error);
              }
            }}
          >
            <option value="">Inspection / orbit</option>
            <option value={WALK_VIEW} disabled={model.cameras.length === 0}>
              Walk
            </option>
            {model.cameras.map((camera) => (
              <option key={camera.id} value={camera.id}>
                {camera.id}
              </option>
            ))}
          </select>
        </label>
        <label>
          Focal length{" "}
          <select
            aria-label="3D focal length"
            value={focalLength ?? ""}
            disabled={!ready}
            onChange={(event) => {
              const value = event.target.value;
              const next = value === "" ? null : Number(value);
              if (next !== null && !isFullFrameFocalLength(next)) return;
              try {
                renderer.current?.setFocalLengthOverride(next);
                setFocalLength(next);
              } catch (error) {
                onFailure(error);
              }
            }}
          >
            <option value="">Camera default</option>
            {FULL_FRAME_FOCAL_LENGTHS.map((value) => (
              <option key={value} value={value}>
                {value} mm
              </option>
            ))}
          </select>
        </label>
        <label>
          Aspect ratio{" "}
          <select
            aria-label="3D render aspect ratio"
            value={aspectRatio}
            disabled={!ready}
            onChange={(event) => {
              const value = event.target.value;
              if (isRenderAspectRatio(value)) setAspectRatio(value);
            }}
          >
            {RENDER_ASPECT_RATIO_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tone mapping{" "}
          <select
            aria-label="3D tone mapping"
            value={presentation.toneMapping}
            disabled={!ready}
            onChange={(event) => {
              const toneMapping = event.target.value;
              if (isPresentationToneMapping(toneMapping)) updatePresentation({ toneMapping });
            }}
          >
            {PRESENTATION_TONE_MAPPINGS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="presentation-slider">
          Exposure: {presentation.exposureEv} EV
          <input
            type="range"
            aria-label="3D exposure (EV)"
            min={-4}
            max={4}
            step={0.1}
            value={presentation.exposureEv}
            disabled={!ready}
            onChange={(event) => updatePresentation({ exposureEv: Number(event.target.value) })}
          />
        </label>
        <label className="presentation-slider">
          Environment intensity: {presentation.environmentIntensity}
          <input
            type="range"
            aria-label="3D environment intensity"
            min={0}
            max={4}
            step={0.1}
            value={presentation.environmentIntensity}
            disabled={!ready}
            onChange={(event) =>
              updatePresentation({ environmentIntensity: Number(event.target.value) })
            }
          />
        </label>
        <label className="presentation-slider">
          Environment rotation: {presentation.environmentRotationDegrees}°
          <input
            type="range"
            aria-label="3D environment rotation (degrees)"
            min={0}
            max={360}
            step={1}
            value={presentation.environmentRotationDegrees}
            disabled={!ready}
            onChange={(event) =>
              updatePresentation({ environmentRotationDegrees: Number(event.target.value) })
            }
          />
        </label>
        <span>
          {ready
            ? cameraId === WALK_VIEW
              ? "WASD / arrows to walk · Left-drag to look · Shift: fast · Option (Mac) / Space (Windows, Linux): slow · No collisions"
              : cameraId
                ? "Embedded camera"
                : "Drag to orbit · Right-drag to pan · Scroll to zoom"
            : "Starting 3D…"}
        </span>
        {model.cameras.length === 0 && (
          <span>Free walk requires at least one camera in the Apartment SVG.</span>
        )}
      </div>
      <div ref={renderArea} className="three-render-area">
        <canvas ref={canvas} tabIndex={0} aria-label="Apartment 3D rendering" />
      </div>
    </section>
  );
}
