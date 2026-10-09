import type { RuntimeLuminaire } from "../src/runtime-luminaires.js";
import { luminaireFrame } from "../src/runtime-luminaires.js";

/** Experiment only: replaces rectangular direct lights, avoiding duplicate output. */
export function rectangularProxies(
  input: Extract<RuntimeLuminaire, { type: "linear" | "area" }>,
): readonly RuntimeLuminaire[] {
  const columns = Math.min(
    input.type === "linear" ? 4 : 3,
    Math.ceil((input.type === "linear" ? input.lengthCm : input.widthCm) / 50),
  );
  const rows = input.type === "linear" ? 1 : Math.min(3, Math.ceil(input.heightCm / 50));
  const width = input.type === "linear" ? input.lengthCm : input.widthCm;
  const height = input.type === "linear" ? 0 : input.heightCm;
  const axes = luminaireFrame(input.orientation);
  return Array.from({ length: columns * rows }, (_, index) => {
    const u = (((index % columns) + 0.5) / columns - 0.5) * width;
    const v = ((Math.floor(index / columns) + 0.5) / rows - 0.5) * height;
    const offset = axes.side.clone().multiplyScalar(u).addScaledVector(axes.vertical, v);
    return {
      id: `${input.id ?? "rectangle"}-${index}`,
      type: "spot",
      positionCm: {
        x: input.positionCm.x + offset.x,
        y: input.positionCm.y + offset.z,
        z: input.positionCm.z + offset.y,
      },
      lumens: input.lumens / (columns * rows),
      kelvin: input.kelvin,
      orientation: input.orientation,
      beamAngleDegrees: 150,
    };
  });
}
