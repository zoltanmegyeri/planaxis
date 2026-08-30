import { buildApplication } from "./app.js";

const application = buildApplication();

try {
  await application.listen({ host: "0.0.0.0", port: 3000 });
} catch (error: unknown) {
  application.log.error(error);
  process.exitCode = 1;
}
