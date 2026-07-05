// Agent Skills spec (agentskills.io) alignment helpers.
// validateSkillDef mirrors the SKILL.md frontmatter constraints so skill
// targets can be authored/linted against the open format; checkToolUsage
// grades `tools` as the spec's allowed-tools boundary.

import type { SkillDef, TraceStep } from "../core/types.ts";

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Spec violations for a SkillDef; empty array = spec-conformant. */
export function validateSkillDef(skill: SkillDef): string[] {
  const issues: string[] = [];
  if (!skill.name || skill.name.length > 64) issues.push("name: required, 1-64 characters");
  else if (!NAME_RE.test(skill.name))
    issues.push("name: lowercase letters/numbers/hyphens only; no leading/trailing/consecutive hyphens");
  const desc = skill.description ?? "";
  if (desc.length > 1024) issues.push("description: max 1024 characters");
  if (!desc.trim() && !skill.triggerDescription.trim())
    issues.push("description/triggerDescription: at least one must state what the skill does and when to use it");
  if (skill.compatibility != null && (skill.compatibility.length < 1 || skill.compatibility.length > 500))
    issues.push("compatibility: 1-500 characters when present");
  if (!skill.instructions.trim()) issues.push("instructions: required");
  return issues;
}

export interface ToolUsageCheck {
  pass: boolean;
  /** tools invoked that are outside the skill's allowed list */
  violations: string[];
  evidence: string;
}

/**
 * allowed-tools boundary: when a skill declares `tools` and was selected,
 * every tool call in the trace must come from that list.
 */
export function checkToolUsage(skill: SkillDef | null, selectedSkill: string | null, trace: TraceStep[]): ToolUsageCheck {
  const calls = trace.filter((s) => s.type === "tool-call").map((s) => s.name);
  if (!skill || selectedSkill !== skill.name || skill.tools.length === 0) {
    return { pass: true, violations: [], evidence: "no allowed-tools boundary to enforce" };
  }
  const allowed = new Set(skill.tools);
  const violations = [...new Set(calls.filter((c) => !allowed.has(c)))];
  return {
    pass: violations.length === 0,
    violations,
    evidence:
      violations.length === 0
        ? `all ${calls.length} tool call(s) within allowed-tools [${skill.tools.join(", ")}]`
        : `tool(s) outside allowed-tools: ${violations.join(", ")} (allowed: ${skill.tools.join(", ") || "none"})`,
  };
}
