export type ServerArgumentsResult =
  | { readonly ok: true; readonly projectRoot: string; readonly apiOnly: boolean }
  | { readonly ok: false; readonly message: string };

export function parseServerArguments(args: readonly string[]): ServerArgumentsResult {
  let projectRoot: string | undefined;
  let apiOnly = false;
  // pnpm forwards the optional command/argument separator to the root start script.
  for (let index = args[0] === "--" ? 1 : 0; index < args.length; index += 1) {
    if (args[index] === "--api-only") {
      if (apiOnly) return { ok: false, message: "Specify --api-only at most once." };
      apiOnly = true;
      continue;
    }
    if (args[index] !== "--project") {
      return { ok: false, message: "Unsupported argument. Usage: --project <path> [--api-only]" };
    }
    if (projectRoot !== undefined) {
      return { ok: false, message: "Specify --project exactly once." };
    }
    const value = args[index + 1];
    if (
      value === undefined ||
      value.length === 0 ||
      value.startsWith("-") ||
      value.includes("\0")
    ) {
      return { ok: false, message: "The --project option requires a path value." };
    }
    projectRoot = value;
    index += 1;
  }
  return projectRoot === undefined
    ? { ok: false, message: "A project root is required. Usage: --project <path>" }
    : { ok: true, projectRoot, apiOnly };
}
