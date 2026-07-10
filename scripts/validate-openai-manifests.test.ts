import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import {
  characterCount,
  extractDefaultPrompt,
  MAX_DEFAULT_PROMPT_LENGTH,
  validateOpenAiManifests,
} from "./validate-openai-manifests.ts";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const path of temporaryDirectories.splice(0)) {
    rmSync(path, { force: true, recursive: true });
  }
});

function createManifest(name: string, prompt: string): string {
  const root = mkdtempSync(join(tmpdir(), "putio-openai-manifests-"));
  temporaryDirectories.push(root);
  const agentsDir = join(root, "nested", name, "agents");
  mkdirSync(agentsDir, { recursive: true });
  writeFileSync(
    join(agentsDir, "openai.yaml"),
    `interface:\n  default_prompt: ${JSON.stringify(prompt)}\n`,
  );
  return root;
}

test("parses YAML literal prompts", () => {
  assert.equal(
    extractDefaultPrompt("interface:\n  default_prompt: |-\n    first\n    second\n"),
    "first\nsecond",
  );
});

test("accepts Unicode prompts at the character limit", () => {
  const prompt = "🦞".repeat(MAX_DEFAULT_PROMPT_LENGTH);
  assert.equal(characterCount(prompt), MAX_DEFAULT_PROMPT_LENGTH);
  assert.deepEqual(validateOpenAiManifests(createManifest("boundary", prompt)), []);
});

test("finds nested prompts over the character limit", () => {
  const root = createManifest("too-long", "x".repeat(MAX_DEFAULT_PROMPT_LENGTH + 1));
  assert.deepEqual(validateOpenAiManifests(root), [
    {
      kind: "over-limit",
      length: MAX_DEFAULT_PROMPT_LENGTH + 1,
      path: "nested/too-long/agents/openai.yaml",
    },
  ]);
});

test("rejects non-string default prompts", () => {
  const root = createManifest("invalid", "valid");
  writeFileSync(
    join(root, "nested", "invalid", "agents", "openai.yaml"),
    "interface:\n  default_prompt: [not, a, string]\n",
  );
  assert.deepEqual(validateOpenAiManifests(root), [
    {
      kind: "invalid-manifest",
      diagnostic: "interface.default_prompt must be a string",
      path: "nested/invalid/agents/openai.yaml",
    },
  ]);
});
