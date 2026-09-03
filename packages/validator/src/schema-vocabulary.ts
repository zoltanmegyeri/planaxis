export const SVG_NAMESPACE_URI = "http://www.w3.org/2000/svg";

export const APARTMENT_SVG_DOCUMENT_VALUES = Object.freeze({
  schema: "apartment-svg",
  schemaVersion: "2.1",
  unit: "cm",
  metadataSchema: "apartment-svg/2.1",
});

export const APARTMENT_SVG_METADATA_COORDINATE_VALUES = Object.freeze({
  x: "right",
  y: "down",
  z: "up",
  heading0: "+x",
  heading90: "+y",
  heading180: "-x",
  heading270: "-y",
});

export const APARTMENT_SVG_GROUP_IDS = Object.freeze({
  spaces: "spaces",
  walls: "walls",
  windows: "windows",
  doors: "doors",
  fixedElements: "fixed-elements",
  utilities: "utilities",
  cameras: "cameras",
  annotations: "annotations",
});

export const APARTMENT_SVG_CORE_GROUP_IDS = Object.freeze([
  APARTMENT_SVG_GROUP_IDS.spaces,
  APARTMENT_SVG_GROUP_IDS.walls,
  APARTMENT_SVG_GROUP_IDS.windows,
  APARTMENT_SVG_GROUP_IDS.doors,
  APARTMENT_SVG_GROUP_IDS.fixedElements,
  APARTMENT_SVG_GROUP_IDS.utilities,
  APARTMENT_SVG_GROUP_IDS.cameras,
] as const);

export const APARTMENT_SVG_REQUIRED_GROUP_IDS = Object.freeze([
  ...APARTMENT_SVG_CORE_GROUP_IDS,
  APARTMENT_SVG_GROUP_IDS.annotations,
] as const);

export type ApartmentSvgCoreGroupId = (typeof APARTMENT_SVG_CORE_GROUP_IDS)[number];

export const APARTMENT_SVG_ELEMENT_NAMES = Object.freeze({
  root: "svg",
  group: "g",
  metadata: "metadata",
  polygon: "polygon",
  rectangle: "rect",
  circle: "circle",
});

export const APARTMENT_SVG_ATTRIBUTES = Object.freeze({
  xmlns: "xmlns",
  viewBox: "viewBox",
  id: "id",
  transform: "transform",
  x: "x",
  y: "y",
  width: "width",
  height: "height",
  cx: "cx",
  cy: "cy",
  radius: "r",
  points: "points",
  dataSchema: "data-schema",
  dataSchemaVersion: "data-schema-version",
  dataUnit: "data-unit",
  dataKind: "data-kind",
  dataName: "data-name",
  dataFunction: "data-function",
  dataFunctionDescription: "data-function-description",
  dataEnclosure: "data-enclosure",
  dataAxis: "data-axis",
  dataHeight: "data-height",
  dataClass: "data-class",
  dataStatus: "data-status",
  dataWall: "data-wall",
  dataSillHeight: "data-sill-height",
  dataOpeningHeight: "data-opening-height",
  dataOpeningType: "data-opening-type",
  dataFrameMaterial: "data-frame-material",
  dataFrameMaterialDescription: "data-frame-material-description",
  dataFrameColor: "data-frame-color",
  dataGlassType: "data-glass-type",
  dataGlassTypeDescription: "data-glass-type-description",
  dataRadiatorBelow: "data-radiator-below",
  dataDoorType: "data-door-type",
  dataHingeX: "data-hinge-x",
  dataHingeY: "data-hinge-y",
  dataOpenLeafX: "data-open-leaf-x",
  dataOpenLeafY: "data-open-leaf-y",
  dataBaseZ: "data-base-z",
  dataTypeDescription: "data-type-description",
  dataZ: "data-z",
  dataHeading: "data-heading",
  dataPitch: "data-pitch",
  dataHorizontalFov: "data-horizontal-fov",
  dataLength: "data-length",
  dataWidth: "data-width",
  dataDepth: "data-depth",
  dataOpeningWidth: "data-opening-width",
  dataWallThickness: "data-wall-thickness",
  dataCenterX: "data-center-x",
  dataCenterY: "data-center-y",
});

export const APARTMENT_SVG_EXTENSION_PREFIXES = Object.freeze({
  dataAttribute: "data-",
  attribute: "data-x-",
  group: "x-",
});

export const APARTMENT_SVG_SEMANTIC_KINDS = Object.freeze({
  zone: "zone",
  wall: "wall",
  window: "window",
  door: "door",
  radiator: "radiator",
  column: "column",
  shaft: "shaft",
  chimney: "chimney",
  boiler: "boiler",
  builtIn: "built-in",
  airConditioner: "air-conditioner",
  stair: "stair",
  mechanicalBox: "mechanical-box",
  fixedObject: "fixed-object",
  socket: "socket",
  ethernet: "ethernet",
  tvCoax: "tv-coax",
  lightSwitch: "light-switch",
  ceilingLight: "ceiling-light",
  wallLight: "wall-light",
  camera: "camera",
});

export const APARTMENT_SVG_STATUS_VALUES = Object.freeze({
  fixed: "fixed",
  modifiable: "modifiable",
  proposal: "proposal",
});

export const APARTMENT_SVG_SHARED_ENUM_VALUES = Object.freeze({
  other: "other",
});

export const APARTMENT_SVG_SPACE_FUNCTION_VALUES = Object.freeze({
  livingRoom: "living-room",
  dining: "dining",
  kitchen: "kitchen",
  bedroom: "bedroom",
  bathroom: "bathroom",
  toilet: "toilet",
  hall: "hall",
  corridor: "corridor",
  entrance: "entrance",
  homeOffice: "home-office",
  storage: "storage",
  utility: "utility",
  balcony: "balcony",
  other: APARTMENT_SVG_SHARED_ENUM_VALUES.other,
});

export const APARTMENT_SVG_SPACE_ENCLOSURE_VALUES = Object.freeze({
  closed: "closed",
  partial: "partial",
  open: "open",
});

export const APARTMENT_SVG_WALL_AXIS_VALUES = Object.freeze({
  x: "x",
  y: "y",
});

export const APARTMENT_SVG_WALL_CLASS_VALUES = Object.freeze({
  interior: "interior",
  exterior: "exterior",
});

export const APARTMENT_SVG_WINDOW_OPENING_TYPE_VALUES = Object.freeze({
  fixed: "fixed",
  casement: "casement",
  tilt: "tilt",
  tiltTurn: "tilt-turn",
  sliding: "sliding",
});

export const APARTMENT_SVG_WINDOW_FRAME_MATERIAL_VALUES = Object.freeze({
  wood: "wood",
  plastic: "plastic",
  aluminium: "aluminium",
  steel: "steel",
  other: APARTMENT_SVG_SHARED_ENUM_VALUES.other,
});

export const APARTMENT_SVG_WINDOW_GLASS_TYPE_VALUES = Object.freeze({
  clear: "clear",
  frosted: "frosted",
  tinted: "tinted",
  other: APARTMENT_SVG_SHARED_ENUM_VALUES.other,
});

export const APARTMENT_SVG_DOOR_TYPE_VALUES = Object.freeze({
  hinged: "hinged",
  sliding: "sliding",
  openingOnly: "opening-only",
});

export const APARTMENT_SVG_FIXED_ELEMENT_KIND_VALUES = Object.freeze({
  radiator: APARTMENT_SVG_SEMANTIC_KINDS.radiator,
  column: APARTMENT_SVG_SEMANTIC_KINDS.column,
  shaft: APARTMENT_SVG_SEMANTIC_KINDS.shaft,
  chimney: APARTMENT_SVG_SEMANTIC_KINDS.chimney,
  boiler: APARTMENT_SVG_SEMANTIC_KINDS.boiler,
  builtIn: APARTMENT_SVG_SEMANTIC_KINDS.builtIn,
  airConditioner: APARTMENT_SVG_SEMANTIC_KINDS.airConditioner,
  stair: APARTMENT_SVG_SEMANTIC_KINDS.stair,
  mechanicalBox: APARTMENT_SVG_SEMANTIC_KINDS.mechanicalBox,
  fixedObject: APARTMENT_SVG_SEMANTIC_KINDS.fixedObject,
});

export const APARTMENT_SVG_UTILITY_KIND_VALUES = Object.freeze({
  socket: APARTMENT_SVG_SEMANTIC_KINDS.socket,
  ethernet: APARTMENT_SVG_SEMANTIC_KINDS.ethernet,
  tvCoax: APARTMENT_SVG_SEMANTIC_KINDS.tvCoax,
  lightSwitch: APARTMENT_SVG_SEMANTIC_KINDS.lightSwitch,
  ceilingLight: APARTMENT_SVG_SEMANTIC_KINDS.ceilingLight,
  wallLight: APARTMENT_SVG_SEMANTIC_KINDS.wallLight,
});
