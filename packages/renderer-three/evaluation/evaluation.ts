import {
  AgXToneMapping,
  Color,
  DataUtils,
  DirectionalLight,
  PerspectiveCamera,
  PCFShadowMap,
  Scene,
  PointLight,
  SpotLight,
  Vector3,
  WebGPURenderer,
} from "three/webgpu";
import type { RenderTarget } from "three/webgpu";
import { deriveDaylight } from "@planaxis/simulation";
import { buildArchitecturalModel3D } from "@planaxis/model-3d";
import { parseApartmentSvg } from "@planaxis/parser";
import {
  buildValidatedApartment2D,
  validateApartmentSvgSchema,
  validateApartmentSvgReferences,
  validateApartmentSvgGeometry,
} from "@planaxis/validator";
import { createApartmentRenderer } from "../src/apartment-renderer.js";
import { buildApartmentScene } from "../src/apartment-scene.js";
import { ApartmentRenderPipeline } from "../src/render-pipeline.js";
import {
  configureGiTextureLimit,
  GiScene,
  giLightBudget,
  globalIlluminationCapability,
  RENDER_LIGHT_LAYER,
  selectGiLights,
  VXGI_CONFIGURATION,
} from "../src/global-illumination.js";
import type { VxgiConfiguration } from "../src/global-illumination.js";
import { buildLuminaireSet } from "../src/runtime-luminaires.js";
import type { RuntimeLuminaire } from "../src/runtime-luminaires.js";
import { SkyLights } from "../src/sky-lights.js";
import { createStudioEnvironment } from "../src/studio-environment.js";
import { rectangularProxies } from "./rectangular-proxies.js";

const canvas = document.querySelector<HTMLCanvasElement>("#canvas")!;
const status = document.querySelector<HTMLPreElement>("#status")!;
const measurements = document.querySelector<HTMLPreElement>("#measurements")!;
const select = (id: string): string => document.querySelector<HTMLSelectElement>(`#${id}`)!.value;
const requiredLimits: Record<string, number> = {};
const renderer = new WebGPURenderer({
  canvas,
  reversedDepthBuffer: true,
  logarithmicDepthBuffer: false,
  antialias: true,
  requiredLimits,
});
renderer.setPixelRatio(1);
renderer.setSize(1920, 1080, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFShadowMap;
renderer.toneMapping = AgXToneMapping;
const camera = new PerspectiveCamera(65, 1920 / 1080, 0.01, 100);
camera.layers.enable(RENDER_LIGHT_LAYER);
const scene = new Scene();
scene.background = new Color(0.2, 0.25, 0.3);
const collector = new GiScene();
const sky = new SkyLights();
const sun = new DirectionalLight(0xffffff, 3);
sun.layers.set(RENDER_LIGHT_LAYER);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.autoUpdate = false;
Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.01, far: 30 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.normalBias = 0.02;
sun.shadow.bias = 0.0001;
scene.add(sun, sun.target, sky.group);
let apartment: ReturnType<typeof buildApartmentScene> | undefined;
let lights: ReturnType<typeof buildLuminaireSet> | undefined;
let pipeline: ApartmentRenderPipeline | undefined;
let generation = 0;
let device = "";
let busy = false;
let studioEnvironment: RenderTarget | undefined;

function model(sealed: boolean, closedDoor: boolean) {
  const wall = (id: string, x: number, y: number, w: number, h: number, axis: string) =>
    `<rect id="${id}" x="${x}" y="${y}" width="${w}" height="${h}" data-kind="wall" data-axis="${axis}" data-class="interior" data-status="fixed"/>`;
  const source = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 400" data-schema="apartment-svg" data-schema-version="2.2" data-unit="cm">
  <metadata><![CDATA[{"schema":"apartment-svg/2.2","project":{"name":"GI apartment evaluation","units":"cm"},"coordinateSystem":{"x":"right","y":"down","z":"up","headingDegrees":{"0":"+x","90":"+y","180":"-x","270":"-y"}},"level":{"id":"level-0","baseZ":0,"defaultCeilingHeight":260},"location":{"latitude":47.4979,"longitude":19.0402,"northHeading":270,"timeZone":"Europe/Budapest"}}]]></metadata>
  <g id="footprint"><polygon id="apartment-footprint" points="0,0 900,0 900,400 0,400" data-kind="footprint"/></g>
  <g id="spaces"/><g id="walls">${wall("west", 0, 0, 20, 400, "y")}${wall("east", 880, 0, 20, 400, "y")}${wall("north", 20, 0, 860, 20, "x")}${wall("south", 20, 380, 860, 20, "x")}${wall("partition", 440, 20, 10, 360, "y")}</g>
  <g id="windows">${sealed ? "" : '<rect id="window" x="0" y="80" width="20" height="160" data-kind="window" data-wall="west" data-sill-height="70" data-opening-height="150" data-status="fixed"/>'}</g>
  <g id="doors">${closedDoor ? "" : '<rect id="door" x="440" y="145" width="10" height="110" data-kind="door" data-wall="partition" data-door-type="opening-only" data-opening-height="210" data-status="fixed"/>'}</g>
  <g id="fixed-elements"/><g id="utilities"/><g id="cameras"><circle id="camera-1" cx="220" cy="200" r="4" data-kind="camera" data-z="160" data-heading="180" data-pitch="0" data-horizontal-fov="70"/></g><g id="annotations"/></svg>`;
  const parsed = parseApartmentSvg(source);
  if (!parsed.ok) throw new Error("Evaluation SVG parsing failed.");
  const schema = validateApartmentSvgSchema(parsed.document);
  if (!schema.valid) throw new Error(JSON.stringify(schema.errors));
  const references = validateApartmentSvgReferences(schema.document);
  if (!references.valid) throw new Error(JSON.stringify(references.errors));
  const geometry = validateApartmentSvgGeometry(references.document);
  if (!geometry.valid) throw new Error(JSON.stringify(geometry.errors));
  return buildArchitecturalModel3D(buildValidatedApartment2D(geometry.document));
}

function build(caseName: string, gi: boolean, configuration: VxgiConfiguration): void {
  pipeline?.dispose();
  pipeline = undefined;
  if (apartment) {
    scene.remove(apartment.group);
    apartment.dispose();
  }
  if (lights) {
    scene.remove(lights.group);
    lights.dispose();
  }
  const night = [
    "Point",
    "Hidden spot",
    "Many lights",
    "Many-light overflow",
    "Thin partition",
    "Thin spot partition",
    "Partition contact stress",
    "Above ceiling",
    "Below floor",
    "Area direct",
    "Area proxies",
    "Linear direct",
    "Linear proxies",
    "Proxy stress",
  ].includes(caseName);
  apartment = buildApartmentScene(
    model(
      caseName === "Overcast sealed" || night,
      caseName === "Thin partition" ||
        caseName === "Thin spot partition" ||
        caseName === "Partition contact stress",
    ),
  );
  scene.add(apartment.group);
  collector.architecture = apartment.group;
  const studio = caseName === "Studio";
  scene.environment = studio ? (studioEnvironment?.texture ?? null) : null;
  sky.setBounds(collector.architectureBounds());
  sky.update(
    night || studio
      ? undefined
      : deriveDaylight(35, caseName.startsWith("Overcast") ? "overcast" : "sunny"),
  );
  sun.intensity = night ? 0 : caseName.startsWith("Overcast") ? 0.135 : 3;
  sun.position.set(-6, 6, 2);
  sun.target.position.set(2, 0, 2);
  if (studio) {
    const center = apartment.bounds.getCenter(new Vector3());
    const radius = Math.max(apartment.bounds.getSize(new Vector3()).length() / 2, 0.1);
    sun.target.position.copy(center);
    sun.position.copy(center).add(new Vector3(radius, radius * 2, radius));
  }
  sun.shadow.needsUpdate = true;
  const point: RuntimeLuminaire = {
    id: "point",
    type: "point",
    positionCm: { x: 220, y: 200, z: 200 },
    lumens: 2000,
    kelvin: 3000,
  };
  let inputs: readonly RuntimeLuminaire[] = night ? [point] : [];
  if (caseName === "Hidden spot")
    inputs = [
      {
        ...point,
        type: "spot",
        positionCm: { x: 70, y: 200, z: 50 },
        beamAngleDegrees: 65,
        orientation: { headingDegrees: 180, pitchDegrees: -50, rollDegrees: 0 },
      },
    ];
  if (
    caseName === "Thin partition" ||
    caseName === "Thin spot partition" ||
    caseName === "Partition contact stress"
  )
    inputs = [
      {
        ...point,
        positionCm: { x: caseName === "Thin partition" ? 350 : 420, y: 200, z: 150 },
        lumens: 5000,
      },
    ];
  if (caseName === "Thin spot partition")
    inputs = [
      {
        ...point,
        type: "spot",
        positionCm: { x: 350, y: 200, z: 150 },
        lumens: 5000,
        beamAngleDegrees: 65,
        orientation: { headingDegrees: 0, pitchDegrees: 0, rollDegrees: 0 },
      },
    ];
  if (caseName === "Many lights" || caseName === "Many-light overflow") {
    const columns = caseName === "Many lights" ? 4 : 8;
    inputs = Array.from({ length: caseName === "Many lights" ? 12 : 40 }, (_, index) => ({
      ...point,
      id: `light-${String(index).padStart(2, "0")}`,
      lumens: 150,
      positionCm: {
        x: 100 + (index % columns) * 100,
        y: 65 + Math.floor(index / columns) * 65,
        z: 225,
      },
    }));
  }
  const rectangle = {
    ...point,
    id: "rectangle",
    lumens: 2400,
    positionCm: { x: 220, y: 200, z: 240 },
    orientation: { headingDegrees: 0, pitchDegrees: 90, rollDegrees: 0 },
  };
  if (caseName.startsWith("Area")) {
    const area = { ...rectangle, type: "area" as const, widthCm: 140, heightCm: 140 };
    inputs = caseName.endsWith("proxies") ? rectangularProxies(area) : [area];
  }
  if (caseName.startsWith("Linear")) {
    const linear = { ...rectangle, type: "linear" as const, lengthCm: 200 };
    inputs = caseName.endsWith("proxies") ? rectangularProxies(linear) : [linear];
  }
  if (caseName === "Proxy stress")
    inputs = Array.from({ length: 4 }, (_, index) =>
      rectangularProxies({
        ...rectangle,
        id: `panel-${index}`,
        type: "area",
        widthCm: 140,
        heightCm: 140,
        lumens: 600,
        positionCm: { x: 120 + (index % 2) * 130, y: 110 + Math.floor(index / 2) * 130, z: 240 },
      }),
    ).flat();
  if (caseName === "Above ceiling" || caseName === "Below floor")
    inputs = [
      {
        ...point,
        lumens: 10000,
        positionCm: { x: 220, y: 200, z: caseName === "Above ceiling" ? 290 : -30 },
      },
    ];
  lights = buildLuminaireSet(inputs, "Medium", apartment.bounds);
  scene.add(lights.group);
  scene.updateMatrixWorld(true);
  collector.lights = selectGiLights(
    [{ key: "sun", priority: 0, light: sun }, ...sky.candidates(), ...lights.giCandidates],
    Math.min(configuration.lightBudget, giLightBudget(renderer)),
  );
  const samplerLimit = (renderer.backend as unknown as { device: GPUDevice }).device.limits
    .maxSamplersPerShaderStage;
  if (lights.giCandidates.length + 3 > samplerLimit)
    throw new Error(
      `This case needs at least ${lights.giCandidates.length + 3} shadow/HDR samplers; the native device permits ${samplerLimit}.`,
    );
  camera.position.set(
    caseName === "Connected rooms" ||
      caseName === "Thin partition" ||
      caseName === "Thin spot partition" ||
      caseName === "Partition contact stress"
      ? 7.5
      : 4.1,
    1.65,
    3.4,
  );
  camera.lookAt(caseName === "Connected rooms" ? 2 : 0.5, 1.2, 1.8);
  pipeline = new ApartmentRenderPipeline(renderer, scene, camera, configuration);
  pipeline.setGiEnabled(
    gi && globalIlluminationCapability(renderer).available,
    collector,
    collector.architectureBounds(),
  );
}

async function frame(): Promise<number> {
  const start = performance.now();
  pipeline!.render();
  await (renderer.backend as unknown as { device: GPUDevice }).device.queue.onSubmittedWorkDone();
  return performance.now() - start;
}
async function renderCase(): Promise<void> {
  if (busy) return;
  busy = true;
  const current = ++generation;
  const caseName = select("case");
  measurements.textContent = "";
  status.textContent = `Rendering ${caseName}…`;
  try {
    build(caseName, select("gi") === "On", {
      ...VXGI_CONFIGURATION,
      directionalRadiance: select("directional") === "On",
      bounces: Number(select("bounces")),
      coneAngle: Number(select("angle")),
      giIntensity: Number(select("intensity")),
    });
    const first = await frame();
    const refinements = Number(select("frames"));
    for (let index = 0; index < refinements && current === generation; index++) await frame();
    let diagnostic = "";
    const graph = pipeline as unknown as { gi?: { node: { _renderTarget: RenderTarget } } };
    if (graph.gi) {
      const pixels = await renderer.readRenderTargetPixelsAsync(
        graph.gi.node._renderTarget,
        0,
        0,
        1920,
        1080,
        1,
      );
      let sum = 0;
      let maximum = 0;
      for (let i = 0; i < pixels.length; i++)
        if (i % 4 !== 3) {
          const value = DataUtils.fromHalfFloat(pixels[i]!);
          sum += value;
          maximum = Math.max(maximum, value);
        }
      diagnostic = ` · GI irradiance mean ${(sum / (pixels.length * 0.75)).toFixed(5)} / max ${maximum.toFixed(5)}`;
    }
    status.textContent = `${device}\n${caseName} · GI ${pipeline!.giEnabled ? "On" : "Off"} · intensity ${select("intensity")} · first ${first.toFixed(1)} ms · ${refinements} refinement frames · idle${diagnostic}`;
  } catch (error) {
    status.textContent = `FAILED: ${String(error)}`;
    console.error(error);
  } finally {
    busy = false;
  }
}
async function benchmark(intensityOnly = false): Promise<void> {
  if (busy) return;
  busy = true;
  measurements.textContent = "";
  const variants = [
    { name: "GI Off", gi: false, configuration: VXGI_CONFIGURATION },
    {
      name: "128 isotropic / 4 cones",
      gi: true,
      configuration: {
        ...VXGI_CONFIGURATION,
        resolution: 128,
        directionalRadiance: false,
        coneCount: 4,
        coneAngle: 40,
        bounces: 1,
        normalOffset: 1.5,
      },
    },
    {
      name: "256 isotropic / 4 cones",
      gi: true,
      configuration: {
        ...VXGI_CONFIGURATION,
        directionalRadiance: false,
        coneCount: 4,
        coneAngle: 40,
        bounces: 1,
        normalOffset: 1.5,
      },
    },
    {
      name: "Chosen 256 directional / 0 cached bounces / 32 lights / 1 cone / 25 degrees",
      gi: true,
      configuration: VXGI_CONFIGURATION,
    },
    {
      name: "256 directional / 1 cached bounce",
      gi: true,
      configuration: { ...VXGI_CONFIGURATION, bounces: 1 },
    },
    {
      name: "256 directional / 2 bounces",
      gi: true,
      configuration: { ...VXGI_CONFIGURATION, bounces: 2 },
    },
    {
      name: "256 directional / 16 lights",
      gi: true,
      configuration: { ...VXGI_CONFIGURATION, lightBudget: 16 },
    },

    {
      name: "256 directional / 2 cones",
      gi: true,
      configuration: { ...VXGI_CONFIGURATION, coneCount: 2 },
    },
    {
      name: "Starting 256 directional / 4 cones / 40 degrees",
      gi: true,
      configuration: {
        ...VXGI_CONFIGURATION,
        coneCount: 4,
        coneAngle: 40,
        bounceConeAngle: 60,
        bounces: 1,
        normalOffset: 1.5,
      },
    },
    {
      name: "256 directional / 3 cones",
      gi: true,
      configuration: {
        ...VXGI_CONFIGURATION,
        coneCount: 3,
        coneAngle: 40,
        bounceConeAngle: 60,
        bounces: 1,
        normalOffset: 1.5,
      },
    },
  ];
  const caseName = select("case");
  try {
    const selectedVariants = intensityOnly
      ? [1, 8].map((giIntensity) => ({
          name: `256 directional / GI intensity ${giIntensity}`,
          gi: true,
          configuration: { ...VXGI_CONFIGURATION, giIntensity },
        }))
      : variants;
    for (const variant of selectedVariants) {
      status.textContent = `${device}\nMeasuring ${variant.name}…`;
      build(caseName, variant.gi, variant.configuration);
      const initial = await frame();
      for (let i = 0; i < 16; i++) await frame();
      const frames: number[] = [];
      for (let i = 0; i < 40; i++) {
        camera.position.z += 0.001;
        frames.push(await frame());
      }
      pipeline!.invalidateGeometry(collector.architectureBounds());
      const voxelization = await frame();
      sun.intensity *= 0.8;
      for (const candidate of lights!.giCandidates) {
        candidate.light.intensity *= 0.8;
        if (candidate.light instanceof PointLight || candidate.light instanceof SpotLight)
          candidate.light.shadow.needsUpdate = true;
      }
      sun.shadow.needsUpdate = true;
      pipeline!.invalidateLighting();
      const reinjection = await frame();
      const mean = frames.reduce((a, b) => a + b, 0) / frames.length;
      measurements.textContent += `${variant.name}: interactive ${mean.toFixed(1)} ms (${(1000 / mean).toFixed(1)} FPS-equivalent), initial ${initial.toFixed(1)} ms, warm voxelization ${voxelization.toFixed(1)} ms, reinjection ${reinjection.toFixed(1)} ms\n`;
    }
    status.textContent = `${device}\nMeasurements complete · CPU submission plus awaited GPU completion; first frame includes shader compilation.`;
  } catch (error) {
    status.textContent = `FAILED: ${String(error)}`;
    console.error(error);
  } finally {
    busy = false;
  }
}
async function exerciseLifecycle(): Promise<void> {
  if (busy) return;
  busy = true;
  status.textContent = "Exercising renderer replacement, resize, GI toggles and disposal…";
  const testCanvas = document.createElement("canvas");
  testCanvas.style.cssText = "width:480px;height:270px";
  document.body.append(testCanvas);
  const failures: unknown[] = [];
  const instance = createApartmentRenderer(testCanvas, (error) => failures.push(error));
  try {
    instance.setGlobalIlluminationSettings({ enabled: true });
    instance.setModel(model(false, false));
    instance.resize(960, 540);
    await instance.initialize();
    instance.selectWalk();
    instance.selectCamera(null);
    instance.setLightingMode("physical", Date.UTC(2026, 5, 21, 12), "overcast");
    instance.setLightingMode("physical", Date.UTC(2026, 5, 21, 13), "sunny");
    instance.setLightingMode("studio", Date.UTC(2026, 5, 21, 13));
    instance.setLuminaires([
      {
        id: "dynamic",
        type: "point",
        positionCm: { x: 220, y: 200, z: 200 },
        lumens: 2000,
        kelvin: 3000,
      },
    ]);
    instance.resize(1920, 1080);
    instance.setQualitySettings({
      pixelRatio: 1,
      shadowQuality: "High",
      environmentLightingEnabled: true,
      fillLightLevel: "Off",
    });
    instance.setPresentationSettings({
      environmentIntensity: 1,
      environmentRotationDegrees: 0,
      toneMapping: "AgX",
      exposureEv: 1,
    });
    instance.setModel(model(true, true));
    instance.setGlobalIlluminationSettings({ enabled: false });
    instance.setGlobalIlluminationSettings({ enabled: true });
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    if (failures.length) throw new AggregateError(failures, "Renderer lifecycle failed.");
    status.textContent = `${device}\nNative renderer lifecycle passed · resize/aspect, Walk/Inspection jumps, High quality, exposure, luminaire/model replacement and On/Off/On. Disposal cancels the active refinement burst.`;
  } catch (error) {
    status.textContent = `FAILED: ${String(error)}`;
    console.error(error);
  } finally {
    instance.dispose();
    testCanvas.remove();
    busy = false;
  }
}
async function verifyFallback(): Promise<void> {
  if (busy) return;
  busy = true;
  const fallbackCanvas = document.createElement("canvas");
  fallbackCanvas.style.cssText = "width:480px;height:270px";
  document.body.append(fallbackCanvas);
  const fallback = new WebGPURenderer({
    canvas: fallbackCanvas,
    forceWebGL: true,
    antialias: true,
    reversedDepthBuffer: true,
    logarithmicDepthBuffer: false,
  });
  let fallbackPipeline: ApartmentRenderPipeline | undefined;
  try {
    status.textContent = "Rendering WebGL2 fallback…";
    await fallback.init();
    fallback.setSize(960, 540, false);
    fallback.shadowMap.enabled = true;
    fallback.shadowMap.type = PCFShadowMap;
    fallback.toneMapping = AgXToneMapping;
    build("Point", false, VXGI_CONFIGURATION);
    const capability = globalIlluminationCapability(fallback);
    fallbackPipeline = new ApartmentRenderPipeline(fallback, scene, camera);
    fallbackPipeline.setGiEnabled(capability.available, collector, collector.architectureBounds());
    fallbackPipeline.render();
    status.textContent = `WebGL2 passed · ${capability.reason} · direct point-light shadows, HDR bloom and output transform render successfully.`;
  } catch (error) {
    status.textContent = `FAILED: ${String(error)}`;
    console.error(error);
  } finally {
    fallbackPipeline?.dispose();
    fallback.dispose();
    fallbackCanvas.remove();
    busy = false;
  }
}
async function initialize(): Promise<void> {
  await configureGiTextureLimit(requiredLimits);
  await renderer.init();
  studioEnvironment = createStudioEnvironment(renderer);
  const capability = globalIlluminationCapability(renderer);
  const backend = renderer.backend;
  // Device metadata belongs only to this opt-in engineering page.
  device = `${navigator.userAgent}\n${capability.available ? "Native WebGPU" : capability.reason}`;
  if ("device" in backend) {
    const gpuDevice = backend.device as GPUDevice;
    const info = gpuDevice.adapterInfo;
    device += `\nGPU ${info.vendor} / ${info.architecture} / ${info.device} / ${info.description}`;
    device += `\nSampled textures per stage: ${gpuDevice.limits.maxSampledTexturesPerShaderStage}`;
    device += ` · samplers: ${gpuDevice.limits.maxSamplersPerShaderStage}`;
  }
  document.querySelector("#lifecycle")!.addEventListener("click", () => void exerciseLifecycle());
  document.querySelector("#fallback")!.addEventListener("click", () => void verifyFallback());
  document.querySelector("#fullscreen")!.addEventListener("click", () => {
    if (busy) return;
    busy = true;
    void canvas
      .requestFullscreen()
      .then(async () => {
        pipeline!.resetHistory();
        await frame();
        await document.exitFullscreen();
        pipeline!.resetHistory();
        await frame();
        status.textContent =
          "Native fullscreen entry/exit passed; GI resources and camera retained, history reset.";
      })
      .catch((error) => {
        status.textContent = `Fullscreen unavailable/failed: ${String(error)}`;
      })
      .finally(() => {
        busy = false;
      });
  });
  document.querySelector("#render")!.addEventListener("click", () => void renderCase());
  document.querySelector("#benchmark")!.addEventListener("click", () => void benchmark());
  document
    .querySelector("#intensity-benchmark")!
    .addEventListener("click", () => void benchmark(true));
  await renderCase();
}
void initialize().catch((error) => {
  status.textContent = `FAILED: ${String(error)}`;
  console.error(error);
});
