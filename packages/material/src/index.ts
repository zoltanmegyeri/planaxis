export { MATERIAL_SCHEMA } from "./material.js";
export type {
  EffectiveMaterial,
  EffectiveMaterialAlpha,
  MaterialAlpha,
  MaterialBaseColor,
  MaterialDocument,
  MaterialMapping,
  MaterialMaps,
  MaterialTextures,
  ValidatedMaterialDescriptor,
} from "./material.js";
export type {
  MaterialValidationCode,
  MaterialValidationError,
  MaterialValidationResult,
} from "./material-result.js";
export {
  parseMaterialDescriptor,
  validateMaterialDescriptor,
} from "./validate-material-descriptor.js";
export { getEffectiveMaterial } from "./effective-material.js";
