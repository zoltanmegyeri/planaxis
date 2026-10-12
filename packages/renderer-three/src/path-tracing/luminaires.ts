import { Vector3 } from "three/webgpu";
import { kelvinColor, luminaireFrame } from "../runtime-luminaires.js";
import type { RuntimeLuminaire } from "../runtime-luminaires.js";

/** One qualitative photometric-to-RGB policy, not a spectral efficacy measurement. */
export const LUMENS_PER_TRANSPORT_UNIT = 683;
export const LINEAR_EMITTER_WIDTH_METERS = 0.01;
export const TRACING_LIGHT_TEXELS = 5;
export const TRACING_RAY_OFFSET = 0.00001;

export interface TracingLight {
  readonly type: "point" | "spot" | "rectangle";
  readonly position: Vector3;
  readonly forward: Vector3;
  readonly side: Vector3;
  readonly vertical: Vector3;
  readonly width: number;
  readonly height: number;
  readonly coneCosine: number;
  /** RGB intensity for delta sources, RGB radiance for Lambertian rectangles. */
  readonly emission: Vector3;
}

export interface TracingLights {
  readonly lights: readonly TracingLight[];
  readonly records: Float32Array;
  readonly key: string;
}

/** Effective lumens arrive already dimmed. All positive sources participate;
 * canonical ordering gives reordered descriptors identical sampling sequences.
 * Positions are model-space cm, with no further level offset.
 */
export function prepareTracingLights(inputs: readonly RuntimeLuminaire[]): TracingLights {
  const ordered = inputs
    .map((input) => ({ input, key: JSON.stringify(input) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const lights: TracingLight[] = [];
  const records: number[] = [];
  for (const { input } of ordered) {
    if (!Number.isFinite(input.lumens) || input.lumens < 0)
      throw new Error("Path tracing requires finite nonnegative effective lumens.");
    if (input.lumens === 0) continue;
    const position = new Vector3(
      input.positionCm.x / 100,
      input.positionCm.z / 100,
      input.positionCm.y / 100,
    );
    const frame = input.type === "point" ? undefined : luminaireFrame(input.orientation);
    const forward = frame?.forward ?? new Vector3();
    const side = frame?.side ?? new Vector3();
    const vertical = frame?.vertical ?? new Vector3();
    const width =
      input.type === "linear"
        ? input.lengthCm / 100
        : input.type === "area"
          ? input.widthCm / 100
          : 0;
    const height =
      input.type === "linear"
        ? LINEAR_EMITTER_WIDTH_METERS
        : input.type === "area"
          ? input.heightCm / 100
          : 0;
    const halfAngle = input.type === "spot" ? (input.beamAngleDegrees * Math.PI) / 360 : 0;
    const coneCosine = input.type === "spot" ? Math.cos(halfAngle) : 0;
    // 1-cos(theta) = 2*sin(theta/2)^2 avoids cancellation in normalization.
    const normalization =
      input.type === "point"
        ? 4 * Math.PI
        : input.type === "spot"
          ? 4 * Math.PI * Math.sin(halfAngle / 2) ** 2
          : Math.PI * width * height;
    const color = kelvinColor(input.kelvin);
    // Preserve photometric Y while retaining the existing approximate Kelvin chromaticity.
    const luminance = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
    const emission = new Vector3(color.r, color.g, color.b).multiplyScalar(
      input.lumens / (LUMENS_PER_TRANSPORT_UNIT * normalization * luminance),
    );
    const type = input.type === "point" ? "point" : input.type === "spot" ? "spot" : "rectangle";
    const record = [
      ...position.toArray(),
      type === "point" ? 0 : type === "spot" ? 1 : 2,
      ...forward.toArray(),
      coneCosine,
      ...side.toArray(),
      width,
      ...vertical.toArray(),
      height,
      ...emission.toArray(),
      0,
    ];
    if (
      record.some((value) => !Number.isFinite(Math.fround(value))) ||
      emission.toArray().some((value) => value > 0 && Math.fround(value) === 0) ||
      !emission.toArray().some((value) => Math.fround(value) > 0) ||
      (type === "spot" && Math.fround(coneCosine) === 1) ||
      (type === "rectangle" &&
        (!(Math.fround(width * height) > 0) || !Number.isFinite(Math.fround(width * height))))
    )
      throw new Error(`Luminaire ${input.id ?? input.type} exceeds path tracing numeric capacity.`);
    lights.push({ type, position, forward, side, vertical, width, height, coneCosine, emission });
    records.push(...record);
  }
  if (lights.length >= 2 ** 24)
    throw new Error("Luminaires exceed path tracing indexing capacity.");
  // Bound the largest possible NEE estimate above the numerical coincidence cutoff,
  // with headroom for eight interactions and accumulation. Report failure, never clamp flux.
  const floatMaximum = 3.4028234663852886e38;
  if (
    lights.some((light) => {
      const inverseDensity = light.type === "rectangle" ? light.width * light.height : 1;
      const maximumEmission = Math.max(...light.emission.toArray());
      return (
        maximumEmission > floatMaximum / 16 ||
        (maximumEmission * inverseDensity * lights.length) / (Math.PI * TRACING_RAY_OFFSET ** 2) >
          floatMaximum / 16
      );
    })
  )
    throw new Error("Luminaires exceed path tracing transport numeric capacity.");
  return {
    lights,
    records: new Float32Array(records),
    key: JSON.stringify(ordered.map(({ key }) => key)),
  };
}

/** Uniform area sample with its area density; delta sources have unit discrete density. */
export function sampleTracingLight(
  light: TracingLight,
  u: number,
  v: number,
): { position: Vector3; density: number } {
  const position = light.position.clone();
  if (light.type === "rectangle")
    position
      .addScaledVector(light.side, (u - 0.5) * light.width)
      .addScaledVector(light.vertical, (v - 0.5) * light.height);
  return { position, density: light.type === "rectangle" ? 1 / (light.width * light.height) : 1 };
}

/** Unoccluded NEE estimate per unit diffuse albedo, including light-selection probability.
 * Used as a numerical reference for the GLSL estimator and quadrature tests.
 */
export function tracingLightEstimate(
  light: TracingLight,
  point: Vector3,
  normal: Vector3,
  u: number,
  v: number,
  selectionProbability: number,
): Vector3 {
  const sample = sampleTracingLight(light, u, v);
  const direction = sample.position.sub(point);
  const distanceSquared = direction.lengthSq();
  if (distanceSquared <= TRACING_RAY_OFFSET ** 2) return new Vector3();
  direction.normalize();
  const surfaceCosine = Math.max(0, normal.dot(direction));
  const sourceCosine = -light.forward.dot(direction);
  if (light.type === "spot" && sourceCosine < light.coneCosine) return new Vector3();
  const sourceFactor = light.type === "rectangle" ? Math.max(0, sourceCosine) : 1;
  return light.emission
    .clone()
    .multiplyScalar(
      (surfaceCosine * sourceFactor) /
        (Math.PI * distanceSquared * sample.density * selectionProbability),
    );
}
