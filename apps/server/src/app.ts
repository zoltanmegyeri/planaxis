import Fastify, { type FastifyInstance } from "fastify";

import type { ProjectContext } from "./project/load-project.js";
import { registerProjectResourceRoutes } from "./project-resource-routes.js";
import { registerProjectRoutes } from "./project-routes.js";

export function buildApplication(project: ProjectContext): FastifyInstance {
  const application = Fastify({ logger: { level: "error" } });

  application.get("/health", async () => ({ status: "ok" }));
  registerProjectRoutes(application, project);
  registerProjectResourceRoutes(application, project);

  return application;
}
