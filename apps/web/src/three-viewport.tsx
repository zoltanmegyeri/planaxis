import { DaylightControls } from "./daylight-controls.js";
import { BloomControls } from "./bloom-controls.js";
import type { LightingMode, PhysicalSimulation } from "@planaxis/simulation";
import { createPortal } from "react-dom";
import { isWorkspaceShortcut, NavigationHelp, TransientPanel } from "./transient-panel.js";
import type { WorkspacePanel } from "./transient-panel.js";
import { useFullscreen } from "./use-fullscreen.js";
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
  RuntimeLuminaire,
  FullFrameFocalLength,
  RendererPresentationSettings,
  RendererQualitySettings,
  RendererPostProcessingSettings,
  RendererGlobalIlluminationSettings,
  GlobalIlluminationCapability,
} from "@planaxis/renderer-three";
import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import {
  fitRenderSurface,
  isRenderAspectRatio,
  RENDER_ASPECT_RATIO_OPTIONS,
} from "./render-aspect-ratio.js";
import type { RenderAspectRatio } from "./render-aspect-ratio.js";

import type { ScenarioPresentation } from "./design-presentation.js";
import type { LoadedMaterials } from "./load-materials.js";
import { QualityControls } from "./quality-controls.js";
import {
  adaptQuality,
  editQuality,
  nativePixelRatio,
  persistQuality,
  qualityPreset,
  restoreQuality,
  recommendGlobalIllumination,
} from "./render-quality.js";
import type { QualityPreference } from "./render-quality.js";

// Not a valid Apartment SVG ID, so an embedded camera cannot shadow this choice.
const WALK_VIEW = "@walk";

export function ThreeViewport({
  model,
  luminaires,
  onFailure,
  toolbar,
  panel,
  onTogglePanel,
  onClosePanel,
  scenarioPresentation,
  materials,
  onMaterialFailure,
  simulation,
  sessionInstant,
  onSimulationChange,
  selectedLightingMode,
  onLightingModeChange,
  postProcessing,
  onPostProcessingChange,
  globalIllumination,
  onGlobalIlluminationChange,
}: {
  model: ArchitecturalModel3D;
  luminaires?: readonly RuntimeLuminaire[];
  simulation: PhysicalSimulation;
  sessionInstant: number;
  onSimulationChange: (next: PhysicalSimulation) => void;
  selectedLightingMode: LightingMode;
  onLightingModeChange: (mode: LightingMode) => void;
  postProcessing: RendererPostProcessingSettings;
  onPostProcessingChange: (settings: RendererPostProcessingSettings) => void;
  globalIllumination: RendererGlobalIlluminationSettings;
  onGlobalIlluminationChange: (settings: RendererGlobalIlluminationSettings) => void;
  onFailure: (error: unknown) => void;
  toolbar: HTMLDivElement | null;
  panel: WorkspacePanel;
  onTogglePanel: (panel: WorkspacePanel) => void;
  onClosePanel: () => void;
  scenarioPresentation?: ScenarioPresentation | undefined;
  materials?: LoadedMaterials | undefined;
  onMaterialFailure?: (() => void) | undefined;
}): ReactElement {
  const luminairesRef = useRef(luminaires);
  luminairesRef.current = luminaires;
  const renderArea = useRef<HTMLDivElement>(null);
  const fullscreen = useFullscreen(renderArea);
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ApartmentRenderer | null>(null);
  const resizeRenderer = useRef<() => void>(() => undefined);
  const [cameraId, setCameraId] = useState("");
  const [focalLength, setFocalLength] = useState<FullFrameFocalLength | null>(null);
  const [aspectRatio, setAspectRatio] = useState<RenderAspectRatio>("fill");
  const aspectRatioRef = useRef<RenderAspectRatio>(aspectRatio);
  aspectRatioRef.current = aspectRatio;
  const [ready, setReady] = useState(false);
  const simulationInstant = simulation.instant;
  const lightingMode = model.metadata.location ? selectedLightingMode : "studio";
  const lightingRef = useRef({ mode: lightingMode, ...simulation });
  lightingRef.current = { mode: lightingMode, ...simulation };
  const [nativeDpr, setNativeDpr] = useState(() => nativePixelRatio(window.devicePixelRatio));
  const [quality, setQuality] = useState(() => restoreQuality(nativeDpr));
  const [giCapability, setGiCapability] = useState<GlobalIlluminationCapability>({
    available: false,
  });
  const giRef = useRef(globalIllumination);
  giRef.current = globalIllumination;
  const updateGi = (enabled: boolean): void => {
    const next = { enabled: enabled && giCapability.available };
    try {
      renderer.current?.setGlobalIlluminationSettings(next);
      giRef.current = next;
      onGlobalIlluminationChange(next);
    } catch (error) {
      onFailure(error);
    }
  };
  const postProcessingRef = useRef(postProcessing);
  postProcessingRef.current = postProcessing;
  const updatePostProcessing = (update: Partial<RendererPostProcessingSettings>): void => {
    const next = { ...postProcessingRef.current, ...update };
    try {
      renderer.current?.setPostProcessingSettings(next);
      postProcessingRef.current = next;
      onPostProcessingChange(next);
    } catch (error) {
      onFailure(error);
    }
  };
  const qualityRef = useRef(quality);
  qualityRef.current = quality;
  const updateQuality = (next: QualityPreference): void => {
    try {
      renderer.current?.setQualitySettings(next.settings);
      qualityRef.current = next;
      setQuality(next);
    } catch (error) {
      onFailure(error);
    }
  };
  const editQualitySettings = (update: Partial<RendererQualitySettings>): void => {
    updateQuality(editQuality(qualityRef.current, update));
  };
  useEffect(() => {
    persistQuality(quality);
  }, [quality]);
  useEffect(() => {
    const onResize = (): void => {
      const nextNative = nativePixelRatio(window.devicePixelRatio);
      if (nextNative === nativeDpr) return;
      const next = adaptQuality(qualityRef.current, nextNative);
      try {
        renderer.current?.setQualitySettings(next.settings);
        qualityRef.current = next;
        setQuality(next);
        setNativeDpr(nextNative);
      } catch (error) {
        onFailure(error);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [nativeDpr, onFailure]);
  const [presentation, setPresentation] = useState(() => ({
    ...DEFAULT_PRESENTATION_SETTINGS,
    ...scenarioPresentation,
  }));
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
    if (scenarioPresentation === undefined) return;
    const next = { ...presentationRef.current, ...scenarioPresentation };
    try {
      renderer.current?.setPresentationSettings(next);
      presentationRef.current = next;
      setPresentation(next);
    } catch (error) {
      onFailure(error);
    }
  }, [scenarioPresentation, onFailure]);
  useEffect(() => {
    const element = canvas.current;
    const area = renderArea.current;
    if (!element || !area) return;
    let active = true;
    let instance: ApartmentRenderer | undefined;
    let observer: ResizeObserver | undefined;
    let persistentFinishes = false;
    setReady(false);
    const fail = (error: unknown): void => {
      if (!active) return;
      if (persistentFinishes && instance && materials) {
        persistentFinishes = false;
        try {
          instance.setModel(model);
          materials.dispose();
          onMaterialFailure?.();
          return;
        } catch (fallbackError) {
          onFailure(fallbackError);
          return;
        }
      }
      onFailure(error);
    };
    try {
      instance = createApartmentRenderer(element, fail);
      renderer.current = instance;
      instance.setPresentationSettings(presentationRef.current);
      instance.setQualitySettings(qualityRef.current.settings);
      instance.setPostProcessingSettings(postProcessingRef.current);
      instance.setGlobalIlluminationSettings(giRef.current);
      const resize = (): void => {
        try {
          const rect = area.getBoundingClientRect();
          const frame = fitRenderSurface(rect.width, rect.height, aspectRatioRef.current);
          element.style.width = `${frame.width}px`;
          element.style.height = `${frame.height}px`;
          element.style.left = `${frame.left}px`;
          element.style.top = `${frame.top}px`;
          instance?.resize(frame.width, frame.height);
        } catch (error) {
          fail(error);
        }
      };
      resizeRenderer.current = resize;
      resize();
      if (materials) {
        persistentFinishes = true;
        try {
          instance.setModel(model, materials.finishes);
        } catch (error) {
          fail(error);
        }
      } else instance.setModel(model);
      instance.setLuminaires(luminairesRef.current ?? []);
      instance.setLightingMode(
        lightingRef.current.mode,
        lightingRef.current.instant,
        lightingRef.current.weather,
      );
      observer = new ResizeObserver(resize);
      observer.observe(area);
      void instance
        .initialize()
        .then(() => {
          if (active && instance) {
            setGiCapability(instance.getGlobalIlluminationCapability());
            setReady(true);
          }
        })
        .catch((error: unknown) => {
          // Backend/environment initialization cannot recover by replacing finishes.
          if (active) onFailure(error);
        });
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
  }, [model, onFailure, materials, onMaterialFailure]);
  useEffect(() => {
    try {
      renderer.current?.setLuminaires(luminaires ?? []);
    } catch (error) {
      onFailure(error);
    }
  }, [luminaires, onFailure]);
  useEffect(() => {
    resizeRenderer.current();
  }, [aspectRatio, fullscreen.active]);
  const selectCamera = (id: string): void => {
    if (!ready) return;
    try {
      if (id === WALK_VIEW) {
        if (model.cameras.length === 0) return;
        renderer.current?.selectWalk();
      } else renderer.current?.selectCamera(id || null);
      setCameraId(id);
      setFocalLength(null);
    } catch (error) {
      onFailure(error);
    }
  };
  const selectCameraRef = useRef(selectCamera);
  selectCameraRef.current = selectCamera;
  useEffect(() => {
    const shortcut = (event: KeyboardEvent): void => {
      if (!isWorkspaceShortcut(event)) return;
      const key = event.key.toLowerCase();
      if (key === "w" && cameraId !== WALK_VIEW && model.cameras.length > 0) {
        event.preventDefault();
        selectCameraRef.current(WALK_VIEW);
      } else if (key === "i") {
        event.preventDefault();
        selectCameraRef.current("");
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [cameraId, model.cameras.length]);
  return (
    <section className="three-viewport" aria-label="3D apartment view">
      {toolbar &&
        createPortal(
          <>
            <label>
              <span className="control-label">Camera </span>
              <select
                aria-label="3D camera"
                value={cameraId}
                disabled={!ready}
                onChange={(event) => selectCamera(event.target.value)}
              >
                <option value="">Inspection</option>
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
            <button
              aria-label="Camera settings"
              title="Camera settings"
              aria-expanded={panel === "camera"}
              aria-controls="camera-panel"
              onClick={() => onTogglePanel("camera")}
            >
              ⌖
            </button>
            <button
              aria-label="Rendering"
              title="Rendering"
              aria-expanded={panel === "rendering"}
              aria-controls="rendering-panel"
              onClick={() => onTogglePanel("rendering")}
            >
              <span aria-hidden="true">◐</span>
              <span className="button-label"> Rendering</span>
            </button>
            <button
              aria-label="Full screen"
              title="Full screen"
              onClick={() => {
                onClosePanel();
                void fullscreen.enter();
              }}
            >
              <span aria-hidden="true">⛶</span>
              <span className="button-label"> Full screen</span>
            </button>
          </>,
          toolbar,
        )}
      <TransientPanel
        id="camera-panel"
        title="Camera settings"
        open={panel === "camera"}
        onClose={onClosePanel}
      >
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
        <p>
          Inspection: 50 mm · Walk: 16 mm · Embedded: camera-defined FOV. Selecting a camera
          restores its default lens.
        </p>
        {model.cameras.length === 0 && (
          <p>Free walk requires at least one camera in the Apartment SVG.</p>
        )}
      </TransientPanel>
      <TransientPanel
        id="rendering-panel"
        title="Rendering"
        open={panel === "rendering"}
        onClose={onClosePanel}
      >
        <label>
          Lighting{" "}
          <select
            aria-label="3D lighting mode"
            value={lightingMode}
            disabled={!ready}
            onChange={(event) => {
              const mode = event.target.value;
              if (mode !== "studio" && mode !== "physical") return;
              if (mode === "physical" && !model.metadata.location) return;
              try {
                renderer.current?.setLightingMode(mode, simulationInstant, simulation.weather);
                onLightingModeChange(mode);
              } catch (error) {
                onFailure(error);
              }
            }}
          >
            <option value="studio">Studio</option>
            <option value="physical" disabled={!model.metadata.location}>
              Physical
            </option>
          </select>
        </label>
        {!model.metadata.location && (
          <p>
            Physical lighting requires geographic location and north orientation in the Apartment
            SVG.
          </p>
        )}
        {lightingMode === "physical" && (
          <DaylightControls
            simulation={simulation}
            sessionInstant={sessionInstant}
            timeZone={model.metadata.location?.timeZone}
            ready={ready}
            onChange={(next) => {
              try {
                renderer.current?.setLightingMode("physical", next.instant, next.weather);
                onSimulationChange(next);
              } catch (error) {
                onFailure(error);
              }
            }}
          />
        )}
        <QualityControls
          physical={lightingMode === "physical"}
          preference={quality}
          nativeDpr={nativeDpr}
          ready={ready}
          onPreset={(preset) => {
            updateQuality(qualityPreset(preset, nativeDpr));
            updatePostProcessing({ bloomEnabled: preset !== "Performance" });
            updateGi(recommendGlobalIllumination(preset, giCapability.available));
          }}
          onEdit={editQualitySettings}
        />
        <label>
          Global illumination{" "}
          <select
            aria-label="Global illumination"
            value={globalIllumination.enabled && giCapability.available ? "on" : "off"}
            disabled={!ready || !giCapability.available}
            onChange={(event) => updateGi(event.target.value === "on")}
          >
            <option value="on">On</option>
            <option value="off">Off</option>
          </select>
        </label>
        {ready && !giCapability.available && <p>{giCapability.reason}</p>}
        <BloomControls settings={postProcessing} ready={ready} onEdit={updatePostProcessing} />
        <label>
          Tone mapping{" "}
          <select
            aria-label="3D tone mapping"
            value={presentation.toneMapping}
            disabled={!ready || scenarioPresentation !== undefined}
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
            min={Math.min(-4, presentation.exposureEv)}
            max={Math.max(4, presentation.exposureEv)}
            step={0.1}
            value={presentation.exposureEv}
            disabled={!ready || scenarioPresentation !== undefined}
            onChange={(event) => updatePresentation({ exposureEv: Number(event.target.value) })}
          />
        </label>
        {scenarioPresentation !== undefined && (
          <span>Edit tone mapping and exposure in the design editor.</span>
        )}
        <label className="presentation-slider">
          Environment intensity: {presentation.environmentIntensity}
          <input
            type="range"
            aria-label="3D environment intensity"
            min={0}
            max={4}
            step={0.1}
            value={presentation.environmentIntensity}
            disabled={!ready || lightingMode === "physical"}
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
            disabled={!ready || lightingMode === "physical"}
            onChange={(event) =>
              updatePresentation({ environmentRotationDegrees: Number(event.target.value) })
            }
          />
        </label>
      </TransientPanel>
      <TransientPanel
        id="help-panel"
        title="Information and help"
        open={panel === "help"}
        onClose={onClosePanel}
      >
        <NavigationHelp
          mode={cameraId === WALK_VIEW ? "walk" : cameraId ? "embedded" : "inspection"}
        />
        {model.cameras.length === 0 && (
          <p>Free walk requires at least one camera in the Apartment SVG.</p>
        )}
      </TransientPanel>
      {!ready && (
        <p className="viewport-status" role="status">
          Starting 3D…
        </p>
      )}
      {fullscreen.error && (
        <p className="problem-toast" role="status">
          {fullscreen.error}
        </p>
      )}
      <div ref={renderArea} className="three-render-area">
        <canvas ref={canvas} tabIndex={0} aria-label="Apartment 3D rendering" />
        {fullscreen.active && (
          <button
            className="fullscreen-close"
            aria-label="Exit full screen"
            title="Exit full screen"
            onClick={() => void fullscreen.exit()}
          >
            ×
          </button>
        )}
      </div>
    </section>
  );
}
