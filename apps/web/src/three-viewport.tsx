import type { ArchitecturalModel3D } from "@planaxis/model-3d";
import { createApartmentRenderer } from "@planaxis/renderer-three";
import type { ApartmentRenderer } from "@planaxis/renderer-three";
import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

export function ThreeViewport({
  model,
  onFailure,
}: {
  model: ArchitecturalModel3D;
  onFailure: (error: unknown) => void;
}): ReactElement {
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ApartmentRenderer | null>(null);
  const [cameraId, setCameraId] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let active = true;
    let instance: ApartmentRenderer | undefined;
    let observer: ResizeObserver | undefined;
    const fail = (error: unknown): void => {
      if (active) onFailure(error);
    };
    try {
      instance = createApartmentRenderer(element, fail);
      renderer.current = instance;
      const resize = (): void => {
        try {
          const rect = element.getBoundingClientRect();
          instance?.resize(rect.width, rect.height, window.devicePixelRatio);
        } catch (error) {
          fail(error);
        }
      };
      resize();
      instance.setModel(model);
      observer = new ResizeObserver(resize);
      observer.observe(element);
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
    };
  }, [model, onFailure]);
  return (
    <section className="three-viewport" aria-label="3D apartment view">
      <div className="three-toolbar">
        <label>
          Camera{" "}
          <select
            aria-label="3D camera"
            value={cameraId}
            disabled={!ready}
            onChange={(event) => {
              const id = event.target.value;
              try {
                renderer.current?.selectCamera(id || null);
                setCameraId(id);
              } catch (error) {
                onFailure(error);
              }
            }}
          >
            <option value="">Inspection / orbit</option>
            {model.cameras.map((camera) => (
              <option key={camera.id} value={camera.id}>
                {camera.id}
              </option>
            ))}
          </select>
        </label>
        <span>
          {ready
            ? cameraId
              ? "Embedded camera"
              : "Drag to orbit · Right-drag to pan · Scroll to zoom"
            : "Starting 3D…"}
        </span>
      </div>
      <canvas ref={canvas} aria-label="Apartment 3D rendering" />
    </section>
  );
}
