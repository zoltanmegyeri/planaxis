import Fastify, { type FastifyInstance } from "fastify";

export function buildApplication(): FastifyInstance {
  const application = Fastify();

  application.get("/health", async () => ({ status: "ok" }));

  return application;
}
