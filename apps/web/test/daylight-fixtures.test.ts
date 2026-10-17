import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { parseDesignDescriptor, resolveDesignArchitecture } from "@planaxis/design";
import { parseMaterialDescriptor } from "@planaxis/material";
import { deriveArchitecturalSurfaces } from "@planaxis/model-3d";
import { processDocument } from "../src/process-document.js";
const root = pathToFileURL(
  resolve(process.cwd(), "../../fixtures/projects/path-traced-daylight") + "/",
);

it("loads every public daylight architecture and resolves all declared paint/PBR controls", () => {
  for (const file of readdirSync(new URL("architecture/", root))) {
    const result = processDocument(readFileSync(new URL(`architecture/${file}`, root), "utf8"));
    expect(result.status, file).toBe("valid");
  }
  for (const file of readdirSync(new URL("designs/", root))) {
    const parsed = parseDesignDescriptor(
      readFileSync(new URL(`designs/${file}`, root), "utf8"),
      `designs/${file}`,
    );
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.error));
    const descriptor = parsed.value;
    const document = processDocument(
      readFileSync(new URL(descriptor.document.architecture, root), "utf8"),
    );
    if (document.status !== "valid") throw new Error(JSON.stringify(document));
    const resolved = resolveDesignArchitecture(descriptor, {
      path: descriptor.document.architecture,
      finishTargets: deriveArchitecturalSurfaces(document.architecturalModel).finishTargets,
    });
    expect(resolved.ok, file).toBe(true);
    for (const finish of descriptor.document.finishes ?? []) {
      const material = parseMaterialDescriptor(
        readFileSync(new URL(finish.material, root), "utf8"),
        finish.material,
      );
      expect(material.ok, finish.material).toBe(true);
      if (material.ok)
        for (const image of Object.values(material.value.document.maps ?? {}))
          expect(readFileSync(fileURLToPath(new URL(image, root))).length).toBeGreaterThan(0);
    }
  }
});
