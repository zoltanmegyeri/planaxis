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

type NumericScalarValidator = (value: string) => ScalarValidationResult<unknown>;

export function validateApartmentSvgMetadata(
  document: ParsedApartmentSvgDocument,
  rootDataUnit: string | undefined,
): readonly ApartmentSvgValidationError[] {
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
    return errors;
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
    return errors;
  }

  const metadataElement = metadataElements[0];
  if (metadataElement === undefined) {
    throw new Error("Metadata multiplicity was checked but no metadata element is available.");
  }

  const payload = readMetadataPayload(metadataElement, errors);
  if (payload === undefined) {
    return errors;
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
    return errors;
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
    return errors;
  }

  validateMetadataObject(metadataValue, rootDataUnit, errors);
  return errors;
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
): void {
  validateExtensionKeys(metadata, ROOT_KEYS, "$", errors);
  validateRequiredString(
    metadata,
    "schema",
    "$",
    'exactly "apartment-svg/2.1"',
    (value) => value === "apartment-svg/2.1",
    errors,
  );

  const project = validateRequiredObject(metadata, "project", "$", errors);
  const projectUnits = project === undefined ? undefined : validateProject(project, errors);

  const coordinateSystem = validateRequiredObject(metadata, "coordinateSystem", "$", errors);
  if (coordinateSystem !== undefined) {
    validateCoordinateSystem(coordinateSystem, errors);
  }

  const level = validateRequiredObject(metadata, "level", "$", errors);
  if (level !== undefined) {
    validateLevel(level, errors);
  }

  if (Object.hasOwn(metadata, "location")) {
    const location = metadata.location;
    if (!isJsonObject(location)) {
      errors.push(invalidPropertyType("$.location", "object", location));
    } else {
      validateLocation(location, errors);
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
}

function validateProject(
  project: Record<string, unknown>,
  errors: ApartmentSvgValidationError[],
): string | undefined {
  validateExtensionKeys(project, PROJECT_KEYS, "$.project", errors);
  validateRequiredString(
    project,
    "name",
    "$.project",
    "a non-empty string",
    (value) => value.length > 0,
    errors,
  );

  return validateRequiredString(
    project,
    "units",
    "$.project",
    'exactly "cm"',
    (value) => value === "cm",
    errors,
  );
}

function validateCoordinateSystem(
  coordinateSystem: Record<string, unknown>,
  errors: ApartmentSvgValidationError[],
): void {
  validateExtensionKeys(coordinateSystem, COORDINATE_SYSTEM_KEYS, "$.coordinateSystem", errors);
  validateRequiredStringConstant(coordinateSystem, "x", "$.coordinateSystem", "right", errors);
  validateRequiredStringConstant(coordinateSystem, "y", "$.coordinateSystem", "down", errors);
  validateRequiredStringConstant(coordinateSystem, "z", "$.coordinateSystem", "up", errors);

  const headings = validateRequiredObject(
    coordinateSystem,
    "headingDegrees",
    "$.coordinateSystem",
    errors,
  );
  if (headings === undefined) {
    return;
  }

  validateExtensionKeys(headings, HEADING_KEYS, "$.coordinateSystem.headingDegrees", errors);
  validateRequiredStringConstant(headings, "0", "$.coordinateSystem.headingDegrees", "+x", errors);
  validateRequiredStringConstant(headings, "90", "$.coordinateSystem.headingDegrees", "+y", errors);
  validateRequiredStringConstant(
    headings,
    "180",
    "$.coordinateSystem.headingDegrees",
    "-x",
    errors,
  );
  validateRequiredStringConstant(
    headings,
    "270",
    "$.coordinateSystem.headingDegrees",
    "-y",
    errors,
  );
}

function validateLevel(
  level: Record<string, unknown>,
  errors: ApartmentSvgValidationError[],
): void {
  validateExtensionKeys(level, LEVEL_KEYS, "$.level", errors);
  validateRequiredIdProperty(level, "id", "$.level", errors);

  validateRequiredNumericProperty(level, "baseZ", "$.level", validateApartmentSvgNumber, errors);
  validateRequiredNumericProperty(
    level,
    "defaultCeilingHeight",
    "$.level",
    validateApartmentSvgPositiveNumber,
    errors,
  );
}

function validateLocation(
  location: Record<string, unknown>,
  errors: ApartmentSvgValidationError[],
): void {
  validateExtensionKeys(location, LOCATION_KEYS, "$.location", errors);
  validateRequiredNumericProperty(
    location,
    "latitude",
    "$.location",
    validateApartmentSvgLatitude,
    errors,
  );
  validateRequiredNumericProperty(
    location,
    "longitude",
    "$.location",
    validateApartmentSvgLongitude,
    errors,
  );
  validateRequiredNumericProperty(
    location,
    "northHeading",
    "$.location",
    validateApartmentSvgAngle360,
    errors,
  );

  if (Object.hasOwn(location, "elevationMeters")) {
    validatePresentNumericProperty(
      location,
      "elevationMeters",
      "$.location",
      validateApartmentSvgElevationMeters,
      errors,
    );
  }

  if (Object.hasOwn(location, "timeZone")) {
    const timeZone = location.timeZone;
    if (typeof timeZone !== "string") {
      errors.push(invalidPropertyType("$.location.timeZone", "string", timeZone));
    } else {
      const result = validateApartmentSvgTimeZoneId(timeZone);
      if (!result.valid) {
        errors.push(invalidPropertyValue("$.location.timeZone", result.expected, timeZone));
      }
    }
  }
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
): void {
  validateRequiredString(
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
  }

  return value;
}

function validateRequiredNumericProperty(
  object: Record<string, unknown>,
  key: string,
  parentPath: string,
  validateScalar: NumericScalarValidator,
  errors: ApartmentSvgValidationError[],
): void {
  const path = `${parentPath}.${key}`;
  if (!Object.hasOwn(object, key)) {
    errors.push(
      missingProperty(path, "a JSON number with the required Apartment SVG value constraints"),
    );
    return;
  }

  validatePresentNumericProperty(object, key, parentPath, validateScalar, errors);
}

function validateRequiredIdProperty(
  object: Record<string, unknown>,
  key: string,
  parentPath: string,
  errors: ApartmentSvgValidationError[],
): void {
  const path = `${parentPath}.${key}`;
  if (!Object.hasOwn(object, key)) {
    errors.push(missingProperty(path, "an Apartment SVG Id"));
    return;
  }

  const value = object[key];
  if (typeof value !== "string") {
    errors.push(invalidPropertyType(path, "string", value));
    return;
  }

  const result = validateApartmentSvgId(value);
  if (!result.valid) {
    errors.push(invalidPropertyValue(path, result.expected, value));
  }
}

function validatePresentNumericProperty(
  object: Record<string, unknown>,
  key: string,
  parentPath: string,
  validateScalar: NumericScalarValidator,
  errors: ApartmentSvgValidationError[],
): void {
  const path = `${parentPath}.${key}`;
  const value = object[key];
  if (!(value instanceof JsonNumberLexeme)) {
    errors.push(invalidPropertyType(path, "number", value));
    return;
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
  }
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
