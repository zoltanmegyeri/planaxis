export type ServerArgumentsResult =
  | { readonly ok: true; readonly projectRoot: string }
  | { readonly ok: false; readonly message: string };

export function parseServerArguments(args: readonly string[]): ServerArgumentsResult {
  let projectRoot: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== "--project") {
      return { ok: false, message: "Unsupported argument. Usage: --project <path>" };
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
    : { ok: true, projectRoot };
}
