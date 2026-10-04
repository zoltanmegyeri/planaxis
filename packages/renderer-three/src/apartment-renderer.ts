import { buildLuminaireSet } from "./runtime-luminaires.js";
import type { RuntimeLuminaire } from "./runtime-luminaires.js";
import {
  calculateSolarPosition,
  planaxisSunDirection,
  deriveDaylight,
  DEFAULT_WEATHER,
} from "@planaxis/simulation";
import type { LightingMode, Weather } from "@planaxis/simulation";
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
import { createPhysicalSky, daylightSunColor } from "./physical-sky.js";
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
  setLuminaires(luminaires: readonly RuntimeLuminaire[]): void;
  resize(width: number, height: number): void;
  selectCamera(sourceId: string | null): void;
  selectWalk(): void;
  setFocalLengthOverride(focalLengthMm: FullFrameFocalLength | null): void;
  setPresentationSettings(settings: RendererPresentationSettings): void;
  setQualitySettings(settings: RendererQualitySettings): void;
  setLightingMode(mode: LightingMode, instant: number, weather?: Weather): void;
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
  let lightingMode: LightingMode = "studio";
  let simulationInstant = 0;
  let weather: Weather = DEFAULT_WEATHER;
  const sky = createPhysicalSky();
  let luminaireInputs: readonly RuntimeLuminaire[] = [];
  let luminaires = buildLuminaireSet([], quality.shadowQuality);
  scene.add(luminaires.group);
  const replaceLuminaires = (): void => {
    const replacement = buildLuminaireSet(
      luminaireInputs,
      quality.shadowQuality,
      apartment?.bounds,
    );
    scene.remove(luminaires.group);
    luminaires.dispose();
    luminaires = replacement;
    scene.add(luminaires.group);
  };
  let width = 1;
  let height = 1;
  let shadowRadius = 0.1;
  let light = new DirectionalLight(0xffffff, 3);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  light.shadow.bias = 0;
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
  const applyLighting = (): void => {
    scene.environment =
      lightingMode === "studio" && quality.environmentLightingEnabled
        ? (environment?.texture ?? null)
        : null;
    fillLight.intensity =
      lightingMode === "studio" ? FILL_LIGHT_INTENSITIES[quality.fillLightLevel] : 0;
    light.intensity = 3; // Qualitative direct light, not authoritative irradiance.
    light.color.set(0xffffff);
    scene.backgroundNode = lightingMode === "physical" ? sky.node : null;
    // r186 PCF uses radius on both WebGPU and WebGL2. Scale the wider weather
    // filter with resolution, retaining full occlusion away from shadow edges.
    light.shadow.radius =
      lightingMode === "physical" && weather === "overcast"
        ? (8 * light.shadow.mapSize.x) / 2048
        : 1;
    if (apartment) {
      const center = apartment.bounds.getCenter(new Vector3());
      light.target.position.copy(center);
      if (lightingMode === "physical" && model?.metadata.location) {
        const location = model.metadata.location;
        // Explicit boundary from exact permanent metadata to approximate runtime simulation.
        const sun = calculateSolarPosition(
          location.latitude.toNumber(),
          location.longitude.toNumber(),
          simulationInstant,
        );
        const direction = planaxisSunDirection(location.northHeading.toNumber(), sun);
        light.position
          .copy(center)
          .addScaledVector(new Vector3(direction.x, direction.z, direction.y), shadowRadius * 2);
        const daylight = deriveDaylight(sun.elevation, weather);
        light.intensity = 3 * daylight.directStrength;
        light.color.copy(daylightSunColor(daylight));
        sky.update(daylight, direction);
      } else {
        light.position.copy(center).add(new Vector3(shadowRadius, shadowRadius * 2, shadowRadius));
      }
    }
  };
  const applyShadows = (): void => {
    // Physical direct light must never bypass architectural occlusion, including a
    // saved Performance preset. Retain the Studio preference for switching back.
    const mapSize =
      SHADOW_MAP_SIZES[quality.shadowQuality] || (lightingMode === "physical" ? 1024 : 0);
    const changed =
      light.castShadow !== (mapSize !== 0) || (mapSize !== 0 && light.shadow.mapSize.x !== mapSize);
    if (mapSize !== 0 && light.shadow.map && light.shadow.mapSize.x !== mapSize) {
      // Recreate GPU shadow bindings on resolution changes, preserving scene and pose.
      const previous = light;
      light = previous.clone();
      scene.remove(previous, previous.target);
      previous.dispose();
      scene.add(light, light.target);
    }
    renderer.shadowMap.enabled = mapSize !== 0 || luminaires.hasShadows;
    light.castShadow = mapSize !== 0;
    if (mapSize !== 0) {
      light.shadow.mapSize.set(mapSize, mapSize);
      const texelSize = (light.shadow.camera.right - light.shadow.camera.left) / mapSize;
      // Favor occlusion at coplanar wall/ceiling contacts. The normal offset keeps
      // directly lit surfaces clear of self-shadowing; both scale with resolution.
      light.shadow.normalBias = texelSize * 4;
      light.shadow.bias = (texelSize * 2.5) / (light.shadow.camera.far - light.shadow.camera.near);
      if (changed) light.shadow.needsUpdate = true;
    }
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
          applyLighting();
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
      if (!model.metadata.location) lightingMode = "studio";
      scene.add(apartment.group);
      const center = apartment.bounds.getCenter(new Vector3());
      const radius = Math.max(apartment.bounds.getSize(new Vector3()).length(), 0.1);
      shadowRadius = radius;
      replaceLuminaires();
      light.target.position.copy(center);
      light.position.copy(center).add(new Vector3(radius, radius * 2, radius));
      Object.assign(light.shadow.camera, {
        // The half-diagonal encloses the bounds from every light direction.
        left: -radius / 2,
        right: radius / 2,
        top: radius / 2,
        bottom: -radius / 2,
        near: radius / 100,
        far: radius * 5,
      });
      light.shadow.camera.updateProjectionMatrix();
      applyShadows();
      applyLighting();
      light.shadow.needsUpdate = true;
      selectCamera(null);
    },
    setLuminaires(next) {
      if (disposed) return;
      luminaireInputs = next;
      replaceLuminaires();
      applyShadows();
      render();
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
      const shadowChanged = settings.shadowQuality !== quality.shadowQuality;
      quality = { ...settings };
      if (shadowChanged) replaceLuminaires();
      applyShadows();
      applyLighting();
      render();
    },
    setLightingMode(mode, instant, nextWeather = weather) {
      if (disposed) return;
      if (mode !== "studio" && mode !== "physical") throw new Error("Invalid lighting mode.");
      if (!Number.isFinite(instant) || Math.abs(instant) > 8.64e15)
        throw new Error("Invalid simulation instant.");
      if (mode === "physical" && !model?.metadata.location) {
        throw new Error(
          "Physical lighting requires Apartment SVG geographic location and orientation.",
        );
      }
      if (nextWeather !== "sunny" && nextWeather !== "overcast")
        throw new Error("Invalid weather.");
      weather = nextWeather;
      lightingMode = mode;
      simulationInstant = instant;
      applyShadows();
      applyLighting();
      light.shadow.needsUpdate = true;
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
      luminaires.dispose();
      scene.backgroundNode = null;
      sky.dispose();
      scene.clear();
      // init owns in-flight backend allocation; release it when that allocation settles.
      if (!initialization || initialized) releaseRenderer();
    },
  };
}
