import { runApartmentSvgValidationCli } from "./run-validation-cli.js";

try {
  process.exitCode = await runApartmentSvgValidationCli(process.argv.slice(2));
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Unexpected CLI failure: ${message}\n`);
  process.exitCode = 1;
}
