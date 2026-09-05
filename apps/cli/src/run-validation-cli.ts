import { readFile } from "node:fs/promises";

import { parseApartmentSvg } from "@planaxis/parser";
import {
  validateApartmentSvgGeometry,
  validateApartmentSvgReferences,
  validateApartmentSvgSchema,
} from "@planaxis/validator";
import type { ApartmentSvgValidationError } from "@planaxis/validator";

export const APARTMENT_SVG_VALIDATION_CLI_EXIT_CODES = Object.freeze({
  success: 0,
  invalidDocument: 1,
  usageError: 2,
  fileReadError: 3,
} as const);

export type ApartmentSvgValidationCliExitCode =
  (typeof APARTMENT_SVG_VALIDATION_CLI_EXIT_CODES)[keyof typeof APARTMENT_SVG_VALIDATION_CLI_EXIT_CODES];

export interface ApartmentSvgValidationCliOutput {
  readonly writeOutput: (line: string) => void;
  readonly writeError: (line: string) => void;
}

const DEFAULT_OUTPUT: ApartmentSvgValidationCliOutput = Object.freeze({
  writeOutput: (line: string): void => {
    process.stdout.write(`${line}\n`);
  },
  writeError: (line: string): void => {
    process.stderr.write(`${line}\n`);
  },
});

const USAGE = "Usage: pnpm validate:svg <path-to-svg>";

export async function runApartmentSvgValidationCli(
  arguments_: readonly string[],
  output: ApartmentSvgValidationCliOutput = DEFAULT_OUTPUT,
): Promise<ApartmentSvgValidationCliExitCode> {
  const inputPath = arguments_[0];
  if (arguments_.length !== 1 || inputPath === undefined || inputPath.length === 0) {
    output.writeError("Expected exactly one Apartment SVG file path.");
    output.writeError(USAGE);
    return APARTMENT_SVG_VALIDATION_CLI_EXIT_CODES.usageError;
  }

  let source: string;

  try {
    source = await readFile(inputPath, "utf8");
  } catch (error: unknown) {
    output.writeError(
      `File read error for ${JSON.stringify(inputPath)}: ${formatUnknownError(error)}`,
    );
    return APARTMENT_SVG_VALIDATION_CLI_EXIT_CODES.fileReadError;
  }

  const parseResult = parseApartmentSvg(source);
  if (!parseResult.ok) {
    const location =
      parseResult.error.location === undefined
        ? ""
        : ` at line ${parseResult.error.location.line}, column ${parseResult.error.location.column}`;
    output.writeError(
      `Parser error (${parseResult.error.kind})${location}: ${parseResult.error.message}`,
    );
    return APARTMENT_SVG_VALIDATION_CLI_EXIT_CODES.invalidDocument;
  }

  const schemaResult = validateApartmentSvgSchema(parseResult.document);
  if (!schemaResult.valid) {
    reportValidationErrors("Schema validation failed.", schemaResult.errors, output);
    return APARTMENT_SVG_VALIDATION_CLI_EXIT_CODES.invalidDocument;
  }

  const referenceResult = validateApartmentSvgReferences(schemaResult.document);
  if (!referenceResult.valid) {
    reportValidationErrors("Reference validation failed.", referenceResult.errors, output);
    return APARTMENT_SVG_VALIDATION_CLI_EXIT_CODES.invalidDocument;
  }

  const geometryResult = validateApartmentSvgGeometry(referenceResult.document);
  if (!geometryResult.valid) {
    reportValidationErrors("Geometry validation failed.", geometryResult.errors, output);
    return APARTMENT_SVG_VALIDATION_CLI_EXIT_CODES.invalidDocument;
  }

  output.writeOutput("Apartment SVG is valid.");
  return APARTMENT_SVG_VALIDATION_CLI_EXIT_CODES.success;
}

function reportValidationErrors(
  heading: string,
  errors: readonly ApartmentSvgValidationError[],
  output: ApartmentSvgValidationCliOutput,
): void {
  output.writeError(heading);
  for (const error of errors) {
    output.writeError(formatValidationError(error));
  }
}

function formatValidationError(error: ApartmentSvgValidationError): string {
  const context: string[] = [];

  if (error.elementId !== undefined) context.push(`elementId=${JSON.stringify(error.elementId)}`);
  if (error.attribute !== undefined) context.push(`attribute=${JSON.stringify(error.attribute)}`);
  if (error.path !== undefined) context.push(`path=${JSON.stringify(error.path)}`);
  context.push(`rule=${JSON.stringify(error.rule)}`);
  if (error.actual !== undefined) context.push(`actual=${JSON.stringify(error.actual)}`);
  context.push(`expected=${JSON.stringify(error.expected)}`);

  return `${error.code}: ${error.message} [${context.join(", ")}]`;
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
