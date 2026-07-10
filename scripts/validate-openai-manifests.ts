#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

export const MAX_DEFAULT_PROMPT_LENGTH = 1_024;

export type InterfaceIssue =
  | { readonly kind: "over-limit"; readonly length: number; readonly path: string }
  | { readonly kind: "invalid-manifest"; readonly diagnostic: string; readonly path: string };

export class InvalidManifestError extends Error {}

export function characterCount(value: string): number {
  return Array.from(value).length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function extractDefaultPrompt(source: string): string | undefined {
  let parsed: unknown;
  try {
    parsed = parse(source);
  } catch (error) {
    const diagnostic = error instanceof Error ? error.message : String(error);
    throw new InvalidManifestError(`invalid YAML: ${diagnostic}`);
  }

  if (!isRecord(parsed) || !isRecord(parsed.interface)) {
    return undefined;
  }

  const prompt = parsed.interface.default_prompt;
  if (prompt === undefined) {
    return undefined;
  }
  if (typeof prompt !== "string") {
    throw new InvalidManifestError("interface.default_prompt must be a string");
  }
  return prompt;
}

function findManifestPaths(root: string): string[] {
  const manifests: string[] = [];

  function visit(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if ([".git", ".repos", "coverage", "dist", "node_modules"].includes(entry.name)) {
        continue;
      }
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(path);
      } else if (entry.name === "openai.yaml" && basename(dirname(path)) === "agents") {
        manifests.push(path);
      }
    }
  }

  visit(root);
  return manifests.sort();
}

export function validateOpenAiManifests(root: string): InterfaceIssue[] {
  const issues: InterfaceIssue[] = [];

  for (const manifestPath of findManifestPaths(root)) {
    const issuePath = relative(root, manifestPath);
    try {
      const prompt = extractDefaultPrompt(readFileSync(manifestPath, "utf8"));
      const length = prompt === undefined ? 0 : characterCount(prompt);
      if (length > MAX_DEFAULT_PROMPT_LENGTH) {
        issues.push({ kind: "over-limit", length, path: issuePath });
      }
    } catch (error) {
      if (!(error instanceof InvalidManifestError)) {
        throw error;
      }
      issues.push({ kind: "invalid-manifest", diagnostic: error.message, path: issuePath });
    }
  }

  return issues;
}

export function main(args: readonly string[]): number {
  if (args.length > 1) {
    process.stderr.write("Usage: node scripts/validate-openai-manifests.ts [root]\n");
    return 2;
  }

  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const root = resolve(args[0] ?? repoRoot);
  if (!existsSync(root)) {
    process.stderr.write(`Skill manifest root does not exist: ${root}\n`);
    return 2;
  }

  const issues = validateOpenAiManifests(root);
  if (issues.length === 0) {
    process.stdout.write("OpenAI skill interface prompts are within the 1024-character limit.\n");
    return 0;
  }

  for (const issue of issues) {
    if (issue.kind === "invalid-manifest") {
      process.stderr.write(`${issue.path}: ${issue.diagnostic}.\n`);
    } else {
      process.stderr.write(
        `${issue.path}: interface.default_prompt is ${issue.length} characters; maximum is ${MAX_DEFAULT_PROMPT_LENGTH}. ` +
          "Shorten the launch prompt and keep detailed workflow in SKILL.md.\n",
      );
    }
  }
  return 1;
}

const entrypoint = process.argv[1];
if (entrypoint !== undefined && resolve(entrypoint) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
