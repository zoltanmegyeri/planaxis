import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  APARTMENT_SVG_VALIDATION_CLI_EXIT_CODES,
  runApartmentSvgValidationCli,
} from "../src/run-validation-cli.js";

interface CapturedCliRun {
  readonly exitCode: number;
  readonly standardError: readonly string[];
  readonly standardOutput: readonly string[];
}

describe("runApartmentSvgValidationCli", () => {
  it("reports a fully valid Apartment SVG with one success line", async () => {
    const result = await runCli(fixturePath("valid/minimal-document-schema.svg"));

    expect(result.exitCode).toBe(APARTMENT_SVG_VALIDATION_CLI_EXIT_CODES.success);
    expect(result.standardOutput).toEqual(["Apartment SVG is valid."]);
    expect(result.standardError).toEqual([]);
  });

  it("reports malformed XML with the parser kind and source location", async () => {
    const result = await runCli(fixturePath("invalid/malformed-xml.svg"));

    expect(result.exitCode).toBe(APARTMENT_SVG_VALIDATION_CLI_EXIT_CODES.invalidDocument);
    expect(result.standardOutput).toEqual([]);
    expect(result.standardError).toHaveLength(1);
    expect(result.standardError[0]).toMatch(
      /^Parser error \(malformed-xml\) at line \d+, column \d+: .+/,
    );
  });

  it("reports schema-validation diagnostics", async () => {
    const result = await runCli(fixturePath("invalid/duplicate-semantic-id.svg"));

    expect(result.exitCode).toBe(APARTMENT_SVG_VALIDATION_CLI_EXIT_CODES.invalidDocument);
    expect(result.standardOutput).toEqual([]);
    expect(result.standardError[0]).toBe("Schema validation failed.");
    expect(result.standardError).toEqual(
      expect.arrayContaining([expect.stringMatching(/^APSVG-ID-003: .+\[elementId="duplicate",/)]),
    );
  });

  it("reports every error returned by reference validation", async () => {
    const result = await runCli(fixturePath("invalid/multiple-broken-wall-references.svg"));

    expect(result.exitCode).toBe(APARTMENT_SVG_VALIDATION_CLI_EXIT_CODES.invalidDocument);
    expect(result.standardOutput).toEqual([]);
    expect(result.standardError).toHaveLength(3);
    expect(result.standardError[0]).toBe("Reference validation failed.");
    expect(result.standardError[1]).toMatch(
      /^APSVG-REF-001: .+\[elementId="window-1", attribute="data-wall",/,
    );
    expect(result.standardError[2]).toMatch(
      /^APSVG-REF-001: .+\[elementId="window-2", attribute="data-wall",/,
    );
  });

  it("reports geometric validation diagnostics", async () => {
    const result = await runCli(fixturePath("invalid/invalid-wall-axis.svg"));

    expect(result.exitCode).toBe(APARTMENT_SVG_VALIDATION_CLI_EXIT_CODES.invalidDocument);
    expect(result.standardOutput).toEqual([]);
    expect(result.standardError[0]).toBe("Geometry validation failed.");
    expect(result.standardError).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /^APSVG-WALL-001: .+\[elementId="wall-square", attribute="data-axis",/,
        ),
      ]),
    );
  });

  it.each([
    { name: "missing", arguments_: [] },
    { name: "extra", arguments_: ["first.svg", "second.svg"] },
  ])("rejects $name positional arguments", async ({ arguments_ }) => {
    const result = await runCli(...arguments_);

    expect(result.exitCode).toBe(APARTMENT_SVG_VALIDATION_CLI_EXIT_CODES.usageError);
    expect(result.standardOutput).toEqual([]);
    expect(result.standardError).toEqual([
      "Expected exactly one Apartment SVG file path.",
      "Usage: pnpm validate:svg <path-to-svg>",
    ]);
  });

  it("reports a nonexistent file separately from validation failures", async () => {
    const path = fixturePath("invalid/does-not-exist.svg");
    const result = await runCli(path);

    expect(result.exitCode).toBe(APARTMENT_SVG_VALIDATION_CLI_EXIT_CODES.fileReadError);
    expect(result.standardOutput).toEqual([]);
    expect(result.standardError).toHaveLength(1);
    expect(result.standardError[0]).toContain(`File read error for ${JSON.stringify(path)}:`);
    expect(result.standardError[0]).not.toContain("validation failed");
  });
});

async function runCli(...arguments_: string[]): Promise<CapturedCliRun> {
  const standardOutput: string[] = [];
  const standardError: string[] = [];
  const exitCode = await runApartmentSvgValidationCli(arguments_, {
    writeOutput: (line) => standardOutput.push(line),
    writeError: (line) => standardError.push(line),
  });

  return { exitCode, standardOutput, standardError };
}

function fixturePath(relativePath: string): string {
  return fileURLToPath(new URL(`../../../fixtures/${relativePath}`, import.meta.url));
}
