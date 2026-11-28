import { correctness, strict } from "@effect/tsgo/oxlint-presets";
import uinaf, { env, ignorePatterns, options } from "@uinaf/oxlint-config/effect/vite-plus";
import { defineConfig } from "vite-plus";

import { resolveCrashReportingBuildDefines } from "./src/internal/crash-reporting-config.ts";

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
  fmt: {
    ignorePatterns,
  },
  lint: {
    env,
    extends: [uinaf, correctness, strict],
    ignorePatterns,
    options: {
      ...options,
      typeCheck: true,
    },
    overrides: [
      {
        files: ["scripts/smoke-packed-install.mts"],
        rules: {
          "typescript/only-throw-error": "off",
        },
      },
      {
        files: [
          "**/*.test.ts",
          "src/test-support/**",
          "src/bin.ts",
          "src/sea.ts",
          "src/cli.ts",
          "src/commands/sdk.ts",
          "src/internal/main.ts",
          "src/internal/sdk-operations.ts",
        ],
        rules: {
          "effecttsgo/any-unknown-in-error-context": "off",
        },
      },
      {
        files: ["src/internal/sdk-operations.ts"],
        rules: {
          "effecttsgo/unsafe-effect-type-assertion": "off",
        },
      },
      {
        files: ["src/internal/state.ts"],
        rules: {
          "effecttsgo/leaking-requirements": "off",
        },
      },
    ],
    rules: {
      "effecttsgo/any-unknown-in-error-context": "error",
      "effecttsgo/lazy-effect": "off",
      "effecttsgo/unsafe-effect-type-assertion": "error",
      "@nkzw/no-instanceof": "off",
      "import/consistent-type-specifier-style": "off",
      "import/no-namespace": "off",
      "no-console": "off",
      "no-promise-executor-return": "off",
      "prefer-object-has-own": "off",
      "typescript/consistent-type-imports": "off",
      "typescript/no-unnecessary-type-assertion": "off",
      "typescript/no-unsafe-argument": "off",
      "typescript/no-unsafe-assignment": "off",
      "typescript/no-unsafe-member-access": "off",
      "typescript/no-unsafe-return": "off",
      "typescript/no-unsafe-type-assertion": "off",
      "unicorn/consistent-function-scoping": "off",
      "unicorn/no-hex-escape": "off",
      "unicorn/no-useless-promise-resolve-reject": "off",
      "unicorn/prefer-number-properties": "off",
      "unicorn/prefer-string-raw": "off",
      "unicorn/prefer-string-replace-all": "off",
    },
  },
  pack: {
    clean: true,
    define: resolveCrashReportingBuildDefines(process.env),
    deps: {
      alwaysBundle: ["@putdotio/sdk"],
      onlyBundle: ["@putdotio/sdk"],
    },
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
    "*.{js,ts,tsx,mjs,cjs,mts,cts}": "effect-tsgo vp check --fix",
  },
  test: {
    exclude: [
      "**/node_modules/**",
      "**/.git/**",
      ".claude/worktrees/**",
      ".worktrees/**",
      "scripts/**/*.test.ts",
    ],
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
