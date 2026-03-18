import { Schema } from "effect";

import type { CliOutputContract, CommandDescriptor } from "./cli-contract.js";

const AgentDxCategoryNameSchema = Schema.Literal(
  "machineReadableOutput",
  "rawPayloadInput",
  "schemaIntrospection",
  "contextWindowDiscipline",
  "inputHardening",
  "safetyRails",
  "agentKnowledgePackaging",
);

export type AgentDxCategoryName = Schema.Schema.Type<typeof AgentDxCategoryNameSchema>;

export const AgentDxDimensionSchema = Schema.Struct({
  maxScore: Schema.Literal(3),
  name: AgentDxCategoryNameSchema,
  score: Schema.Number,
  summary: Schema.String,
});

export type AgentDxDimension = Schema.Schema.Type<typeof AgentDxDimensionSchema>;

export const AgentDxScorecardSchema = Schema.Struct({
  dimensions: Schema.Array(AgentDxDimensionSchema),
  maxScore: Schema.Literal(21),
  provenance: Schema.Literal("metadata-derived"),
  summary: Schema.String,
  totalScore: Schema.Number,
});

export type AgentDxScorecard = Schema.Schema.Type<typeof AgentDxScorecardSchema>;

const commandHasFlag = (command: CommandDescriptor, flagName: string) =>
  command.input.flags.some((flag) => flag.name === flagName);

const cursorReadCommands = ["files list", "files search", "search", "transfers list"] as const;
const streamingReadCommands = [...cursorReadCommands, "transfers watch"] as const;

export const scoreAgentDx = (input: {
  readonly commands: ReadonlyArray<CommandDescriptor>;
  readonly hasConsumerSkill: boolean;
  readonly output: CliOutputContract;
}): AgentDxScorecard => {
  const writeCommands = input.commands.filter((command) => command.kind === "write");
  const readCommands = input.commands.filter((command) => command.kind === "read");

  const dimensions: ReadonlyArray<AgentDxDimension> = [
    {
      maxScore: 3,
      name: "machineReadableOutput",
      score:
        input.output.defaultNonInteractive === "json" &&
        input.output.supported.includes("json") &&
        input.output.supported.includes("ndjson")
          ? 3
          : input.output.supported.includes("json")
            ? 2
            : 1,
      summary:
        "Structured JSON is the non-interactive default, and NDJSON is available for streaming read flows.",
    },
    {
      maxScore: 3,
      name: "rawPayloadInput",
      score:
        writeCommands.length > 0 &&
        writeCommands.every(
          (command) => command.capabilities.rawJsonInput && command.input.json !== undefined,
        )
          ? 3
          : writeCommands.some((command) => command.capabilities.rawJsonInput)
            ? 2
            : 0,
      summary:
        "Every mutating command accepts raw --json input and advertises its payload contract in describe.",
    },
    {
      maxScore: 3,
      name: "schemaIntrospection",
      score: input.commands.every(
        (command) =>
          command.purpose.length > 0 &&
          Array.isArray(command.input.flags) &&
          (!command.capabilities.rawJsonInput || command.input.json !== undefined),
      )
        ? 3
        : 2,
      summary:
        "Describe exposes command purpose, flags, defaults, choices, capabilities, and raw JSON shapes.",
    },
    {
      maxScore: 3,
      name: "contextWindowDiscipline",
      score:
        readCommands.every((command) => command.capabilities.fieldSelection) &&
        cursorReadCommands.every((commandName) => {
          const command = input.commands.find((candidate) => candidate.command === commandName);

          return (
            command !== undefined &&
            command.capabilities.streaming &&
            commandHasFlag(command, "page-all")
          );
        }) &&
        streamingReadCommands.every((commandName) => {
          const command = input.commands.find((candidate) => candidate.command === commandName);

          return command !== undefined && command.capabilities.streaming;
        })
          ? 3
          : 2,
      summary:
        "Read commands support field filtering broadly, and cursor-backed reads plus watch flows expose streaming-friendly output.",
    },
    {
      maxScore: 3,
      name: "inputHardening",
      score:
        input.commands.some((command) =>
          command.input.flags.some(
            (flag) => flag.name === "fields" && flag.description?.includes("rejects") === true,
          ),
        ) &&
        writeCommands.some(
          (command) => command.input.json?.kind === "object" && command.input.json.rules,
        )
          ? 2
          : 1,
      summary:
        "The CLI rejects malformed selectors and unsafe identifier-like inputs before API calls, though there is still room to deepen the boundary model.",
    },
    {
      maxScore: 3,
      name: "safetyRails",
      score: writeCommands.every((command) => command.capabilities.dryRun) ? 2 : 1,
      summary:
        "Mutating commands offer dry-run planning across the surface, but the CLI does not yet add stronger confirmation or policy layers beyond that.",
    },
    {
      maxScore: 3,
      name: "agentKnowledgePackaging",
      score: input.hasConsumerSkill ? 2 : 0,
      summary:
        "The repo ships a dedicated consumer skill with progressive disclosure references, even though it is still a single skill rather than a broader skill library.",
    },
  ];

  const totalScore = dimensions.reduce((total, dimension) => total + dimension.score, 0);

  return {
    dimensions: [...dimensions],
    maxScore: 21,
    provenance: "metadata-derived",
    summary:
      "This score is derived from described command metadata and documented agent surfaces, not from a full runtime conformance audit.",
    totalScore,
  };
};
