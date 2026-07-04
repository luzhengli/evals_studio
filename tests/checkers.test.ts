import { describe, expect, test } from "bun:test";
import { checkFinalState, checkGroundTruth, checkTrajectory, deepEqual } from "../src/eval/checkers.ts";
import type { TraceStep } from "../src/core/types.ts";

describe("checkGroundTruth", () => {
  test("contains (default)", () => {
    expect(checkGroundTruth("The answer is 42.", "42").pass).toBe(true);
    expect(checkGroundTruth("nope", "42").pass).toBe(false);
  });

  test("exact", () => {
    expect(checkGroundTruth(" 42 ", "exact:42").pass).toBe(true);
    expect(checkGroundTruth("42!", "exact:42").pass).toBe(false);
  });

  test("regex", () => {
    expect(checkGroundTruth("## Release Notes\n- x", "regex:^## Release Notes").pass).toBe(true);
    expect(checkGroundTruth("Release Notes", "regex:^## Release Notes").pass).toBe(false);
    expect(checkGroundTruth("x", "regex:[").pass).toBe(false); // invalid regex fails, not throws
  });

  test("json", () => {
    expect(checkGroundTruth('Here: {"a": 1, "b": [2]}', 'json:{"b":[2],"a":1}').pass).toBe(true);
    expect(checkGroundTruth('{"a": 2}', 'json:{"a":1}').pass).toBe(false);
  });

  test("code", () => {
    expect(checkGroundTruth("hello world", "code:output.split(' ').length === 2").pass).toBe(true);
    expect(checkGroundTruth("hello", "code:output.length > 100").pass).toBe(false);
    expect(checkGroundTruth("x", "code:definitely.not.valid(").pass).toBe(false);
  });
});

const step = (index: number, type: TraceStep["type"], name: string, skillSelected?: string | null): TraceStep => ({
  index,
  type,
  name,
  input: "",
  output: "",
  skillSelected,
  durationMs: 1,
});

describe("checkTrajectory", () => {
  const trace = [step(0, "routing", "skill-routing", "create-jira-ticket"), step(1, "tool-call", "jira_create"), step(2, "llm", "generate")];

  test("ordered match with skill + tool + respond", () => {
    const r = checkTrajectory(
      [{ action: "skill:create-jira-ticket" }, { action: "jira_create" }, { action: "respond" }],
      trace
    );
    expect(r.pass).toBe(true);
    expect(r.score).toBe(1);
  });

  test("out-of-order fails with partial credit", () => {
    const r = checkTrajectory([{ action: "jira_create" }, { action: "skill:create-jira-ticket" }], trace);
    expect(r.pass).toBe(false);
    expect(r.score).toBe(0.5);
  });

  test("optional steps may be skipped", () => {
    const r = checkTrajectory([{ action: "lint", optional: true }, { action: "jira_create" }], trace);
    expect(r.pass).toBe(true);
  });
});

describe("checkFinalState", () => {
  test("subset match", () => {
    const r = checkFinalState({ "notes.md": "hi" }, { files: { "notes.md": "hi", extra: "x" }, kv: {} });
    expect(r.pass).toBe(true);
    expect(checkFinalState({ "notes.md": "hi" }, { files: {}, kv: {} }).pass).toBe(false);
  });
});

test("deepEqual", () => {
  expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
  expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
});
