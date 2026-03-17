import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite-plus";

const coverageConfig = {
  exclude: [
    "src/**/*.d.ts",
    "src/**/*.test.*",
    "src/**/*.spec.*",
    "src/test-support/**",
    "localized-error/**/*.test.*",
    "localized-error/**/*.spec.*",
    "dist/**",
    "coverage/**",
  ],
  include: ["src/**/*.{ts,tsx}", "localized-error/**/*.{ts,tsx}"],
  provider: "v8",
  reporter: ["text", "lcov"],
} as const;

export default defineConfig({
  pack: {
    clean: true,
    dts: false,
    entry: {
      index: "src/index.ts",
      bin: "src/bin.ts",
    },
    exports: true,
  },
  resolve: {
    alias: {
      "@putdotio/localized-error": fileURLToPath(
        new URL("./localized-error/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    coverage: {
      ...coverageConfig,
      exclude: [
        ...coverageConfig.exclude,
        "src/bin.ts",
        "src/index.ts",
        "src/internal/loader-service.ts",
        "src/internal/runtime.ts",
        "src/internal/sdk.ts",
      ],
    },
  },
});
