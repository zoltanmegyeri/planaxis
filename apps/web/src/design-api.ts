import { DESIGN_SCHEMA, validateDesignDescriptor } from "@planaxis/design";
import type { ValidatedDesignDescriptor } from "@planaxis/design";
import { ProjectLoadError } from "./project-api.js";

async function request(url: string, label: string, init: RequestInit): Promise<Response> {
  try {
    const response = await fetch(url, init);
    if (!response.ok) throw new ProjectLoadError(`${label} failed (HTTP ${response.status}).`);
    return response;
  } catch (error) {
    // Never display raw server bodies or transport exceptions containing physical paths.
    throw error instanceof ProjectLoadError
      ? error
      : new ProjectLoadError(`${label} failed. Check the PlanAxis server connection.`);
  }
}

export async function fetchDesignPaths(signal: AbortSignal): Promise<readonly string[]> {
  const response = await request("/api/project/designs", "Design discovery", { signal });
  try {
    const value: unknown = await response.json();
    if (
      typeof value !== "object" ||
      value === null ||
      !("designs" in value) ||
      !Array.isArray(value.designs)
    )
      throw new Error();
    const paths: string[] = [];
    for (const path of value.designs) {
      // Reuse the shared descriptor identity boundary without duplicating path semantics.
      const checked = validateDesignDescriptor(
        {
          schema: DESIGN_SCHEMA,
          name: "Discovery",
          architecture: "architecture/unused.svg",
        },
        path,
      );
      if (!checked.ok) throw new Error();
      paths.push(checked.value.path);
    }
    return [...new Set(paths)];
  } catch {
    throw new ProjectLoadError("The server returned an unreadable or invalid design list.");
  }
}

async function readResource(
  kind: "design" | "architecture-resource",
  path: string,
  signal: AbortSignal,
): Promise<string> {
  const label = kind === "design" ? "Design descriptor request" : "Bound architecture request";
  const response = await request(`/api/project/${kind}?${new URLSearchParams({ path })}`, label, {
    signal,
  });
  try {
    return await response.text();
  } catch {
    throw new ProjectLoadError(`${label} returned unreadable content.`);
  }
}

export const fetchDesignDescriptor = (path: string, signal: AbortSignal): Promise<string> =>
  readResource("design", path, signal);
export const fetchBoundArchitecture = (path: string, signal: AbortSignal): Promise<string> =>
  readResource("architecture-resource", path, signal);

export async function persistDesign(
  design: ValidatedDesignDescriptor,
  method: "POST" | "PUT",
  signal: AbortSignal,
): Promise<void> {
  await request(
    `/api/project/design?${new URLSearchParams({ path: design.path })}`,
    method === "POST" ? "Create design" : "Save design",
    {
      method,
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(design.document),
    },
  );
}
