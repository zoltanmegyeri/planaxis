import type { FastifyInstance } from "fastify";

import type { ProjectContext } from "./project/load-project.js";

export function registerProjectRoutes(application: FastifyInstance, project: ProjectContext): void {
  application.get("/api/project", async () => ({
    schema: project.manifest.schema,
    name: project.manifest.name,
    architecture: { active: project.manifest.architecture.active },
  }));

  application.get<{ Querystring: Record<string, unknown> }>(
    "/api/project/architecture",
    async (request, reply) => {
      reply.header("X-Content-Type-Options", "nosniff");
      if (Object.keys(request.query).length > 0) {
        return reply.code(400).send({ error: "This endpoint does not accept query parameters." });
      }

      try {
        const resource = await project.filesystem.readFile(project.activeArchitecturePath);
        if (resource.ok) {
          return reply.type("application/octet-stream").send(resource.value);
        }
        request.log.error({ projectError: resource.error }, "Failed to read active architecture.");
      } catch (error: unknown) {
        request.log.error({ err: error }, "Failed to read active architecture.");
      }

      return reply.code(500).send({ error: "Unable to read the active architecture." });
    },
  );
}
