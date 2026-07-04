// Deterministic checkers — used whenever an oracle exists (answer match,
// code execution, final-state comparison, trajectory match).

import type { ExpectedTrajectoryStep, TraceStep } from "../core/types.ts";

export interface CheckOutcome {
  pass: boolean;
  score: number;
  evidence: string;
}

/**
 * Ground-truth check with prefix-selectable strategy:
 *   "exact:<v>"  exact string match (trimmed)
 *   "regex:<v>"  regex test
 *   "json:<v>"   deep JSON equality
 *   "code:<v>"   v is a JS expression evaluated with `output` in scope, must return truthy
 *   otherwise    case-insensitive containment
 */
export function checkGroundTruth(output: string, groundTruth: string): CheckOutcome {
  const [strategy, value] = splitStrategy(groundTruth);
  switch (strategy) {
    case "exact": {
      const pass = output.trim() === value.trim();
      return { pass, score: pass ? 1 : 0, evidence: pass ? "exact match" : `expected exact "${value}", got "${clip(output)}"` };
    }
    case "regex": {
      let re: RegExp;
      try {
        re = new RegExp(value, "ms");
      } catch (e) {
        return { pass: false, score: 0, evidence: `invalid regex: ${e}` };
      }
      const pass = re.test(output);
      return { pass, score: pass ? 1 : 0, evidence: pass ? `matched /${value}/` : `no match for /${value}/ in "${clip(output)}"` };
    }
    case "json": {
      try {
        const expected = JSON.parse(value);
        const actual = JSON.parse(extractJson(output));
        const pass = deepEqual(expected, actual);
        return { pass, score: pass ? 1 : 0, evidence: pass ? "JSON equal" : `JSON mismatch: expected ${value}, got ${clip(output)}` };
      } catch (e) {
        return { pass: false, score: 0, evidence: `JSON parse failed: ${e}` };
      }
    }
    case "code": {
      try {
        const fn = new Function("output", `return (${value});`);
        const pass = Boolean(fn(output));
        return { pass, score: pass ? 1 : 0, evidence: pass ? `code check passed: ${value}` : `code check failed: ${value}` };
      } catch (e) {
        return { pass: false, score: 0, evidence: `code check threw: ${e}` };
      }
    }
    default: {
      const pass = output.toLowerCase().includes(groundTruth.toLowerCase());
      return { pass, score: pass ? 1 : 0, evidence: pass ? `contains "${groundTruth}"` : `missing "${groundTruth}" in "${clip(output)}"` };
    }
  }
}

function splitStrategy(gt: string): [string, string] {
  const m = gt.match(/^(exact|regex|json|code):([\s\S]*)$/);
  return m ? [m[1], m[2]] : ["contains", gt];
}

/**
 * Trajectory (process) check: expected actions must appear in order among the
 * trace's tool-call/routing steps. Optional steps may be skipped.
 * Partial credit = matched required steps / total required steps.
 */
export function checkTrajectory(expected: ExpectedTrajectoryStep[], trace: TraceStep[]): CheckOutcome {
  if (expected.length === 0) return { pass: true, score: 1, evidence: "no expected trajectory" };
  const actions = trace
    .filter((s) => s.type === "tool-call" || s.type === "routing" || s.type === "llm")
    .map((s) => (s.type === "routing" && s.skillSelected ? `skill:${s.skillSelected}` : s.type === "llm" ? "respond" : s.name));

  let cursor = 0;
  let matchedRequired = 0;
  let totalRequired = 0;
  const missed: string[] = [];
  for (const step of expected) {
    const isRequired = !step.optional;
    if (isRequired) totalRequired++;
    const found = actions.indexOf(step.action, cursor);
    if (found >= 0) {
      cursor = found + 1;
      if (isRequired) matchedRequired++;
    } else if (isRequired) {
      missed.push(step.action);
    }
  }
  const score = totalRequired === 0 ? 1 : matchedRequired / totalRequired;
  const pass = missed.length === 0;
  return {
    pass,
    score,
    evidence: pass
      ? `trajectory matched (${expected.length} steps)`
      : `missing steps in order: ${missed.join(", ")} (saw: ${actions.join(" → ")})`,
  };
}

/** Final-state comparison against sandbox state (subset match on files/kv). */
export function checkFinalState(
  expected: Record<string, string>,
  actual: { files: Record<string, string>; kv: Record<string, string> }
): CheckOutcome {
  const misses: string[] = [];
  for (const [key, want] of Object.entries(expected)) {
    const got = actual.files[key] ?? actual.kv[key];
    if (got !== want) misses.push(`${key}: expected "${want}", got "${got ?? "<absent>"}"`);
  }
  const pass = misses.length === 0;
  return { pass, score: pass ? 1 : 0, evidence: pass ? "final state matches" : misses.join("; ") };
}

function extractJson(s: string): string {
  const start = s.search(/[[{]/);
  if (start < 0) return s;
  return s.slice(start);
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (typeof a === "object") {
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => deepEqual((a as any)[k], (b as any)[k]));
  }
  return false;
}

function clip(s: string, n = 120): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
