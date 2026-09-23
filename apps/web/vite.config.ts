import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "^/api/project(?:/(?:architecture|architecture-resource|designs|design|material|material-texture))?(?:\\?.*)?$":
        "http://127.0.0.1:3000",
    },
  },
  test: { environment: "happy-dom", include: ["test/**/*.test.{ts,tsx}"] },
});
