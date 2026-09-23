import { validateDesignDescriptor } from "@planaxis/design";
import type { FastifyInstance, FastifyReply } from "fastify";

import type { ProjectContext } from "./project/load-project.js";
import { validateProjectResourcePath } from "./project/project-resource-path.js";
import type { ProjectError } from "./project/project-result.js";

function sendProjectError(reply: FastifyReply, error: ProjectError): FastifyReply {
  const status =
    error.code === "PROJECT_NOT_FOUND"
      ? 404
      : error.code === "PROJECT_ALREADY_EXISTS" || error.code === "PROJECT_RESOURCE_CHANGED"
        ? 409
        : error.code === "PROJECT_INACCESSIBLE" ||
            error.code === "PROJECT_SYMLINK" ||
            error.code === "PROJECT_OUTSIDE_ROOT"
          ? 403
          : 400;
  return reply.code(status).send({ error });
}

export function registerProjectResourceRoutes(
  application: FastifyInstance,
  project: ProjectContext,
): void {
  // Encapsulation keeps the active-architecture endpoint's existing error contract unchanged.
  void application.register(async (routes) => {
    // Preserve all JSON keys so the shared closed-schema validator rejects them explicitly.
    routes.addContentTypeParser(
      "application/json",
      { parseAs: "string" },
      routes.getDefaultJsonParser("ignore", "ignore"),
    );
    routes.setErrorHandler((error: unknown, request, reply) => {
      const code =
        typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
      if (code === "FST_ERR_CTP_INVALID_JSON_BODY" || code === "FST_ERR_CTP_EMPTY_JSON_BODY") {
        return reply.code(400).send({
          error: {
            stage: "json",
            code: "DESIGN_INVALID_JSON",
            location: "$",
            message: "Expected syntactically valid JSON representing one object.",
          },
        });
      }
      if (code === "FST_ERR_CTP_INVALID_MEDIA_TYPE") {
        return reply.code(415).send({ error: "Expected an application/json request body." });
      }
      if (code === "FST_ERR_CTP_BODY_TOO_LARGE") {
        return reply.code(413).send({ error: "The request body is too large." });
      }
      request.log.error({ err: error }, "Project resource operation failed.");
      return reply.code(500).send({ error: "Unable to complete the project resource operation." });
    });

    routes.get<{ Querystring: Record<string, unknown> }>(
      "/api/project/designs",
      async (request, reply) => {
        if (Object.keys(request.query).length !== 0) {
          return reply.code(400).send({ error: "This endpoint does not accept query parameters." });
        }
        const result = await project.filesystem.listFiles("designs", ".json");
        return result.ok ? { designs: result.value } : sendProjectError(reply, result.error);
      },
    );

    for (const [url, kind, methods] of [
      ["/api/project/design", "design", ["GET", "POST", "PUT"]],
      ["/api/project/architecture-resource", "architecture", ["GET"]],
      ["/api/project/material", "material", ["GET"]],
      ["/api/project/material-texture", "material-texture", ["GET"]],
    ] as const) {
      routes.route<{ Querystring: Record<string, unknown>; Body: unknown }>({
        method: [...methods],
        url,
        handler: async (request, reply) => {
          reply.header("X-Content-Type-Options", "nosniff");
          const parameters = new URLSearchParams(request.url.slice(request.url.indexOf("?") + 1));
          if (parameters.size !== 1 || !parameters.has("path")) {
            return reply.code(400).send({ error: "Expected exactly one path query parameter." });
          }
          const path = validateProjectResourcePath(parameters.get("path"), kind);
          if (!path.ok) return sendProjectError(reply, path.error);
          if (request.method === "GET" || request.method === "HEAD") {
            const result = await project.filesystem.readFile(path.value);
            return result.ok
              ? reply.type("application/octet-stream").send(result.value)
              : sendProjectError(reply, result.error);
          }
          const validated = validateDesignDescriptor(request.body, path.value);
          if (!validated.ok) return reply.code(400).send({ error: validated.error });
          const result = await project.filesystem.writeDesignFile(
            validated.value.path,
            `${JSON.stringify(validated.value.document, null, 2)}\n`,
            request.method === "POST" ? "create" : "update",
          );
          if (!result.ok) return sendProjectError(reply, result.error);
          return request.method === "POST"
            ? reply.code(201).send({ path: validated.value.path })
            : reply.code(204).send();
        },
      });
    }
  });
}
