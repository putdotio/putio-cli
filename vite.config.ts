import { correctness, strict } from "@effect/tsgo/oxlint-presets";
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

const agentToolingIgnores = [
  ".agent/**",
  ".agents/**",
  ".claude/**",
  ".codex/**",
  ".continue/**",
  ".cursor/**",
  ".gemini/**",
  ".opencode/**",
  ".pi/**",
  ".roo/**",
  ".windsurf/**",
  "tools/oxlint/anti-slop/**",
];

export default defineConfig({
  fmt: {
    ignorePatterns: agentToolingIgnores,
  },
  lint: {
    extends: [correctness, strict],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    ignorePatterns: agentToolingIgnores,
    jsPlugins: [
      { name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" },
      { name: "anti-slop-effect", specifier: "./tools/oxlint/anti-slop/effect/index.ts" },
      { name: "uinaf", specifier: "@uinaf/oxlint-plugin-no-comments" },
    ],
    overrides: [
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
      "effecttsgo/lazy-effect": "off",
      "oxc/no-accumulating-spread": "error",
      "anti-slop/no-array-filter-map": "error",
      "anti-slop/no-reduce-accumulator-copy": "error",
      "anti-slop/no-chained-type-assertions": "error",
      "anti-slop/no-conditional-empty-object-spread": "error",
      "anti-slop/no-known-value-widening": "error",
      "anti-slop/no-module-mocking": "error",
      "anti-slop/no-object-parameters": "error",
      "anti-slop/no-reflect-apply": "error",
      "anti-slop/no-reflect-get": "error",
      "anti-slop/no-runtime-typeof": "error",
      "anti-slop/no-shape-in-symbol-names": "error",
      "anti-slop/no-unknown-parameters": "error",
      "anti-slop/no-unknown-returns": "error",
      "anti-slop/no-unknown-type-aliases": "error",
      "anti-slop/no-unsafe-dictionary-type": "error",
      "anti-slop/no-widen-then-assert": "error",
      "anti-slop/require-readable-spacing": "error",
      "anti-slop/require-safety-comment-for-type-assertion": "error",
      "anti-slop-effect/no-manual-effect-error-tag": "error",
      "anti-slop-effect/no-manual-tag-comparison": "error",
      "anti-slop-effect/no-manual-tagged-construction": "error",
      "anti-slop-effect/no-service-constructor-imports": "error",
      "anti-slop-effect/prefer-effect-match": "error",
      "uinaf/no-comments": "error",
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
    exclude: ["**/node_modules/**", "**/.git/**", ".claude/worktrees/**", "scripts/**/*.test.ts"],
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
