import { runServer } from "./run-server.js";

process.exitCode = await runServer(process.argv.slice(2));
