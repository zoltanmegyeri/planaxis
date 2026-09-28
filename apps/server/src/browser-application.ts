import { access, lstat, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

const BROWSER_BUILD_ROOT = fileURLToPath(new URL("../../web/dist/", import.meta.url));

async function checkBuildFile(root: string, relativePath: string): Promise<void> {
  const segments = relativePath.split("/");
  if (
    segments.some((segment) => !segment || segment === "." || segment === "..") ||
    relativePath.includes("\\")
  ) {
    throw new Error("Invalid browser build resource path.");
  }
  let filename = root;
  for (const [index, segment] of segments.entries()) {
    filename = path.join(filename, segment);
    const stats = await lstat(filename);
    if (index < segments.length - 1 ? !stats.isDirectory() : !stats.isFile() || stats.size === 0) {
      throw new Error(`Browser build resource is not a usable file: ${relativePath}`);
    }
  }
  await access(filename, constants.R_OK);
}

export async function registerBrowserApplication(
  application: FastifyInstance,
  root: string = BROWSER_BUILD_ROOT,
): Promise<void> {
  try {
    await checkBuildFile(root, "index.html");
    const entry = await readFile(path.join(root, "index.html"), "utf8");
    // Vite emits root-relative, quoted asset URLs in its generated entry document.
    const assets = [...entry.matchAll(/(?:src|href)="\/([^"?#]+)"/g)].map((match) => match[1]!);
    if (!assets.some((asset) => asset.startsWith("assets/") && asset.endsWith(".js"))) {
      throw new Error("The browser entry document has no built JavaScript entry.");
    }
    for (const asset of assets) await checkBuildFile(root, asset);
  } catch (cause: unknown) {
    throw new Error(
      "The production browser build is missing or unusable. Run pnpm start -- --project <path> to rebuild it, or use --api-only for Vite development.",
      { cause },
    );
  }

  await application.register(fastifyStatic, {
    root,
    index: false,
    dotfiles: "ignore",
    // API namespaces stay reserved even if a build contains a colliding filename.
    allowedPath: (pathname) =>
      pathname !== "/health" && pathname !== "/api" && !pathname.startsWith("/api/"),
  });
  application.get("/", async (_request, reply) => reply.sendFile("index.html"));
}
