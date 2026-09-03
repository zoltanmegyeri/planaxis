import type { Decimal } from "@planaxis/geometry";
import type { ParsedApartmentSvgDocument, ParsedXmlElement } from "@planaxis/parser";

import {
  describeJsonType,
  describeJsonValue,
  isJsonObject,
  JsonNumberLexeme,
  parseLosslessJson,
} from "./lossless-json.js";
import {
  validateApartmentSvgAngle360,
  validateApartmentSvgElevationMeters,
  validateApartmentSvgId,
  validateApartmentSvgLatitude,
  validateApartmentSvgLongitude,
  validateApartmentSvgNumber,
  validateApartmentSvgPositiveNumber,
  validateApartmentSvgTimeZoneId,
} from "./scalar-validation.js";
import type { ScalarValidationResult } from "./scalar-validation.js";
import type {
  SchemaValidApartmentSvgLocation,
  SchemaValidApartmentSvgMetadata,
} from "./schema-valid-apartment-svg.js";
import { APARTMENT_SVG_VALIDATION_CODES } from "./validation-codes.js";
import type { ApartmentSvgValidationError } from "./validation-result.js";

const SVG_NAMESPACE_URI = "http://www.w3.org/2000/svg";

const ROOT_KEYS = new Set(["schema", "project", "coordinateSystem", "level", "location"]);
const PROJECT_KEYS = new Set(["name", "units"]);
const COORDINATE_SYSTEM_KEYS = new Set(["x", "y", "z", "headingDegrees"]);
const HEADING_KEYS = new Set(["0", "90", "180", "270"]);
const LEVEL_KEYS = new Set(["id", "baseZ", "defaultCeilingHeight"]);
const LOCATION_KEYS = new Set([
  "latitude",
  "longitude",
  "elevationMeters",
  "timeZone",
  "northHeading",
]);

type NumericScalarValidator = (value: string) => ScalarValidationResult<Decimal>;

export interface ApartmentSvgMetadataValidationWithValues {
  readonly errors: readonly ApartmentSvgValidationError[];
  readonly metadata?: SchemaValidApartmentSvgMetadata;
}

export function validateApartmentSvgMetadata(
  document: ParsedApartmentSvgDocument,
  rootDataUnit: string | undefined,
): readonly ApartmentSvgValidationError[] {
  return validateApartmentSvgMetadataWithValues(document, rootDataUnit).errors;
}

export function validateApartmentSvgMetadataWithValues(
  document: ParsedApartmentSvgDocument,
  rootDataUnit: string | undefined,
): ApartmentSvgMetadataValidationWithValues {
  const errors: ApartmentSvgValidationError[] = [];
  const metadataElements = document.metadataElements;

  if (metadataElements.length === 0) {
    errors.push(
      metadataError(
        APARTMENT_SVG_VALIDATION_CODES.metadata.missing,
        "metadata.multiplicity",
        "exactly one direct metadata element",
        "The Apartment SVG root must contain exactly one metadata element.",
      ),
    );
    return metadataValidationResult(errors);
  }

  if (metadataElements.length > 1) {
    errors.push(
      metadataError(
        APARTMENT_SVG_VALIDATION_CODES.metadata.duplicate,
        "metadata.multiplicity",
        "exactly one direct metadata element",
        "The Apartment SVG root contains more than one metadata element.",
        { actual: String(metadataElements.length) },
      ),
    );
    return metadataValidationResult(errors);
  }

  const metadataElement = metadataElements[0];
  if (metadataElement === undefined) {
    throw new Error("Metadata multiplicity was checked but no metadata element is available.");
  }

  const payload = readMetadataPayload(metadataElement, errors);
  if (payload === undefined) {
    return metadataValidationResult(errors);
  }

  let metadataValue: unknown;
  try {
    metadataValue = parseLosslessJson(payload);
  } catch (error: unknown) {
    if (!(error instanceof SyntaxError)) {
      throw error;
    }

    errors.push(
      metadataError(
        APARTMENT_SVG_VALIDATION_CODES.metadata.invalidJson,
        "metadata.json",
        "syntactically valid JSON",
        "The metadata CDATA payload is not valid JSON.",
        { actual: error.message },
      ),
    );
    return metadataValidationResult(errors);
  }

  if (!isJsonObject(metadataValue)) {
    errors.push(
      metadataError(
        APARTMENT_SVG_VALIDATION_CODES.metadata.invalidRoot,
        "metadata.root",
        "a JSON object",
        "The metadata payload root must be a JSON object.",
        { path: "$", actual: describeJsonType(metadataValue) },
      ),
    );
    return metadataValidationResult(errors);
  }

  const metadata = validateMetadataObject(metadataValue, rootDataUnit, errors);
  return metadataValidationResult(errors, metadata);
}

function readMetadataPayload(
  metadataElement: ParsedXmlElement,
  errors: ApartmentSvgValidationError[],
): string | undefined {
  const cdataNodes = metadataElement.children.filter((node) => node.kind === "cdata");
  const hasInvalidContent = metadataElement.children.some(
    (node) => node.kind !== "cdata" && !(node.kind === "text" && node.value.trim() === ""),
  );
  const hasValidElementName =
    metadataElement.name.localName === "metadata" &&
    metadataElement.name.namespaceUri === SVG_NAMESPACE_URI;

  if (!hasValidElementName || cdataNodes.length !== 1 || hasInvalidContent) {
    errors.push(
      metadataError(
        APARTMENT_SVG_VALIDATION_CODES.metadata.invalidContentForm,
        "metadata.content-form",
        "one SVG metadata element containing exactly one CDATA payload, with only optional surrounding whitespace text",
        "The metadata element does not use the required CDATA content form.",
      ),
    );
    return undefined;
  }

  return cdataNodes[0]?.value;
}

function validateMetadataObject(
  metadata: Record<string, unknown>,
  rootDataUnit: string | undefined,
  errors: ApartmentSvgValidationError[],
): SchemaValidApartmentSvgMetadata | undefined {
  const initialErrorCount = errors.length;
  validateExtensionKeys(metadata, ROOT_KEYS, "$", errors);
  const schema = validateRequiredString(
    metadata,
    "schema",
    "$",
    'exactly "apartment-svg/2.1"',
    (value) => value === "apartment-svg/2.1",
    errors,
  );

  const project = validateRequiredObject(metadata, "project", "$", errors);
  const validatedProject = project === undefined ? undefined : validateProject(project, errors);
  const projectUnits =
    project !== undefined && typeof project.units === "string" ? project.units : undefined;

  const coordinateSystem = validateRequiredObject(metadata, "coordinateSystem", "$", errors);
  const validatedCoordinateSystem =
    coordinateSystem === undefined ? undefined : validateCoordinateSystem(coordinateSystem, errors);

  const level = validateRequiredObject(metadata, "level", "$", errors);
  const validatedLevel = level === undefined ? undefined : validateLevel(level, errors);

  let validatedLocation: SchemaValidApartmentSvgLocation | undefined;
  if (Object.hasOwn(metadata, "location")) {
    const location = metadata.location;
    if (!isJsonObject(location)) {
      errors.push(invalidPropertyType("$.location", "object", location));
    } else {
      validatedLocation = validateLocation(location, errors);
    }
  }

  if (projectUnits !== undefined && rootDataUnit !== undefined && projectUnits !== rootDataUnit) {
    errors.push(
      metadataError(
        APARTMENT_SVG_VALIDATION_CODES.metadata.unitsMismatch,
        "metadata.project.units-matches-root-data-unit",
        "metadata project.units equal to root data-unit",
        "Metadata project units do not match the root data-unit value.",
        {
          path: "$.project.units",
          attribute: "data-unit",
          actual: `${JSON.stringify(projectUnits)} != ${JSON.stringify(rootDataUnit)}`,
        },
      ),
    );
  }

  if (
    errors.length !== initialErrorCount ||
    schema === undefined ||
    validatedProject === undefined ||
    validatedCoordinateSystem === undefined ||
    validatedLevel === undefined
  ) {
    return undefined;
  }

  return Object.freeze({
    schema: "apartment-svg/2.1",
    project: validatedProject,
    coordinateSystem: validatedCoordinateSystem,
    level: validatedLevel,
    ...(validatedLocation === undefined ? {} : { location: validatedLocation }),
  });
}

function validateProject(
  project: Record<string, unknown>,
  errors: ApartmentSvgValidationError[],
): SchemaValidApartmentSvgMetadata["project"] | undefined {
  const initialErrorCount = errors.length;
  validateExtensionKeys(project, PROJECT_KEYS, "$.project", errors);
  const name = validateRequiredString(
    project,
    "name",
    "$.project",
    "a non-empty string",
    (value) => value.length > 0,
    errors,
  );

  const units = validateRequiredString(
    project,
    "units",
    "$.project",
    'exactly "cm"',
    (value) => value === "cm",
    errors,
  );

  if (errors.length !== initialErrorCount || name === undefined || units === undefined) {
    return undefined;
  }

  return Object.freeze({ name, units: "cm" });
}

function validateCoordinateSystem(
  coordinateSystem: Record<string, unknown>,
  errors: ApartmentSvgValidationError[],
): SchemaValidApartmentSvgMetadata["coordinateSystem"] | undefined {
  const initialErrorCount = errors.length;
  validateExtensionKeys(coordinateSystem, COORDINATE_SYSTEM_KEYS, "$.coordinateSystem", errors);
  const x = validateRequiredStringConstant(
    coordinateSystem,
    "x",
    "$.coordinateSystem",
    "right",
    errors,
  );
  const y = validateRequiredStringConstant(
    coordinateSystem,
    "y",
    "$.coordinateSystem",
    "down",
    errors,
  );
  const z = validateRequiredStringConstant(
    coordinateSystem,
    "z",
    "$.coordinateSystem",
    "up",
    errors,
  );

  const headings = validateRequiredObject(
    coordinateSystem,
    "headingDegrees",
    "$.coordinateSystem",
    errors,
  );
  if (headings === undefined) {
    return undefined;
  }

  validateExtensionKeys(headings, HEADING_KEYS, "$.coordinateSystem.headingDegrees", errors);
  const heading0 = validateRequiredStringConstant(
    headings,
    "0",
    "$.coordinateSystem.headingDegrees",
    "+x",
    errors,
  );
  const heading90 = validateRequiredStringConstant(
    headings,
    "90",
    "$.coordinateSystem.headingDegrees",
    "+y",
    errors,
  );
  const heading180 = validateRequiredStringConstant(
    headings,
    "180",
    "$.coordinateSystem.headingDegrees",
    "-x",
    errors,
  );
  const heading270 = validateRequiredStringConstant(
    headings,
    "270",
    "$.coordinateSystem.headingDegrees",
    "-y",
    errors,
  );

  if (
    errors.length !== initialErrorCount ||
    x === undefined ||
    y === undefined ||
    z === undefined ||
    heading0 === undefined ||
    heading90 === undefined ||
    heading180 === undefined ||
    heading270 === undefined
  ) {
    return undefined;
  }

  return Object.freeze({
    x: "right",
    y: "down",
    z: "up",
    headingDegrees: Object.freeze({ 0: "+x", 90: "+y", 180: "-x", 270: "-y" }),
  });
}

function validateLevel(
  level: Record<string, unknown>,
  errors: ApartmentSvgValidationError[],
): SchemaValidApartmentSvgMetadata["level"] | undefined {
  const initialErrorCount = errors.length;
  validateExtensionKeys(level, LEVEL_KEYS, "$.level", errors);
  const id = validateRequiredIdProperty(level, "id", "$.level", errors);

  const baseZ = validateRequiredNumericProperty(
    level,
    "baseZ",
    "$.level",
    validateApartmentSvgNumber,
    errors,
  );
  const defaultCeilingHeight = validateRequiredNumericProperty(
    level,
    "defaultCeilingHeight",
    "$.level",
    validateApartmentSvgPositiveNumber,
    errors,
  );

  if (
    errors.length !== initialErrorCount ||
    id === undefined ||
    baseZ === undefined ||
    defaultCeilingHeight === undefined
  ) {
    return undefined;
  }

  return Object.freeze({ id, baseZ, defaultCeilingHeight });
}

function validateLocation(
  location: Record<string, unknown>,
  errors: ApartmentSvgValidationError[],
): SchemaValidApartmentSvgLocation | undefined {
  const initialErrorCount = errors.length;
  validateExtensionKeys(location, LOCATION_KEYS, "$.location", errors);
  const latitude = validateRequiredNumericProperty(
    location,
    "latitude",
    "$.location",
    validateApartmentSvgLatitude,
    errors,
  );
  const longitude = validateRequiredNumericProperty(
    location,
    "longitude",
    "$.location",
    validateApartmentSvgLongitude,
    errors,
  );
  const northHeading = validateRequiredNumericProperty(
    location,
    "northHeading",
    "$.location",
    validateApartmentSvgAngle360,
    errors,
  );

  let elevationMeters: Decimal | undefined;
  if (Object.hasOwn(location, "elevationMeters")) {
    elevationMeters = validatePresentNumericProperty(
      location,
      "elevationMeters",
      "$.location",
      validateApartmentSvgElevationMeters,
      errors,
    );
  }

  let timeZone: string | undefined;
  if (Object.hasOwn(location, "timeZone")) {
    const timeZoneValue = location.timeZone;
    if (typeof timeZoneValue !== "string") {
      errors.push(invalidPropertyType("$.location.timeZone", "string", timeZoneValue));
    } else {
      const result = validateApartmentSvgTimeZoneId(timeZoneValue);
      if (!result.valid) {
        errors.push(invalidPropertyValue("$.location.timeZone", result.expected, timeZoneValue));
      } else {
        timeZone = result.value;
      }
    }
  }

  if (
    errors.length !== initialErrorCount ||
    latitude === undefined ||
    longitude === undefined ||
    northHeading === undefined
  ) {
    return undefined;
  }

  return Object.freeze({
    latitude,
    longitude,
    northHeading,
    ...(elevationMeters === undefined ? {} : { elevationMeters }),
    ...(timeZone === undefined ? {} : { timeZone }),
  });
}

function validateRequiredObject(
  object: Record<string, unknown>,
  key: string,
  parentPath: string,
  errors: ApartmentSvgValidationError[],
): Record<string, unknown> | undefined {
  const path = `${parentPath}.${key}`;
  if (!Object.hasOwn(object, key)) {
    errors.push(missingProperty(path, "object"));
    return undefined;
  }

  const value = object[key];
  if (!isJsonObject(value)) {
    errors.push(invalidPropertyType(path, "object", value));
    return undefined;
  }

  return value;
}

function validateRequiredStringConstant(
  object: Record<string, unknown>,
  key: string,
  parentPath: string,
  expectedValue: string,
  errors: ApartmentSvgValidationError[],
): string | undefined {
  return validateRequiredString(
    object,
    key,
    parentPath,
    `exactly ${JSON.stringify(expectedValue)}`,
    (value) => value === expectedValue,
    errors,
  );
}

function validateRequiredString(
  object: Record<string, unknown>,
  key: string,
  parentPath: string,
  expected: string,
  isValid: (value: string) => boolean,
  errors: ApartmentSvgValidationError[],
): string | undefined {
  const path = `${parentPath}.${key}`;
  if (!Object.hasOwn(object, key)) {
    errors.push(missingProperty(path, expected));
    return undefined;
  }

  const value = object[key];
  if (typeof value !== "string") {
    errors.push(invalidPropertyType(path, "string", value));
    return undefined;
  }

  if (!isValid(value)) {
    errors.push(invalidPropertyValue(path, expected, value));
    return undefined;
  }

  return value;
}

function validateRequiredNumericProperty(
  object: Record<string, unknown>,
  key: string,
  parentPath: string,
  validateScalar: NumericScalarValidator,
  errors: ApartmentSvgValidationError[],
): Decimal | undefined {
  const path = `${parentPath}.${key}`;
  if (!Object.hasOwn(object, key)) {
    errors.push(
      missingProperty(path, "a JSON number with the required Apartment SVG value constraints"),
    );
    return undefined;
  }

  return validatePresentNumericProperty(object, key, parentPath, validateScalar, errors);
}

function validateRequiredIdProperty(
  object: Record<string, unknown>,
  key: string,
  parentPath: string,
  errors: ApartmentSvgValidationError[],
): string | undefined {
  const path = `${parentPath}.${key}`;
  if (!Object.hasOwn(object, key)) {
    errors.push(missingProperty(path, "an Apartment SVG Id"));
    return undefined;
  }

  const value = object[key];
  if (typeof value !== "string") {
    errors.push(invalidPropertyType(path, "string", value));
    return undefined;
  }

  const result = validateApartmentSvgId(value);
  if (!result.valid) {
    errors.push(invalidPropertyValue(path, result.expected, value));
    return undefined;
  }

  return result.value;
}

function validatePresentNumericProperty(
  object: Record<string, unknown>,
  key: string,
  parentPath: string,
  validateScalar: NumericScalarValidator,
  errors: ApartmentSvgValidationError[],
): Decimal | undefined {
  const path = `${parentPath}.${key}`;
  const value = object[key];
  if (!(value instanceof JsonNumberLexeme)) {
    errors.push(invalidPropertyType(path, "number", value));
    return undefined;
  }

  const result = validateScalar(value.lexicalValue);
  if (!result.valid) {
    errors.push(
      metadataError(
        APARTMENT_SVG_VALIDATION_CODES.metadata.invalidPropertyValue,
        "metadata.property-value",
        result.expected,
        `Metadata property ${path} has an invalid value.`,
        { path, actual: value.lexicalValue },
      ),
    );
    return undefined;
  }

  return result.value;
}

function metadataValidationResult(
  errors: ApartmentSvgValidationError[],
  metadata?: SchemaValidApartmentSvgMetadata,
): ApartmentSvgMetadataValidationWithValues {
  const frozenErrors = Object.freeze(errors);
  if (frozenErrors.length > 0 || metadata === undefined) {
    return Object.freeze({ errors: frozenErrors });
  }

  return Object.freeze({ errors: frozenErrors, metadata });
}

function validateExtensionKeys(
  object: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
  path: string,
  errors: ApartmentSvgValidationError[],
): void {
  for (const key of Object.keys(object)) {
    if (allowedKeys.has(key) || key.startsWith("x-")) {
      continue;
    }

    errors.push(
      metadataError(
        APARTMENT_SVG_VALIDATION_CODES.metadata.unknownProperty,
        "metadata.extension-key",
        "a defined core key or an extension key beginning with x-",
        `Metadata property ${path}.${key} is not permitted.`,
        { path: `${path}.${key}`, actual: key },
      ),
    );
  }
}

function missingProperty(path: string, expected: string): ApartmentSvgValidationError {
  return metadataError(
    APARTMENT_SVG_VALIDATION_CODES.metadata.missingProperty,
    "metadata.required-property",
    expected,
    `Required metadata property ${path} is missing.`,
    { path },
  );
}

function invalidPropertyType(
  path: string,
  expectedType: string,
  actual: unknown,
): ApartmentSvgValidationError {
  return metadataError(
    APARTMENT_SVG_VALIDATION_CODES.metadata.invalidPropertyType,
    "metadata.property-type",
    `JSON ${expectedType}`,
    `Metadata property ${path} has the wrong JSON value type.`,
    { path, actual: describeJsonType(actual) },
  );
}

function invalidPropertyValue(
  path: string,
  expected: string,
  actual: unknown,
): ApartmentSvgValidationError {
  return metadataError(
    APARTMENT_SVG_VALIDATION_CODES.metadata.invalidPropertyValue,
    "metadata.property-value",
    expected,
    `Metadata property ${path} has an invalid value.`,
    { path, actual: describeJsonValue(actual) },
  );
}

interface MetadataErrorContext {
  readonly path?: string;
  readonly attribute?: string;
  readonly actual?: string;
}

function metadataError(
  code: ApartmentSvgValidationError["code"],
  rule: string,
  expected: string,
  message: string,
  context: MetadataErrorContext = {},
): ApartmentSvgValidationError {
  return Object.freeze({
    code,
    category: "metadata",
    rule,
    expected,
    message,
    ...context,
  });
}
