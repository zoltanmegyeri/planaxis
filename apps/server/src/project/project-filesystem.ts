import { constants, type Stats } from "node:fs";
import { lstat, open, readdir, realpath, type FileHandle } from "node:fs/promises";
import path from "node:path";

import {
  OPTIONAL_PROJECT_DIRECTORIES,
  PROJECT_ARCHITECTURE_DIRECTORY,
  PROJECT_MANIFEST_FILENAME,
} from "./project-format-constants.js";
import { validateProjectRelativePath, type ProjectRelativePath } from "./project-path.js";
import { projectFailure, type ProjectResult } from "./project-result.js";

const RESERVED_NAMES = new Set<string>([
  PROJECT_MANIFEST_FILENAME,
  PROJECT_ARCHITECTURE_DIRECTORY,
  ...OPTIONAL_PROJECT_DIRECTORIES,
]);

export interface ProjectResource {
  readonly projectRelativePath: ProjectRelativePath;
  /** Transient backend metadata; callers must use the boundary again for later I/O. */
  readonly absolutePath: string;
  readonly kind: "file" | "directory";
}

interface InspectedResource {
  readonly resource: ProjectResource;
  readonly stats: Stats;
}

export function isWithinProjectRoot(canonicalRoot: string, target: string): boolean {
  const relative = path.relative(canonicalRoot, target);
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function filesystemFailure(error: unknown, location: string): ProjectResult<never> {
  const code =
    typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
  switch (code) {
    case "ENOENT":
      return projectFailure("PROJECT_NOT_FOUND", location, "The required path does not exist.");
    case "ENOTDIR":
      return projectFailure("PROJECT_NOT_DIRECTORY", location, "Expected a directory.");
    case "EACCES":
    case "EPERM":
      return projectFailure("PROJECT_INACCESSIBLE", location, "The path is not accessible.");
    case "ELOOP":
      return projectFailure("PROJECT_SYMLINK", location, "Symbolic-link traversal is prohibited.");
    case "EINVAL":
    case "ENAMETOOLONG":
      return projectFailure("PROJECT_INVALID_PATH", location, "The host cannot access this path.");
    default:
      throw new Error("Unexpected project filesystem failure.", { cause: error });
  }
}

function sameFile(first: Stats, second: Stats): boolean {
  return first.dev === second.dev && first.ino === second.ino;
}

/** Owns read-only access to one canonical physical root (Project Format 1.0 section 9). */
export class ProjectFilesystem {
  readonly #root: string;
  readonly #rootStats: Stats;

  private constructor(canonicalRoot: string, rootStats: Stats) {
    this.#root = canonicalRoot;
    this.#rootStats = rootStats;
  }

  public get canonicalRoot(): string {
    return this.#root;
  }

  public static async create(rootPath: string): Promise<ProjectResult<ProjectFilesystem>> {
    if (rootPath.length === 0 || rootPath.includes("\0")) {
      return projectFailure(
        "PROJECT_INVALID_PATH",
        "projectRoot",
        "Expected a physical root path.",
      );
    }
    try {
      // Only the supplied root may pass through OS indirection before establishing the boundary.
      const canonicalRoot = await realpath(rootPath);
      const stats = await lstat(canonicalRoot);
      if (!stats.isDirectory()) {
        return projectFailure(
          "PROJECT_NOT_DIRECTORY",
          "projectRoot",
          "The project root must be a directory.",
        );
      }
      return { ok: true, value: new ProjectFilesystem(canonicalRoot, stats) };
    } catch (error: unknown) {
      return filesystemFailure(error, "projectRoot");
    }
  }

  private async inspect(
    input: unknown,
    kind: ProjectResource["kind"],
  ): Promise<ProjectResult<InspectedResource>> {
    const validated = validateProjectRelativePath(input);
    if (!validated.ok) return validated;
    const projectRelativePath = validated.value;

    try {
      const rootStats = await lstat(this.#root);
      if (rootStats.isSymbolicLink()) {
        return projectFailure(
          "PROJECT_SYMLINK",
          "projectRoot",
          "The established root was replaced by a symbolic link.",
        );
      }
      if (!sameFile(rootStats, this.#rootStats) || (await realpath(this.#root)) !== this.#root) {
        return projectFailure(
          "PROJECT_RESOURCE_CHANGED",
          "projectRoot",
          "The established physical root has changed.",
        );
      }

      const segments = projectRelativePath.split("/");
      let current = this.#root;
      let stats = rootStats;
      for (const [index, segment] of segments.entries()) {
        // Reserved root names have normative case-sensitive spellings even on case-insensitive hosts.
        if (
          index === 0 &&
          RESERVED_NAMES.has(segment) &&
          !(await readdir(this.#root)).includes(segment)
        ) {
          return projectFailure(
            "PROJECT_NOT_FOUND",
            projectRelativePath,
            "The reserved root entry is missing its exact spelling.",
          );
        }
        current = path.resolve(current, segment);
        if (!isWithinProjectRoot(this.#root, current)) {
          return projectFailure(
            "PROJECT_OUTSIDE_ROOT",
            projectRelativePath,
            "The resource must remain inside the project root.",
          );
        }
        stats = await lstat(current);
        if (stats.isSymbolicLink()) {
          return projectFailure(
            "PROJECT_SYMLINK",
            projectRelativePath,
            "Resource paths must not traverse symbolic links.",
          );
        }
        if (index < segments.length - 1 && !stats.isDirectory()) {
          return projectFailure(
            "PROJECT_NOT_DIRECTORY",
            projectRelativePath,
            "An intermediate resource component is not a directory.",
          );
        }
        const physicalPath = await realpath(current);
        if (!isWithinProjectRoot(this.#root, physicalPath)) {
          return projectFailure(
            "PROJECT_OUTSIDE_ROOT",
            projectRelativePath,
            "The physical resource must remain inside the project root.",
          );
        }
      }

      if (kind === "directory" ? !stats.isDirectory() : !stats.isFile()) {
        return projectFailure(
          kind === "directory" ? "PROJECT_NOT_DIRECTORY" : "PROJECT_NOT_REGULAR_FILE",
          projectRelativePath,
          kind === "directory" ? "Expected a directory." : "Expected a regular file.",
        );
      }
      return {
        ok: true,
        value: { resource: { projectRelativePath, absolutePath: current, kind }, stats },
      };
    } catch (error: unknown) {
      return filesystemFailure(error, projectRelativePath);
    }
  }

  /** Resolution is a current observation, not a capability to bypass subsequent boundary checks. */
  public async resolve(
    projectRelativePath: unknown,
    kind: ProjectResource["kind"] = "file",
  ): Promise<ProjectResult<ProjectResource>> {
    const inspected = await this.inspect(projectRelativePath, kind);
    return inspected.ok ? { ok: true, value: inspected.value.resource } : inspected;
  }

  private async withReadableFile<T>(
    input: unknown,
    consume: (handle: FileHandle) => Promise<T>,
  ): Promise<ProjectResult<T>> {
    const inspected = await this.inspect(input, "file");
    if (!inspected.ok) return inspected;
    const { resource, stats } = inspected.value;
    try {
      // NOFOLLOW protects the final component; NONBLOCK avoids hanging if it becomes a FIFO.
      const handle = await open(
        resource.absolutePath,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
      try {
        const openedStats = await handle.stat();
        const checkedAgain = await this.inspect(resource.projectRelativePath, "file");
        if (!checkedAgain.ok) return checkedAgain;
        if (
          !openedStats.isFile() ||
          !sameFile(stats, openedStats) ||
          !sameFile(checkedAgain.value.stats, openedStats)
        ) {
          return projectFailure(
            "PROJECT_RESOURCE_CHANGED",
            resource.projectRelativePath,
            "The resource changed while it was being opened.",
          );
        }
        return { ok: true, value: await consume(handle) };
      } finally {
        await handle.close();
      }
    } catch (error: unknown) {
      return filesystemFailure(error, resource.projectRelativePath);
    }
  }

  public async readFile(projectRelativePath: unknown): Promise<ProjectResult<Buffer>> {
    return this.withReadableFile(projectRelativePath, (handle) => handle.readFile());
  }

  /** Verify accessibility without reading or interpreting the active architecture's contents. */
  public async checkReadableFile(projectRelativePath: unknown): Promise<ProjectResult<void>> {
    return this.withReadableFile(projectRelativePath, () => Promise.resolve());
  }
}
