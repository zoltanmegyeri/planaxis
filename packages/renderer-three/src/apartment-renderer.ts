import type { ArchitecturalModel3D } from "@planaxis/model-3d";
import {
  AmbientLight,
  Color,
  DirectionalLight,
  PerspectiveCamera,
  PCFShadowMap,
  Scene,
  Vector3,
  WebGPURenderer,
} from "three/webgpu";
import type { RenderTarget } from "three/webgpu";
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
import type { RuntimeFinishOptions } from "./runtime-materials.js";
import { WalkControls } from "./walk-controls.js";
import { applyPresentationSettings, DEFAULT_PRESENTATION_SETTINGS } from "./presentation.js";
import type { RendererPresentationSettings } from "./presentation.js";
import { createStudioEnvironment } from "./studio-environment.js";
import {
  DEFAULT_QUALITY_SETTINGS,
  FILL_LIGHT_INTENSITIES,
  isRendererQualitySettings,
  SHADOW_MAP_SIZES,
} from "./quality.js";
import type { RendererQualitySettings } from "./quality.js";

export interface ApartmentRenderer {
  initialize(): Promise<void>;
  setModel(model: ArchitecturalModel3D, finishes?: RuntimeFinishOptions): void;
  resize(width: number, height: number): void;
  selectCamera(sourceId: string | null): void;
  selectWalk(): void;
  setFocalLengthOverride(focalLengthMm: FullFrameFocalLength | null): void;
  setPresentationSettings(settings: RendererPresentationSettings): void;
  setQualitySettings(settings: RendererQualitySettings): void;
  render(): void;
  dispose(): void;
}

/** Owns GPU resources and input listeners. Continuous rendering runs only while walking. */
export function createApartmentRenderer(
  canvas: HTMLCanvasElement,
  onError: (error: unknown) => void,
): ApartmentRenderer {
  const renderer = new WebGPURenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  const scene = new Scene();
  scene.background = new Color(0xe8ecec);
  applyPresentationSettings(renderer, scene, DEFAULT_PRESENTATION_SETTINGS);
  let environment: RenderTarget | undefined;
  let quality = DEFAULT_QUALITY_SETTINGS;
  let width = 1;
  let height = 1;
  let shadowRadius = 0.1;
  let light = new DirectionalLight(0xffffff, 3);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  light.shadow.bias = -0.0002;
  // Architecture and the key light are static between model/quality updates.
  // Camera movement does not invalidate their shadow map.
  light.shadow.autoUpdate = false;
  const fillLight = new AmbientLight(0xffffff, 0);
  scene.add(light, light.target, fillLight);
  const camera = new PerspectiveCamera();
  const controls = new OrbitControls(camera, canvas);
  controls.enabled = false;
  let apartment: ApartmentScene | undefined;
  let model: ArchitecturalModel3D | undefined;
  let cameraId: string | null = null;
  let isWalking = false;
  let walk: WalkControls | undefined;
  let focalLengthOverride: FullFrameFocalLength | null = null;
  let aspect = 1;
  let initialized = false;
  let disposed = false;
  let initialization: Promise<void> | undefined;
  let resourcesReleased = false;
  let walkRenderFrame: number | undefined;
  const cancelWalkRender = (): void => {
    if (walkRenderFrame === undefined) return;
    canvas.ownerDocument.defaultView?.cancelAnimationFrame(walkRenderFrame);
    walkRenderFrame = undefined;
  };
  const releaseRenderer = (): void => {
    if (resourcesReleased) return;
    resourcesReleased = true;
    scene.environment = null;
    environment?.dispose();
    renderer.dispose();
  };
  const render = (): void => {
    // An immediate settings/view update also satisfies any pending Walk redraw.
    cancelWalkRender();
    if (!initialized || disposed || !apartment) return;
    try {
      renderer.render(scene, camera);
    } catch (error) {
      walk?.deactivate();
      onError(error);
    }
  };
  renderer.onDeviceLost = (info): void => {
    if (!disposed) {
      cancelWalkRender();
      walk?.deactivate();
      onError(new Error(`Rendering device lost: ${info.message}`));
    }
  };
  const applyEffectiveProjection = (): void => {
    camera.aspect = aspect;
    if (focalLengthOverride !== null) {
      camera.fov = verticalFov(fullFrameHorizontalFov(focalLengthOverride), aspect);
    } else if (isWalking || cameraId === null) {
      camera.fov = verticalFov(fullFrameHorizontalFov(isWalking ? 16 : 50), aspect);
    } else {
      const source = isWalking
        ? model?.cameras[0]
        : model?.cameras.find((candidate) => candidate.id === cameraId);
      if (!source) throw new Error(`Unknown apartment camera: ${cameraId}`);
      camera.fov = verticalFov(source.horizontalFov.toNumber(), aspect);
    }
    camera.updateProjectionMatrix();
  };
  const extendClippingRange = (): void => {
    if (!apartment) return;
    const radius = apartment.bounds.getSize(new Vector3()).length() / 2;
    const distance = camera.position.distanceTo(apartment.bounds.getCenter(new Vector3()));
    camera.far = Math.max(camera.far, distance + radius * 2);
    camera.updateProjectionMatrix();
  };
  const requestWalkRender = (): void => {
    if (disposed || walkRenderFrame !== undefined) return;
    const view = canvas.ownerDocument.defaultView;
    if (!view) return;
    // Pointer events (and movement synchronized by those events) can outpace the
    // display. Submit only the latest pose, rather than queueing redundant GPU work.
    walkRenderFrame = view.requestAnimationFrame(() => {
      walkRenderFrame = undefined;
      extendClippingRange();
      render();
    });
  };
  const selectCamera = (id: string | null): void => {
    if (disposed || !model || !apartment) return;
    focalLengthOverride = null;
    walk?.deactivate();
    isWalking = false;
    controls.enabled = false;
    if (id === null) {
      controls.target.copy(frameInspection(camera, apartment.bounds, aspect));
      controls.update();
      controls.enabled = true;
    } else {
      const source = model.cameras.find((candidate) => candidate.id === id);
      if (!source) throw new Error(`Unknown apartment camera: ${id}`);
      applyEmbeddedCamera(camera, source, aspect);
      extendClippingRange();
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
          environment = createStudioEnvironment(renderer);
          scene.environment = quality.environmentLightingEnabled ? environment.texture : null;
          initialized = true;
          render();
        })
        .catch((error: unknown) => {
          releaseRenderer();
          throw error;
        });
      return initialization;
    },
    setModel(next, finishes) {
      if (disposed) throw new Error("Renderer is disposed.");
      const replacement = buildApartmentScene(next, finishes);
      walk?.dispose();
      walk = undefined;
      isWalking = false;
      if (apartment) {
        scene.remove(apartment.group);
        apartment.dispose();
      }
      apartment = replacement;
      model = next;
      scene.add(apartment.group);
      const center = apartment.bounds.getCenter(new Vector3());
      const radius = Math.max(apartment.bounds.getSize(new Vector3()).length(), 0.1);
      shadowRadius = radius;
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
      light.shadow.needsUpdate = true;
      selectCamera(null);
    },
    resize(nextWidth, nextHeight) {
      if (disposed) return;
      width = Math.max(1, nextWidth);
      height = Math.max(1, nextHeight);
      aspect = width / height;
      renderer.setSize(width, height, false);
      applyEffectiveProjection();
      render();
    },
    selectCamera,
    selectWalk() {
      if (disposed || !model || !apartment) return;
      walk ??= new WalkControls(model, camera, canvas, requestWalkRender);
      focalLengthOverride = null;
      controls.enabled = false;
      isWalking = true;
      walk.activate();
      extendClippingRange();
      applyEffectiveProjection();
      render();
    },
    setFocalLengthOverride(focalLengthMm) {
      if (disposed) return;
      if (focalLengthMm !== null && !isFullFrameFocalLength(focalLengthMm)) {
        throw new Error(`Unsupported full-frame focal length: ${focalLengthMm}`);
      }
      focalLengthOverride = focalLengthMm;
      applyEffectiveProjection();
      render();
    },
    setPresentationSettings(settings) {
      if (disposed) return;
      applyPresentationSettings(renderer, scene, settings);
      render();
    },
    setQualitySettings(settings) {
      if (disposed) return;
      if (!isRendererQualitySettings(settings)) {
        throw new Error("Invalid renderer quality settings.");
      }
      if (settings.pixelRatio !== quality.pixelRatio) {
        renderer.setPixelRatio(settings.pixelRatio);
        renderer.setSize(width, height, false);
      }
      const mapSize = SHADOW_MAP_SIZES[settings.shadowQuality];
      if (mapSize !== 0 && light.shadow.map && light.shadow.mapSize.x !== mapSize) {
        // Three.js r185 retains stale GPU bindings when an allocated shadow target
        // is resized. A fresh light identity rebuilds its shadow nodes/bindings;
        // clone only light configuration, never apartment meshes or camera state.
        const previous = light;
        light = previous.clone();
        scene.remove(previous, previous.target);
        previous.dispose();
        scene.add(light, light.target);
      }
      renderer.shadowMap.enabled = mapSize !== 0;
      light.castShadow = mapSize !== 0;
      if (mapSize !== 0) {
        light.shadow.mapSize.set(mapSize, mapSize);
        light.shadow.normalBias = ((2 * shadowRadius) / mapSize) * 2;
        if (settings.shadowQuality !== quality.shadowQuality) light.shadow.needsUpdate = true;
      }
      scene.environment = settings.environmentLightingEnabled
        ? (environment?.texture ?? null)
        : null;
      fillLight.intensity = FILL_LIGHT_INTENSITIES[settings.fillLightLevel];
      quality = { ...settings };
      render();
    },
    render,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelWalkRender();
      walk?.dispose();
      controls.removeEventListener("change", render);
      controls.dispose();
      apartment?.dispose();
      light.dispose();
      scene.clear();
      // init owns in-flight backend allocation; release it when that allocation settles.
      if (!initialization || initialized) releaseRenderer();
    },
  };
}
