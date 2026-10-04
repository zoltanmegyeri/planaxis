import type { ValidatedDesignDescriptor } from "@planaxis/design";
import type { RuntimeLuminaire } from "@planaxis/renderer-three";

/** Called only with a successfully resolved selected design. */
export function designLuminaires(design?: ValidatedDesignDescriptor): readonly RuntimeLuminaire[] {
  if (design?.document.schema !== "planaxis-design/1.1") return [];
  return (design.document.luminaires ?? []).map((light): RuntimeLuminaire => {
    const common = {
      positionCm: { ...light.position },
      lumens: light.enabled ? light.luminousFluxLumens * light.dimming : 0,
      kelvin: light.colorTemperatureKelvin,
    };
    switch (light.type) {
      case "point":
        return { ...common, type: "point" };
      case "spot":
        return {
          ...common,
          type: "spot",
          orientation: { ...light.orientation },
          beamAngleDegrees: light.beamAngleDegrees,
        };
      case "linear":
        return {
          ...common,
          type: "linear",
          orientation: { ...light.orientation },
          lengthCm: light.lengthCm,
        };
      case "area":
        return {
          ...common,
          type: "area",
          orientation: { ...light.orientation },
          widthCm: light.widthCm,
          heightCm: light.heightCm,
        };
    }
  });
}
