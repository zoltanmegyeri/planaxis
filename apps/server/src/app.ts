import Fastify, { type FastifyInstance } from "fastify";

import { registerDesignRoutes } from "./design-routes.js";
import type { ProjectContext } from "./project/load-project.js";
import { registerProjectRoutes } from "./project-routes.js";

export function buildApplication(project: ProjectContext): FastifyInstance {
  const application = Fastify({ logger: { level: "error" } });

  application.get("/health", async () => ({ status: "ok" }));
  registerProjectRoutes(application, project);
  registerDesignRoutes(application, project);

  return application;
}
