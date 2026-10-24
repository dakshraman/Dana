import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

const root = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      "@": root,
      // `server-only` is a bundler marker that throws when loaded outside a
      // React Server Components bundle. Unit tests import server modules
      // directly, so resolve it to an empty module.
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url)
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
})
