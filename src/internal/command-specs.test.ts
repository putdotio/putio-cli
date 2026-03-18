import { describe, expect, it } from "vite-plus/test";

import {
  decodeCommandSpecs,
  dryRunFlag,
  fieldsFlag,
  jsonFlag,
  type CommandSpec,
} from "./command-specs.js";

describe("decodeCommandSpecs", () => {
  it("rejects duplicate command names", () => {
    expect(() =>
      decodeCommandSpecs([
        {
          auth: { required: false },
          capabilities: {
            dryRun: false,
            fieldSelection: false,
            rawJsonInput: false,
            streaming: false,
          },
          command: "describe",
          input: { flags: [] },
          kind: "utility",
          purpose: "Describe the CLI.",
        },
        {
          auth: { required: false },
          capabilities: {
            dryRun: false,
            fieldSelection: false,
            rawJsonInput: false,
            streaming: false,
          },
          command: "describe",
          input: { flags: [] },
          kind: "utility",
          purpose: "Describe the CLI again.",
        },
      ]),
    ).toThrow("Duplicate CLI command metadata entry: describe");
  });

  it("rejects capability drift between dry-run and fields metadata", () => {
    const dryRunSpec = {
      auth: { required: true },
      capabilities: {
        dryRun: true,
        fieldSelection: false,
        rawJsonInput: false,
        streaming: false,
      },
      command: "files rename",
      input: { flags: [] },
      kind: "write",
      purpose: "Rename a file.",
    } satisfies CommandSpec;

    expect(() => decodeCommandSpecs([dryRunSpec])).toThrow(
      "advertises dry-run without a dry-run flag",
    );

    const fieldsSpec = {
      auth: { required: true },
      capabilities: {
        dryRun: false,
        fieldSelection: true,
        rawJsonInput: false,
        streaming: false,
      },
      command: "whoami",
      input: { flags: [] },
      kind: "read",
      purpose: "Show the current user.",
    } satisfies CommandSpec;

    expect(() => decodeCommandSpecs([fieldsSpec])).toThrow(
      "advertises field selection without a fields flag",
    );
  });

  it("rejects raw JSON metadata without a matching schema and flag", () => {
    const spec = {
      auth: { required: true },
      capabilities: {
        dryRun: true,
        fieldSelection: false,
        rawJsonInput: true,
        streaming: false,
      },
      command: "files mkdir",
      input: { flags: [dryRunFlag()] },
      kind: "write",
      purpose: "Create a folder.",
    } satisfies CommandSpec;

    expect(() => decodeCommandSpecs([spec])).toThrow(
      "advertises raw JSON input without a json flag",
    );

    expect(() =>
      decodeCommandSpecs([
        {
          ...spec,
          input: { flags: [dryRunFlag(), jsonFlag()] },
        },
      ]),
    ).toThrow("advertises raw JSON input without a JSON schema");
  });

  it("accepts a coherent command spec", () => {
    expect(() =>
      decodeCommandSpecs([
        {
          auth: { required: true },
          capabilities: {
            dryRun: false,
            fieldSelection: true,
            rawJsonInput: false,
            streaming: false,
          },
          command: "whoami",
          input: { flags: [fieldsFlag()] },
          kind: "read",
          purpose: "Show the current user.",
        },
      ]),
    ).not.toThrow();
  });
});
