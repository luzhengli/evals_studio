// Agent Skills spec alignment: SkillDef validation, allowed-tools grading,
// negative-trigger optimizer patches.

import { describe, expect, test } from "bun:test";
import { checkToolUsage, validateSkillDef } from "../src/eval/skillSpec.ts";
import { parseSkill } from "../src/eval/runner.ts";
import { proposeSkillPatch } from "../src/optimize/optimizer.ts";
import { buildSystemPrompt } from "../src/engines/openaiCompat.ts";
import type { SkillDef, TraceStep } from "../src/core/types.ts";

const skill = (over: Partial<SkillDef> = {}): SkillDef => ({
  name: "create-jira-ticket",
  description: "Files tracker tickets. Use when the user reports a bug to record.",
  triggerDescription: "user asks to file a ticket",
  instructions: "extract fields, call jira_create",
  tools: ["jira_create"],
  ...over,
});

const toolStep = (name: string): TraceStep => ({
  index: 0,
  type: "tool-call",
  name,
  input: "{}",
  output: "ok",
  durationMs: 1,
});

describe("validateSkillDef (agentskills.io frontmatter rules)", () => {
  test("conformant skill has no issues", () => {
    expect(validateSkillDef(skill())).toEqual([]);
  });

  test("name constraints: case, hyphens, length", () => {
    expect(validateSkillDef(skill({ name: "Bad-Name" }))[0]).toContain("lowercase");
    expect(validateSkillDef(skill({ name: "-lead" }))[0]).toContain("lowercase");
    expect(validateSkillDef(skill({ name: "a--b" }))[0]).toContain("lowercase");
    expect(validateSkillDef(skill({ name: "x".repeat(65) }))[0]).toContain("1-64");
  });

  test("description constraints", () => {
    expect(validateSkillDef(skill({ description: "y".repeat(1025) }))[0]).toContain("1024");
    const noDesc = validateSkillDef(skill({ description: undefined, triggerDescription: "" }));
    expect(noDesc.some((i) => i.includes("what the skill does"))).toBe(true);
  });

  test("compatibility length bound", () => {
    expect(validateSkillDef(skill({ compatibility: "z".repeat(501) }))[0]).toContain("500");
  });
});

describe("allowed-tools boundary", () => {
  test("calls within the declared list pass", () => {
    const c = checkToolUsage(skill(), "create-jira-ticket", [toolStep("jira_create")]);
    expect(c.pass).toBe(true);
  });

  test("calls outside the list are violations", () => {
    const c = checkToolUsage(skill(), "create-jira-ticket", [toolStep("jira_create"), toolStep("send_email")]);
    expect(c.pass).toBe(false);
    expect(c.violations).toEqual(["send_email"]);
  });

  test("no boundary when the skill was not selected or declares no tools", () => {
    expect(checkToolUsage(skill(), null, [toolStep("send_email")]).pass).toBe(true);
    expect(checkToolUsage(skill({ tools: [] }), "create-jira-ticket", [toolStep("x")]).pass).toBe(true);
  });
});

describe("extended SkillDef round-trip and prompt hosting", () => {
  test("parseSkill preserves spec fields", () => {
    const s = skill({ negativeTriggers: ["question about the board"], compatibility: "needs jira" });
    const parsed = parseSkill(JSON.stringify(s));
    expect(parsed.description).toBe(s.description);
    expect(parsed.negativeTriggers).toEqual(["question about the board"]);
    expect(parsed.compatibility).toBe("needs jira");
  });

  test("system prompt exposes description, negative triggers and allowed tools", () => {
    const p = buildSystemPrompt({
      sample: { input: "x" } as any,
      targetType: "skill",
      promptText: "base",
      skills: [skill({ negativeTriggers: ["board questions"] })],
      attempt: 1,
    });
    expect(p).toContain("Files tracker tickets");
    expect(p).toContain("do NOT use when: board questions");
    expect(p).toContain("allowed tools: jira_create");
  });
});

describe("optimizer negative-trigger patches", () => {
  test("selection failures + false-activation probes become negativeTriggers", () => {
    const base = {
      id: "v1",
      targetId: "t",
      version: 1,
      content: JSON.stringify(skill()),
      parentVersionId: null,
      changelog: "",
      origin: "manual" as const,
      createdAt: 0,
    };
    const attr = {
      id: "a1",
      runId: "r",
      experimentId: "e",
      sampleId: "s",
      rootCause: "wrong-skill-selected" as const,
      counterfactuals: [],
      traceStepIndex: null,
      fixLayer: "skill" as const,
      recommendation: "",
      createdAt: 0,
    };
    const patch = proposeSkillPatch(base, [attr], {
      negativeExamples: ["What does the PROJ board show about velocity?"],
    });
    const patched = parseSkill(patch.proposedContent);
    expect(patched.negativeTriggers?.some((t) => t.includes("PROJ board"))).toBe(true);
    expect(patch.rationale).toContain("negative-trigger");
  });
});
