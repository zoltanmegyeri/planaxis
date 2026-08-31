import type { FastifyInstance } from "fastify";

export interface ServerListenAddress {
  readonly host: string;
  readonly port: number;
}

function isAddressInUseError(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && "code" in error && error.code === "EADDRINUSE"
  );
}

export async function startServer(
  application: FastifyInstance,
  address: ServerListenAddress,
): Promise<0 | 1> {
  try {
    await application.listen(address);
    return 0;
  } catch (error: unknown) {
    if (isAddressInUseError(error)) {
      console.error(
        `Failed to start the PlanAxis server: port ${address.port} is already in use.`,
        error,
      );
    } else {
      console.error("Failed to start the PlanAxis server.", error);
    }

    return 1;
  }
}
