export { DESIGN_SCHEMA } from "./design.js";
export type {
  DesignDocument,
  DesignFinishAssignment,
  DesignPresentation,
  DesignToneMapping,
  ValidatedDesignDescriptor,
} from "./design.js";
export type {
  DesignValidationCode,
  DesignValidationError,
  DesignValidationResult,
} from "./design-result.js";
export { parseDesignDescriptor, validateDesignDescriptor } from "./validate-design-descriptor.js";
export { resolveDesignArchitecture } from "./resolve-design-architecture.js";
export type {
  DesignArchitecture,
  DesignResolutionError,
  DesignResolutionResult,
} from "./resolve-design-architecture.js";
