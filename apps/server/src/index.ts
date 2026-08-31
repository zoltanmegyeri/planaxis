import { buildApplication } from "./app.js";
import { startServer } from "./start-server.js";

const application = buildApplication();
const exitCode = await startServer(application, {
  host: "0.0.0.0",
  port: 3000,
});

if (exitCode !== 0) {
  process.exitCode = exitCode;
}
