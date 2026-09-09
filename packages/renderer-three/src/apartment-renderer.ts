import type { ArchitecturalModel3D } from "@planaxis/model-3d";
import {
  Color,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGPURenderer,
} from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildApartmentScene } from "./apartment-scene.js";
import type { ApartmentScene } from "./apartment-scene.js";
import {
  applyEmbeddedCamera,
  frameInspection,
  fullFrameHorizontalFov,
  isFullFrameFocalLength,
  verticalFov,
} from "./cameras.js";
import type { FullFrameFocalLength } from "./cameras.js";

export interface ApartmentRenderer {
  initialize(): Promise<void>;
  setModel(model: ArchitecturalModel3D): void;
  resize(width: number, height: number, pixelRatio?: number): void;
  selectCamera(sourceId: string | null): void;
  setFocalLengthOverride(focalLengthMm: FullFrameFocalLength | null): void;
  render(): void;
  dispose(): void;
}

/** Owns GPU resources and input listeners. Rendering is event-driven, with no persistent loop. */
export function createApartmentRenderer(
  canvas: HTMLCanvasElement,
  onError: (error: unknown) => void,
): ApartmentRenderer {
  const renderer = new WebGPURenderer({ canvas, antialias: true });
  renderer.shadowMap.enabled = true;
  const scene = new Scene();
  scene.background = new Color(0xe8ecec);
  scene.add(new HemisphereLight(0xffffff, 0x8b8984, 2.5));
  const light = new DirectionalLight(0xffffff, 3);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  light.shadow.bias = -0.0002;
  scene.add(light, light.target);
  const camera = new PerspectiveCamera();
  const controls = new OrbitControls(camera, canvas);
  controls.enabled = false;
  let apartment: ApartmentScene | undefined;
  let model: ArchitecturalModel3D | undefined;
  let cameraId: string | null = null;
  let focalLengthOverride: FullFrameFocalLength | null = null;
  let aspect = 1;
  let initialized = false;
  let disposed = false;
  let initialization: Promise<void> | undefined;
  let resourcesReleased = false;
  const releaseRenderer = (): void => {
    if (resourcesReleased) return;
    resourcesReleased = true;
    renderer.dispose();
  };
  const render = (): void => {
    if (!initialized || disposed || !apartment) return;
    try {
      renderer.render(scene, camera);
    } catch (error) {
      onError(error);
    }
  };
  renderer.onDeviceLost = (info): void => {
    if (!disposed) onError(new Error(`Rendering device lost: ${info.message}`));
  };
  const applyEffectiveProjection = (): void => {
    camera.aspect = aspect;
    if (focalLengthOverride !== null) {
      camera.fov = verticalFov(fullFrameHorizontalFov(focalLengthOverride), aspect);
    } else if (cameraId === null) {
      camera.fov = 50;
    } else {
      const source = model?.cameras.find((candidate) => candidate.id === cameraId);
      if (!source) throw new Error(`Unknown apartment camera: ${cameraId}`);
      camera.fov = verticalFov(source.horizontalFov.toNumber(), aspect);
    }
    camera.updateProjectionMatrix();
  };
  const selectCamera = (id: string | null): void => {
    if (disposed || !model || !apartment) return;
    controls.enabled = false;
    if (id === null) {
      controls.target.copy(frameInspection(camera, apartment.bounds, aspect));
      controls.update();
      controls.enabled = true;
    } else {
      const source = model.cameras.find((candidate) => candidate.id === id);
      if (!source) throw new Error(`Unknown apartment camera: ${id}`);
      applyEmbeddedCamera(camera, source, aspect);
      const radius = apartment.bounds.getSize(new Vector3()).length() / 2;
      const distance = camera.position.distanceTo(apartment.bounds.getCenter(new Vector3()));
      camera.far = Math.max(camera.far, distance + radius * 2);
      camera.updateProjectionMatrix();
    }
    cameraId = id;
    applyEffectiveProjection();
    render();
  };
  controls.addEventListener("change", render);
  return {
    initialize() {
      if (disposed) return Promise.reject(new Error("Renderer is disposed."));
      initialization ??= renderer
        .init()
        .then(() => {
          if (disposed) {
            releaseRenderer();
            return;
          }
          initialized = true;
          render();
        })
        .catch((error: unknown) => {
          releaseRenderer();
          throw error;
        });
      return initialization;
    },
    setModel(next) {
      if (disposed) throw new Error("Renderer is disposed.");
      const replacement = buildApartmentScene(next);
      if (apartment) {
        scene.remove(apartment.group);
        apartment.dispose();
      }
      apartment = replacement;
      model = next;
      scene.add(apartment.group);
      const center = apartment.bounds.getCenter(new Vector3());
      const radius = Math.max(apartment.bounds.getSize(new Vector3()).length(), 0.1);
      // Scale the receiver offset with shadow texels so front-face shadows stay acne-free
      // for both small fixtures and full apartments. This never changes model geometry.
      light.shadow.normalBias = ((2 * radius) / light.shadow.mapSize.x) * 2;
      light.target.position.copy(center);
      light.position.copy(center).add(new Vector3(radius, radius * 2, radius));
      Object.assign(light.shadow.camera, {
        left: -radius,
        right: radius,
        top: radius,
        bottom: -radius,
        near: radius / 100,
        far: radius * 5,
      });
      light.shadow.camera.updateProjectionMatrix();
      selectCamera(null);
    },
    resize(width, height, pixelRatio = 1) {
      if (disposed) return;
      const w = Math.max(1, width);
      const h = Math.max(1, height);
      aspect = w / h;
      renderer.setPixelRatio(Math.max(1, Math.min(2, pixelRatio)));
      renderer.setSize(w, h, false);
      applyEffectiveProjection();
      render();
    },
    selectCamera,
    setFocalLengthOverride(focalLengthMm) {
      if (disposed) return;
      if (focalLengthMm !== null && !isFullFrameFocalLength(focalLengthMm)) {
        throw new Error(`Unsupported full-frame focal length: ${focalLengthMm}`);
      }
      focalLengthOverride = focalLengthMm;
      applyEffectiveProjection();
      render();
    },
    render,
    dispose() {
      if (disposed) return;
      disposed = true;
      controls.removeEventListener("change", render);
      controls.dispose();
      apartment?.dispose();
      light.shadow.dispose();
      scene.clear();
      // init owns in-flight backend allocation; release it when that allocation settles.
      if (!initialization || initialized) releaseRenderer();
    },
  };
}
