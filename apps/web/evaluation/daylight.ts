/** Opt-in engineering workflow, outside the production application entrypoint. */
import {
  calculateSolarPosition,
  planaxisSunDirection,
  deriveDaylight,
  createCivilClock,
} from "@planaxis/simulation";
import { fetchProjectMetadata, fetchActiveArchitecture } from "../src/project-api.js";
import { processDocument } from "../src/process-document.js";
import { loadDesign } from "../src/load-design.js";
import { designLuminaires } from "../src/design-luminaires.js";
import {
  AgXToneMapping,
  NeutralToneMapping,
  PerspectiveCamera,
  Vector3,
  buildApartmentScene,
  applyEmbeddedCamera,
  buildTracingBvh,
  extractTracingTriangles,
  unsupportedTracingInputs,
  prepareTracingLights,
  PathTracingBackend,
  daylightSkyColors,
  daylightSunColor,
  tracingDaylight,
  reflectedSunRoughness,
  kelvinColor,
} from "../../../packages/renderer-three/evaluation/daylight-adapter.js";
const input = document.querySelector<HTMLCanvasElement>("#input")!;
const status = document.querySelector<HTMLPreElement>("#status")!;
const output = document.querySelector<HTMLPreElement>("#measurements")!;
function fail(error: unknown): void {
  paused = true;
  matrix = [];
  cancelAnimationFrame(frame);
  loading?.abort();
  backend?.dispose();
  backend = undefined;
  cleanup?.();
  cleanup = undefined;
  status.textContent = `FAILED: ${String(error)}`;
  console.error(error);
}
const value = (id: string): string => (document.getElementById(id) as HTMLInputElement).value;
let backend: PathTracingBackend | undefined;
let cleanup: (() => void) | undefined;
let frame = 0,
  samples = 0,
  paused = false,
  generation = 0,
  neutral = false;
let camera: PerspectiveCamera;
let metadata: Record<string, unknown>;
let loading: AbortController | undefined;
let hidden = document.visibilityState === "hidden";
let checkpoints: unknown[] = [];
// Buffers are allocated only by a requested engineering run, never in the product renderer.
let previousLuminance = new Float64Array();
let blockMeans = new Float64Array();
let blockM2 = new Float64Array();
let varianceSamples = 0;
const archive: unknown[] = [];
let matrix: { kind: string; design: string; camera: string; samples: number }[] = [];
function archiveCase(): void {
  const report = { ...metadata, checkpoints };
  archive.push(report);
  document.querySelector("#archive")!.textContent = JSON.stringify(archive, null, 2);
  const image = document.createElement("img");
  image.width = 400;
  image.alt = `${metadata.case} ${metadata.design} ${metadata.camera} ${samples} samples`;
  image.src = backend!.canvas.toDataURL("image/jpeg", 0.95);
  const item = document.createElement("figure");
  item.style.display = "inline-block";
  const caption = document.createElement("figcaption");
  caption.textContent = image.alt;
  item.append(image, caption);
  document.querySelector("#captures")!.append(item);
}
function nextCase(): void {
  const next = matrix.shift();
  if (!next) return;
  for (const [id, val] of Object.entries({
    case: next.kind,
    design: next.design,
    camera: next.camera,
    samples: String(next.samples),
  }))
    (document.getElementById(id) as HTMLInputElement).value = val;
  const current = generation + 1;
  void run().catch((e) => {
    if (current === generation) fail(e);
  });
}
// Bounded optional lamp-audit viewport; both sides of a comparison use the same query.
const width = new URLSearchParams(location.search).get("compact") === "1" ? 400 : 800,
  height = (width * 9) / 16;
// Normalized image rectangles (top-left origin), fixed before looking at final lighting.
type RegionRectangle = readonly [number, number, number, number];
const defaultRegions = {
  shadedWall: [0.7, 0.25, 0.2, 0.15],
  shadedFloor: [0.4, 0.82, 0.18, 0.1],
  directFloor: [0.2, 0.596, 0.1, 0.014],
} satisfies Record<string, RegionRectangle>;
let regions: Record<keyof typeof defaultRegions, RegionRectangle> = defaultRegions;
/** Optional camera-specific measurement rectangles; no transport or persistent scene input. */
function measurementRegions(): typeof regions {
  const query = new URLSearchParams(location.search).get("regions");
  if (query === null) return defaultRegions;
  const parsed: unknown = JSON.parse(query);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    throw new RangeError("Measurement regions must be an object of three normalized rectangles.");
  const keys = Object.keys(defaultRegions) as (keyof typeof defaultRegions)[];
  if (Object.keys(parsed).length !== keys.length)
    throw new RangeError("Measurement regions require shadedWall, shadedFloor and directFloor.");
  const result = { ...defaultRegions };
  for (const key of keys) {
    const raw: unknown = (parsed as Record<string, unknown>)[key];
    if (
      !Array.isArray(raw) ||
      raw.length !== 4 ||
      !raw.every((v: unknown) => typeof v === "number" && Number.isFinite(v))
    )
      throw new RangeError("Measurement rectangles require four finite numbers.");
    const rectangle: RegionRectangle = [raw[0], raw[1], raw[2], raw[3]];
    const [x, y, w, h] = rectangle;
    if (
      x < 0 ||
      y < 0 ||
      w <= 0 ||
      h <= 0 ||
      x + w > 1 ||
      y + h > 1 ||
      Math.floor((x + w) * width) <= Math.floor(x * width) ||
      Math.floor((y + h) * height) <= Math.floor(y * height)
    )
      throw new RangeError("Measurement rectangles must contain pixels inside the image.");
    result[key] = [...rectangle];
  }
  return result;
}
function measure(): unknown {
  const pixels = backend!.readLinearImage(samples);
  if (samples % 512 === 0 && samples === varianceSamples + 512) {
    const count = samples / 512;
    for (let p = 0; p < width * height; p++) {
      const i = p * 4;
      const Y = pixels[i]! * 0.2126 + pixels[i + 1]! * 0.7152 + pixels[i + 2]! * 0.0722;
      const block = (Y * samples - previousLuminance[p]! * varianceSamples) / 512;
      const delta = block - blockMeans[p]!;
      blockMeans[p] = blockMeans[p]! + delta / count;
      blockM2[p] = blockM2[p]! + delta * (block - blockMeans[p]!);
      previousLuminance[p] = Y;
    }
    varianceSamples = samples;
  }
  let maximumY = 0;
  let maximumPixel: { x: number; y: number; rgb: number[] } | undefined;
  for (let i = 0; i < pixels.length; i += 4) {
    const candidate = pixels[i]! * 0.2126 + pixels[i + 1]! * 0.7152 + pixels[i + 2]! * 0.0722;
    if (candidate > maximumY) {
      maximumY = candidate;
      maximumPixel = {
        x: (i / 4) % width,
        y: height - 1 - Math.floor(i / 4 / width),
        rgb: Array.from(pixels.slice(i, i + 3)),
      };
    }
  }
  const measurements = Object.fromEntries(
    Object.entries(regions).map(([name, [x, y, w, h]]) => {
      let sum = 0,
        sumSquares = 0,
        noiseSquares = 0,
        n = 0;
      for (let row = Math.floor(y! * height); row < Math.floor((y! + h!) * height); row++)
        for (let col = Math.floor(x! * width); col < Math.floor((x! + w!) * width); col++) {
          const i = ((height - 1 - row) * width + col) * 4;
          const Y = pixels[i]! * 0.2126 + pixels[i + 1]! * 0.7152 + pixels[i + 2]! * 0.0722;
          sum += Y;
          sumSquares += Y * Y;
          noiseSquares += blockM2[i / 4]!;
          n++;
        }
      return [
        name,
        {
          Y: sum / n,
          spatialSd: Math.sqrt(Math.max(0, sumSquares / n - (sum / n) ** 2)),
          pixels: n,
          pixelNoiseRms:
            varianceSamples >= 1024 && samples === varianceSamples
              ? Math.sqrt(noiseSquares / n / (samples / 512 - 1) / (samples / 512))
              : null,
        },
      ];
    }),
  );
  return { samples, maximumY, maximumPixel, measurements };
}
function tick(): void {
  if (paused || !backend || hidden) return;
  try {
    // Bounded engineering batches remove the display refresh deadline from long references.
    const target = Number(value("samples"));
    for (let batch = 0; batch < 8 && samples < target; batch++) {
      backend.trace(camera, samples++);
      if (samples % 512 === 0 || samples === target) {
        checkpoints.push(measure());
        output.textContent = JSON.stringify({ ...metadata, checkpoints }, null, 2);
      }
    }
    status.textContent = `${metadata.case} · ${samples} samples · accumulating`;
    if (samples < target) frame = requestAnimationFrame(tick);
    else {
      if ((checkpoints.at(-1) as { samples: number } | undefined)?.samples !== samples) {
        checkpoints.push(measure());
        output.textContent = JSON.stringify({ ...metadata, checkpoints }, null, 2);
      }
      paused = true;
      status.textContent += " · complete / paused";
      archiveCase();
      if (matrix.length) requestAnimationFrame(nextCase);
    }
  } catch (error) {
    fail(error);
  }
}
async function run(): Promise<void> {
  cancelAnimationFrame(frame);
  backend?.dispose();
  backend = undefined;
  cleanup?.();
  cleanup = undefined;
  samples = 0;
  varianceSamples = 0;
  previousLuminance = new Float64Array(width * height);
  blockMeans = new Float64Array(width * height);
  blockM2 = new Float64Array(width * height);
  neutral = false;
  paused = true;
  checkpoints = [];
  output.textContent = "";
  const current = ++generation;
  status.textContent = "Loading through configured project boundary…";
  loading?.abort();
  loading = new AbortController();
  const signal = loading.signal;
  const requestedSamples = Number(value("samples"));
  if (!Number.isInteger(requestedSamples) || requestedSamples < 1 || requestedSamples > 2 ** 24)
    throw new RangeError("Samples must be an integer in [1, 16777216].");
  regions = measurementRegions();
  const project = await fetchProjectMetadata(signal);
  const selected = value("design");
  const design = selected ? await loadDesign(selected, project, signal) : undefined;
  const document = design?.document ?? processDocument(await fetchActiveArchitecture(signal));
  if (document.status !== "valid" || (design && !design.resolution?.ok) || design?.materialProblem)
    throw new Error(
      JSON.stringify({
        document,
        problem: design?.problem,
        resolution: design?.resolution,
        material: design?.materialProblem,
      }),
    );
  if (current !== generation) {
    design?.materials?.dispose();
    return;
  }
  cleanup = () => design?.materials?.dispose();
  const model = document.architecturalModel;
  const reason = unsupportedTracingInputs(model, design?.materials?.finishes);
  if (reason) throw new Error(reason);
  const scene = buildApartmentScene(model, design?.materials?.finishes);
  cleanup = () => {
    scene.dispose();
    design?.materials?.dispose();
  };
  camera = new PerspectiveCamera(50, width / height, 0.001, 1000);
  const embedded = model.cameras.find((c) => c.id === value("camera"));
  if (!embedded) throw new Error("Unknown fixture camera.");
  applyEmbeddedCamera(camera, embedded, width / height);
  const location = model.metadata.location;
  if (!location)
    throw new Error("Daylight evaluation requires validated location and north orientation.");
  const kind = value("case");
  const hour =
    kind === "morning" ? 8 : kind === "afternoon" ? 16 : kind.endsWith("night") ? 23 : 12;
  const civil = createCivilClock(location.timeZone ?? "UTC").resolve({
    year: 2026,
    day: 172,
    minute: hour * 60,
  });
  if (civil.status === "missing")
    throw new Error("The reference civil time does not exist in the project zone.");
  const instant = civil.instant;
  const sun = calculateSolarPosition(
    location.latitude.toNumber(),
    location.longitude.toNumber(),
    instant,
  );
  const direction = planaxisSunDirection(location.northHeading.toNumber(), sun);
  const daylight = deriveDaylight(sun.elevation, "sunny");
  const legacy = kind.startsWith("baseline");
  const calibrated = tracingDaylight(sun.elevation);
  const palette = legacy ? daylightSkyColors(daylight) : calibrated;
  const radiance = legacy
    ? daylightSunColor(daylight).multiplyScalar(3 * daylight.directStrength)
    : calibrated.sun;
  if (kind.endsWith("sky") || kind === "sky") radiance.multiplyScalar(0);
  if (kind.endsWith("sun") || kind === "sun") {
    palette.zenith.multiplyScalar(0);
    palette.horizon.multiplyScalar(0);
  }
  backend = new PathTracingBackend(input, fail);
  const bvh = buildTracingBvh(extractTracingTriangles(scene));
  backend.setScene(bvh);
  const effectiveLuminaires = designLuminaires(design?.descriptor);
  const oldLampMapping = kind === "lamp-before-night";
  // Historical control only: reproduce the previous radiometric/Y-normalized adapter.
  // The descriptor and reported nominal/effective lumens remain unchanged.
  const lampInputs = oldLampMapping
    ? effectiveLuminaires.map((light) => {
        const color = kelvinColor(light.kelvin);
        const Y = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
        return { ...light, lumens: light.lumens / (683 * Y) };
      })
    : effectiveLuminaires;
  const lights = prepareTracingLights(lampInputs);
  backend.setLuminaires(lights);
  backend.resize(width, height, input);
  const opaque = kind.includes("one-hit")
    ? 1
    : legacy || kind.startsWith("path8")
      ? 8
      : kind === "path32" || kind === "no-roulette"
        ? 32
        : 16;
  const total = legacy ? 24 : 96;
  backend.setPathLimits({
    opaque,
    total,
    roulette: kind !== "no-roulette",
    legacyTransport: legacy || kind === "old-one-hit-sky",
    sunGuiding: kind !== "unguided",
  });
  backend.setDaylight(
    new Vector3(direction.x, direction.z, direction.y),
    radiance,
    palette.zenith,
    palette.horizon,
    kind === "upper-only",
  );
  backend.setPresentation(AgXToneMapping, 1);
  backend.clear();
  backend.canvas.style.display = "block";
  metadata = {
    case: kind,
    project: project.name,
    architecture: design?.descriptor?.document.architecture ?? project.architecture.active,
    design: selected,
    camera: embedded.id,
    instant: new Date(instant).toISOString(),
    timeZone: location.timeZone,
    weather: "sunny",
    sun,
    direction,
    source: {
      sun: radiance.toArray(),
      zenith: palette.zenith.toArray(),
      horizon: palette.horizon.toArray(),
      lowerHemisphere: kind === "upper-only" ? "black" : "horizon continuation",
    },
    path: {
      opaque,
      total,
      roulette: kind !== "no-roulette",
      legacyTransport: legacy || kind === "old-one-hit-sky",
    },
    sampling: {
      sunGuiding: !legacy && kind !== "old-one-hit-sky" && kind !== "unguided",
      reflectedSunRoughness: reflectedSunRoughness(bvh),
      proposal: "receiver-cosine mixture with reversed horizontal GGX",
    },
    presentation: { toneMapping: "AgX", exposureEV: 0 },
    viewport: { width, height, DPR: 1 },
    lights: lights.lights.length,
    effectiveLuminaires,
    lampMapping: oldLampMapping ? "historical /683/Y" : "Interactive photometric RGB",
    lampEmission: lights.lights.map((light) => ({
      type: light.type,
      rgb: light.emission.toArray(),
    })),
    regions,
  };
  if (current !== generation) return;
  paused = false;
  tick();
}
document.querySelector("#run")!.addEventListener("click", () => {
  const current = generation + 1;
  void run().catch((e) => {
    if (current === generation) fail(e);
  });
});
document.querySelector("#pause")!.addEventListener("click", () => {
  paused = !paused;
  if (paused) {
    cancelAnimationFrame(frame);
    checkpoints.push(measure());
    output.textContent = JSON.stringify({ ...metadata, checkpoints }, null, 2);
    status.textContent = `${samples} samples · paused`;
  } else tick();
});
document.querySelector("#agx")!.addEventListener("click", () => {
  neutral = !neutral;
  backend?.setPresentation(neutral ? NeutralToneMapping : AgXToneMapping, 1);
  backend?.display();
  status.textContent = `${samples} samples · ${neutral ? "Neutral" : "AgX"} redraw`;
});
document.addEventListener("visibilitychange", () => {
  hidden = document.visibilityState === "hidden";
  cancelAnimationFrame(frame);
  if (!hidden && !paused) tick();
});
window.addEventListener("pagehide", () => {
  generation++;
  matrix = [];
  loading?.abort();
  cancelAnimationFrame(frame);
  backend?.dispose();
  cleanup?.();
});

document.querySelector("#matrix")!.addEventListener("click", () => {
  const plan: [string, string, string, number][] = [
    ["final", "05-pbr", "interior", 4096],
    ["final", "06-ao", "interior", 2048],
    ["final", "07-ao-zero", "interior", 2048],
    ["final", "08-metal-rough", "interior", 2048],
    ["final", "09-metal-polished", "interior", 2048],
    ["morning", "01-neutral", "interior", 2048],
    ["afternoon", "01-neutral", "interior", 2048],
    ["night", "01-neutral", "interior", 512],
    ["final", "02-sealed", "interior", 2048],
    ["final", "03-blocked", "interior", 2048],
    ["final", "04-thin", "sealed-side", 2048],
    ["final", "04-thin", "interior", 1024],
    ["night", "10-point", "interior", 2048],
    ["night", "11-spot", "interior", 2048],
    ["night", "12-linear", "interior", 2048],
    ["night", "13-area", "interior", 2048],
    ["night", "14-mixed", "interior", 2048],
    ["final", "14-mixed", "interior", 2048],
  ];
  matrix = plan.map(([kind, design, camera, samples]) => ({
    kind,
    design: `designs/${design}.json`,
    camera,
    samples,
  }));
  nextCase();
});

document.querySelector("#audit")!.addEventListener("click", () => {
  const kinds = [
    "old-one-hit-sky",
    "one-hit-sky",
    "path8",
    "path8-sun",
    "path8-sky",
    "path16",
    "path32",
    "no-roulette",
  ];
  matrix = kinds.map((kind) => ({
    kind,
    design: "designs/01-neutral.json",
    camera: "interior",
    samples: kind.includes("one-hit") ? 2048 : kind === "no-roulette" ? 2048 : 4096,
  }));
  nextCase();
});

document.querySelector("#noise")!.addEventListener("click", () => {
  const plan: [string, string, string, number][] = [
    ["unguided", "09-metal-polished", "interior", 2048],
    ["final", "09-metal-polished", "interior", 2048],
    ["final", "09-metal-polished", "interior", 8192],
    ["sun", "09-metal-polished", "interior", 2048],
    ["sky", "09-metal-polished", "interior", 2048],
    ["final", "01-neutral", "interior", 2048],
    ["final", "15-polished-sealed", "interior", 1024],
    ["final", "16-polished-blocked", "interior", 1024],
    ["final", "17-polished-thin", "sealed-side", 1024],
    ["final", "17-polished-thin", "interior", 512],
    ["final", "18-polished-mixed", "interior", 1024],
    ["night", "18-polished-mixed", "interior", 512],
  ];
  matrix = plan.map(([kind, design, camera, samples]) => ({
    kind,
    design: `designs/${design}.json`,
    camera,
    samples,
  }));
  nextCase();
});

document.querySelector("#sky-review")!.addEventListener("click", () => {
  const plan: [string, string, string, number][] = [
    ["upper-only", "01-neutral", "interior", 2048],
    ["final", "01-neutral", "interior", 1024],
    ["final", "09-metal-polished", "interior", 2048],
    ["sun", "09-metal-polished", "interior", 512],
    ["sky", "09-metal-polished", "interior", 1024],
    ["final", "15-polished-sealed", "interior", 512],
    ["final", "16-polished-blocked", "interior", 512],
    ["final", "17-polished-thin", "sealed-side", 512],
    ["morning", "01-neutral", "interior", 600],
    ["afternoon", "01-neutral", "interior", 512],
    ["night", "18-polished-mixed", "interior", 512],
    ["final", "18-polished-mixed", "interior", 512],
  ];
  matrix = plan.map(([kind, design, camera, samples]) => ({
    kind,
    design: `designs/${design}.json`,
    camera,
    samples,
  }));
  nextCase();
});

document.querySelector("#lamps")!.addEventListener("click", () => {
  const plan: [string, string, string, number][] = [
    ["lamp-before-night", "19-small-point-560", "interior", 512],
    ["night", "19-small-point-560", "interior", 1024],
    ["one-hit-night", "19-small-point-560", "interior", 512],
    ["night", "20-small-point-10000", "interior", 512],
    ["night", "21-small-spot", "interior", 512],
    ["night", "22-small-linear", "interior", 512],
    ["night", "23-small-area", "interior", 512],
    ["night", "24-small-off", "interior", 128],
    ["night", "25-small-dimmed", "interior", 512],
    ["night", "26-small-polished-point", "interior", 1024],
    ["night", "27-partition-point", "sealed-side", 512],
    ["night", "27-partition-point", "interior", 512],
    ["final", "09-metal-polished", "interior", 1024],
  ];
  matrix = plan.map(([kind, design, camera, samples]) => ({
    kind,
    design: `designs/${design}.json`,
    camera,
    samples,
  }));
  nextCase();
});

// Restart the normal server on fixtures/projects/path-traced-pbr before this bounded batch.
document.querySelector("#regressions")!.addEventListener("click", () => {
  const plan: [string, string, string, number][] = [
    ["final", "16-packed", "finish-detail", 1024],
    ["final", "17-separate", "finish-detail", 1024],
    ["final", "05-metal-polished", "window-reflection", 1024],
    ["night", "29-concealed", "interior", 2048],
    ["night", "16-packed", "emitter-front", 1024],
    ["night", "16-packed", "emitter-back", 1024],
  ];
  matrix = plan.map(([kind, design, camera, samples]) => ({
    kind,
    design: `designs/${design}.json`,
    camera,
    samples,
  }));
  nextCase();
});
