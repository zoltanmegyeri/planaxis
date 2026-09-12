import Fastify, { type FastifyInstance } from "fastify";

import type { ProjectContext } from "./project/load-project.js";
import { registerProjectRoutes } from "./project-routes.js";

export function buildApplication(project: ProjectContext): FastifyInstance {
  const application = Fastify();

  application.get("/health", async () => ({ status: "ok" }));
  registerProjectRoutes(application, project);

  return application;
}
