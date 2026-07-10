import { defineConfig } from "vite-plus";

type CoverageConfig = {
  readonly exclude: Array<string>;
  readonly include: Array<string>;
  readonly provider: "v8";
  readonly reporter: Array<"text" | "lcov">;
};

const coverageConfig: CoverageConfig = {
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
};

export default defineConfig({
  pack: {
    clean: true,
    dts: false,
    entry: {
      index: "src/index.ts",
      bin: "src/bin.ts",
    },
    exports: {
      bin: {
        putio: "src/bin.ts",
      },
    },
  },
  staged: {
    "*.{js,ts,tsx,mjs,cjs,mts,cts}": "vp check --fix",
  },
  test: {
    exclude: [".repos/**", "scripts/**/*.test.ts"],
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
