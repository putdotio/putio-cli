import { describe, expect, it } from "vitest";

import { describeCli } from "./metadata.js";

describe("scoreAgentDx", () => {
  it("reports an agent-first scorecard in describe metadata", () => {
    const metadata = describeCli();

    expect(metadata.agentDx.maxScore).toBe(21);
    expect(metadata.agentDx.totalScore).toBeGreaterThanOrEqual(17);
    expect(metadata.agentDx.dimensions).toEqual([
      expect.objectContaining({
        name: "machineReadableOutput",
        score: 3,
      }),
      expect.objectContaining({
        name: "rawPayloadInput",
        score: 3,
      }),
      expect.objectContaining({
        name: "schemaIntrospection",
        score: 3,
      }),
      expect.objectContaining({
        name: "contextWindowDiscipline",
        score: 3,
      }),
      expect.objectContaining({
        name: "inputHardening",
        score: 2,
      }),
      expect.objectContaining({
        name: "safetyRails",
        score: 2,
      }),
      expect.objectContaining({
        name: "agentKnowledgePackaging",
        score: 2,
      }),
    ]);
  });
});
