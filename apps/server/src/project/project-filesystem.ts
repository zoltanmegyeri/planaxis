import { randomUUID } from "node:crypto";
import { constants, type Stats } from "node:fs";
import {
  link,
  lstat,
  mkdir,
  open,
  readdir,
  realpath,
  rename,
  unlink,
  type FileHandle,
} from "node:fs/promises";
import path from "node:path";

import {
  OPTIONAL_PROJECT_DIRECTORIES,
  PROJECT_ARCHITECTURE_DIRECTORY,
  PROJECT_MANIFEST_FILENAME,
} from "./project-format-constants.js";
import { validateProjectRelativePath, type ProjectRelativePath } from "./project-path.js";
import { validateProjectResourcePath } from "./project-resource-path.js";
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
    case "EEXIST":
      return projectFailure("PROJECT_ALREADY_EXISTS", location, "The target already exists.");
    case "EISDIR":
      return projectFailure("PROJECT_NOT_REGULAR_FILE", location, "Expected a regular file.");
    case "EROFS":
      return projectFailure("PROJECT_INACCESSIBLE", location, "The filesystem is read-only.");
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

/** Owns resource access to one canonical physical root (Project Format 1.0 section 9). */
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

  private async inspectRoot(): Promise<ProjectResult<Stats>> {
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

      return { ok: true, value: rootStats };
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
      const root = await this.inspectRoot();
      if (!root.ok) return root;
      const rootStats = root.value;

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

  /** Enumerate accessible candidates without interpreting their contents or following links. */
  public async listFiles(directory: string, suffix: string): Promise<ProjectResult<string[]>> {
    const files: string[] = [];
    const visit = async (relative: string): Promise<ProjectResult<void>> => {
      const inspected = await this.inspect(relative, "directory");
      if (!inspected.ok) return inspected;
      try {
        const entries = await readdir(inspected.value.resource.absolutePath, {
          withFileTypes: true,
        });
        const checked = await this.inspect(relative, "directory");
        if (!checked.ok) return checked;
        if (!sameFile(inspected.value.stats, checked.value.stats)) {
          return projectFailure(
            "PROJECT_RESOURCE_CHANGED",
            relative,
            "The directory changed during discovery.",
          );
        }
        for (const entry of entries) {
          const child = `${relative}/${entry.name}`;
          // Unrepresentable host filenames cannot become portable resource references.
          if (!validateProjectRelativePath(child).ok || entry.isSymbolicLink()) continue;
          let result: ProjectResult<unknown>;
          if (entry.isDirectory()) {
            result = await visit(child);
          } else if (entry.isFile() && entry.name.endsWith(suffix)) {
            result = await this.checkReadableFile(child);
            if (result.ok) files.push(child);
          } else {
            continue;
          }
          // Disappearing, inaccessible and unsafe candidates are not accessible regular files.
          if (!result.ok && result.error.location === "projectRoot") return result;
        }
        return { ok: true, value: undefined };
      } catch (error: unknown) {
        return filesystemFailure(error, relative);
      }
    };
    const result = await visit(directory);
    if (!result.ok) {
      if (result.error.code === "PROJECT_NOT_FOUND" && result.error.location === directory) {
        return { ok: true, value: [] };
      }
      return result;
    }
    return { ok: true, value: files.sort() };
  }

  private async syncDirectory(relative?: string): Promise<void> {
    // Windows does not expose directory fsync through this portable Node.js API.
    if (process.platform === "win32") return;
    const inspected =
      relative === undefined ? await this.inspectRoot() : await this.inspect(relative, "directory");
    if (!inspected.ok)
      throw new Error("Unable to sync project directory.", { cause: inspected.error });
    const absolute = relative === undefined ? this.#root : path.resolve(this.#root, relative);
    const handle = await open(
      absolute,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    try {
      const expected = "stats" in inspected.value ? inspected.value.stats : inspected.value;
      if (!sameFile(expected, await handle.stat()))
        throw new Error("Project directory changed before sync.");
      await handle.sync();
    } catch (error: unknown) {
      if (
        typeof error !== "object" ||
        error === null ||
        !("code" in error) ||
        !["EINVAL", "ENOTSUP"].includes(String(error.code))
      )
        throw error;
    } finally {
      await handle.close();
    }
  }

  private async ensureDirectory(relative: string): Promise<ProjectResult<InspectedResource>> {
    const segments = relative.split("/");
    for (let index = 0; index < segments.length; index++) {
      const current = segments.slice(0, index + 1).join("/");
      const existing = await this.inspect(current, "directory");
      if (existing.ok) continue;
      if (existing.error.code !== "PROJECT_NOT_FOUND") return existing;
      const parent =
        index === 0
          ? await this.inspectRoot()
          : await this.inspect(segments.slice(0, index).join("/"), "directory");
      if (!parent.ok) return parent;
      const absolute = path.resolve(this.#root, ...segments.slice(0, index + 1));
      if (!isWithinProjectRoot(this.#root, absolute)) {
        return projectFailure(
          "PROJECT_OUTSIDE_ROOT",
          current,
          "The directory must remain inside the project root.",
        );
      }
      try {
        // Never use recursive mkdir: inspect each ordinary parent before creating its child.
        await mkdir(absolute);
      } catch (error: unknown) {
        const failure = filesystemFailure(error, current);
        if (failure.ok || failure.error.code !== "PROJECT_ALREADY_EXISTS") return failure;
      }
      const created = await this.inspect(current, "directory");
      if (!created.ok) return created;
      await this.syncDirectory(index === 0 ? undefined : segments.slice(0, index).join("/"));
    }
    return this.inspect(relative, "directory");
  }

  /** Publish a complete staged file; only explicit design persistence can write durable data. */
  public async writeDesignFile(
    input: unknown,
    bytes: string,
    mode: "create" | "update",
  ): Promise<ProjectResult<void>> {
    const validated = validateProjectResourcePath(input, "design");
    if (!validated.ok) return validated;
    const relative = validated.value;
    const parentPath = relative.slice(0, relative.lastIndexOf("/"));
    if (mode === "update") {
      const readable = await this.checkReadableFile(relative);
      if (!readable.ok) return readable;
    }
    const parent =
      mode === "create"
        ? await this.ensureDirectory(parentPath)
        : await this.inspect(parentPath, "directory");
    if (!parent.ok) return parent;
    const target = await this.inspect(relative, "file");
    if (mode === "create") {
      if (target.ok || (!target.ok && target.error.code === "PROJECT_NOT_REGULAR_FILE")) {
        return projectFailure("PROJECT_ALREADY_EXISTS", relative, "The target already exists.");
      }
      if (target.error.code !== "PROJECT_NOT_FOUND") return target;
    } else if (!target.ok) {
      return target;
    }
    const absolute = path.resolve(
      parent.value.resource.absolutePath,
      relative.slice(relative.lastIndexOf("/") + 1),
    );
    if (!isWithinProjectRoot(this.#root, absolute)) {
      return projectFailure(
        "PROJECT_OUTSIDE_ROOT",
        relative,
        "The file must remain inside the project root.",
      );
    }
    const temporaryPath = `${parentPath}/.planaxis-${randomUUID()}.tmp`;
    const temporaryAbsolute = path.resolve(
      parent.value.resource.absolutePath,
      temporaryPath.slice(temporaryPath.lastIndexOf("/") + 1),
    );
    let stagedStats: Stats | undefined;
    let published = false;
    try {
      const checkedParent = await this.inspect(parentPath, "directory");
      if (!checkedParent.ok) return checkedParent;
      if (!sameFile(parent.value.stats, checkedParent.value.stats)) {
        return projectFailure(
          "PROJECT_RESOURCE_CHANGED",
          relative,
          "The destination directory changed.",
        );
      }
      const handle = await open(
        temporaryAbsolute,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
        0o600,
      );
      try {
        stagedStats = await handle.stat();
        const staged = await this.inspect(temporaryPath, "file");
        if (!staged.ok) return staged;
        if (!sameFile(staged.value.stats, stagedStats)) {
          return projectFailure("PROJECT_RESOURCE_CHANGED", relative, "The staged file changed.");
        }
        await handle.writeFile(bytes, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      const staged = await this.inspect(temporaryPath, "file");
      if (!staged.ok) return staged;
      if (!sameFile(staged.value.stats, stagedStats)) {
        return projectFailure("PROJECT_RESOURCE_CHANGED", relative, "The staged file changed.");
      }
      if (mode === "create") {
        // Hard-link publication is atomic and refuses any existing directory entry.
        await link(temporaryAbsolute, absolute);
      } else {
        const current = await this.inspect(relative, "file");
        if (!current.ok) return current;
        if (!target.ok || !sameFile(target.value.stats, current.value.stats)) {
          return projectFailure(
            "PROJECT_RESOURCE_CHANGED",
            relative,
            "The destination file changed.",
          );
        }
        await rename(temporaryAbsolute, absolute);
        stagedStats = undefined;
      }
      published = true;
      return { ok: true, value: undefined };
    } catch (error: unknown) {
      return filesystemFailure(error, relative);
    } finally {
      if (stagedStats !== undefined) {
        // Cleanup must re-enter the boundary too; never unlink through a replaced parent.
        const staged = await this.inspect(temporaryPath, "file");
        if (staged.ok && sameFile(staged.value.stats, stagedStats)) {
          await unlink(staged.value.resource.absolutePath);
        }
      }
      if (published) await this.syncDirectory(parentPath);
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
