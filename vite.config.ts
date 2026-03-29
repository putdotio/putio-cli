import { defineConfig } from "vite-plus";

const coverageConfig = {
  exclude: [
    "src/**/*.d.ts",
    "src/**/*.test.*",
    "src/**/*.spec.*",
    "src/test-support/**",
    "dist/**",
    "coverage/**",
  ],
  include: ["src/**/*.{ts,tsx}"],
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
  staged: {
    "*.{js,ts,tsx,mjs,cjs,mts,cts}": "vp check --fix",
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
