import { ProjectFilesystem } from "./project-filesystem.js";
import {
  OPTIONAL_PROJECT_DIRECTORIES,
  PROJECT_ARCHITECTURE_DIRECTORY,
  PROJECT_MANIFEST_FILENAME,
} from "./project-format-constants.js";
import { parseProjectManifest, type ProjectManifest } from "./project-manifest.js";
import type { ProjectRelativePath } from "./project-path.js";
import type { ProjectResult } from "./project-result.js";

export interface ProjectContext {
  readonly canonicalRoot: string;
  readonly manifest: ProjectManifest;
  readonly activeArchitecturePath: ProjectRelativePath;
  readonly filesystem: ProjectFilesystem;
}

/** Establish Project Format conformance only; Apartment SVG validation remains downstream. */
export async function loadProject(rootPath: string): Promise<ProjectResult<ProjectContext>> {
  const boundary = await ProjectFilesystem.create(rootPath);
  if (!boundary.ok) return boundary;
  const filesystem = boundary.value;
  const manifestBytes = await filesystem.readFile(PROJECT_MANIFEST_FILENAME);
  if (!manifestBytes.ok) return manifestBytes;
  const manifest = parseProjectManifest(manifestBytes.value);
  if (!manifest.ok) return manifest;

  const architecture = await filesystem.resolve(PROJECT_ARCHITECTURE_DIRECTORY, "directory");
  if (!architecture.ok) return architecture;
  for (const directory of OPTIONAL_PROJECT_DIRECTORIES) {
    const resource = await filesystem.resolve(directory, "directory");
    if (!resource.ok && resource.error.code !== "PROJECT_NOT_FOUND") return resource;
  }
  const activeArchitecturePath = manifest.value.architecture.active;
  const accessible = await filesystem.checkReadableFile(activeArchitecturePath);
  if (!accessible.ok) return accessible;

  return {
    ok: true,
    value: Object.freeze({
      canonicalRoot: filesystem.canonicalRoot,
      manifest: manifest.value,
      activeArchitecturePath,
      filesystem,
    }),
  };
}
