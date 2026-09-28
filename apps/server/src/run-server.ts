import { buildApplication } from "./app.js";
import { loadProject } from "./project/load-project.js";
import { parseServerArguments } from "./server-arguments.js";
import { startServer } from "./start-server.js";

export async function runServer(args: readonly string[]): Promise<0 | 1> {
  const invocation = parseServerArguments(args);
  if (!invocation.ok) {
    console.error(invocation.message);
    return 1;
  }

  try {
    const project = await loadProject(invocation.projectRoot);
    if (!project.ok) {
      const { code, location, message } = project.error;
      console.error(`Failed to load the PlanAxis project: ${code} (${location}): ${message}`);
      return 1;
    }

    const application = buildApplication(project.value, { apiOnly: invocation.apiOnly });
    const exitCode = await startServer(application);
    if (exitCode !== 0) await application.close();
    else if (!invocation.apiOnly) console.log("PlanAxis is running at http://127.0.0.1:3000/");
    return exitCode;
  } catch (error: unknown) {
    console.error("Failed to prepare the PlanAxis server.", error);
    return 1;
  }
}
