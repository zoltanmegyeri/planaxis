import Fastify, { type FastifyInstance } from "fastify";

import { registerBrowserApplication } from "./browser-application.js";
import type { ProjectContext } from "./project/load-project.js";
import { registerProjectResourceRoutes } from "./project-resource-routes.js";
import { registerProjectRoutes } from "./project-routes.js";

export interface ApplicationOptions {
  readonly apiOnly?: boolean;
  readonly browserBuildRoot?: string;
}

export function buildApplication(
  project: ProjectContext,
  options: ApplicationOptions = {},
): FastifyInstance {
  const application = Fastify({ logger: { level: "error" } });

  application.get("/health", async () => ({ status: "ok" }));
  registerProjectRoutes(application, project);
  registerProjectResourceRoutes(application, project);

  if (!options.apiOnly) {
    application.register(async (instance) => {
      await registerBrowserApplication(instance, options.browserBuildRoot);
    });
  }

  return application;
}
