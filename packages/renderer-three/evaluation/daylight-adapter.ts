/** Test-only renderer facade for the application's daylight engineering page. */
export { AgXToneMapping, NeutralToneMapping, PerspectiveCamera, Vector3 } from "three/webgpu";
export { buildApartmentScene } from "../src/apartment-scene.js";
export { applyEmbeddedCamera } from "../src/cameras.js";
export {
  buildTracingBvh,
  extractTracingTriangles,
  unsupportedTracingInputs,
} from "../src/path-tracing/scene.js";
export { prepareTracingLights } from "../src/path-tracing/luminaires.js";
export { PathTracingBackend } from "../src/path-tracing/backend.js";
export { daylightSkyColors, daylightSunColor } from "../src/physical-sky.js";
export { tracingDaylight } from "../src/path-tracing/daylight.js";
export { reflectedSunRoughness } from "../src/path-tracing/sun-guide.js";
export { kelvinColor } from "../src/runtime-luminaires.js";
