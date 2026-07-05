// Trace timeline: wall-clock ordering, step errors, and codex event parsing.

import { describe, expect, test } from "bun:test";
import { sortTraceSteps, traceErrors } from "../src/core/trace.ts";
import { MockEngine } from "../src/engines/mock.ts";
import { parseCodexEvents } from "../src/engines/cliEngine.ts";
import type { Sample, TraceStep } from "../src/core/types.ts";

const step = (index: number, over: Partial<TraceStep> = {}): TraceStep => ({
  index,
  type: "llm",
  name: `s${index}`,
  input: "",
  output: "",
  durationMs: 1,
  ...over,
});

describe("trace timeline ordering", () => {
  test("steps sort by startedAt ascending regardless of index order", () => {
    const steps = [step(0, { startedAt: 300 }), step(1, { startedAt: 100 }), step(2, { startedAt: 200 })];
    expect(sortTraceSteps(steps).map((s) => s.index)).toEqual([1, 2, 0]);
  });

  test("index breaks ties and orders steps without startedAt", () => {
    const steps = [step(2), step(0), step(1, { startedAt: 50 })];
    // missing startedAt (treated as 0) come first by index, then the stamped one
    expect(sortTraceSteps(steps).map((s) => s.index)).toEqual([0, 2, 1]);
  });

  test("mock engine emits monotonically increasing startedAt", async () => {
    const sample = {
      id: "s1",
      sampleSetId: "set",
      name: "x",
      input: "do it",
      capability: null,
      tier: null,
      groundTruth: null,
      expectedTrajectory: [],
      expectedSkill: "sk",
      expectedSideEffects: [],
      tags: [],
      source: "manual",
      freshAsOf: Date.now(),
      contamination: { audited: false, auditedAt: null, verdict: null, notes: "" },
      mockSpec: {
        base: {
          output: "done",
          selectedSkill: "sk",
          toolCalls: [{ tool: "t1", args: {} }, { tool: "t2", args: {}, error: "boom" }],
        },
      },
      createdAt: Date.now(),
    } satisfies Sample;
    const res = await new MockEngine().execute({
      sample,
      targetType: "skill",
      promptText: "p",
      skills: [{ name: "sk", triggerDescription: "", instructions: "i", tools: [] }],
      attempt: 1,
    });
    const stamps = res.trace.map((s) => s.startedAt!);
    expect(stamps.every((v) => typeof v === "number")).toBe(true);
    for (let i = 1; i < stamps.length; i++) expect(stamps[i]).toBeGreaterThanOrEqual(stamps[i - 1]);
    // failing tool call carries a step-level error
    const failing = res.trace.find((s) => s.name === "t2")!;
    expect(failing.error).toBe("boom");
  });
});

describe("trace error surfacing", () => {
  test("collects explicit error fields and legacy ERROR: outputs", () => {
    const steps = [
      step(0),
      step(1, { error: "explicit failure" }),
      step(2, { output: "ERROR: legacy failure" }),
    ];
    const errs = traceErrors(steps);
    expect(errs).toHaveLength(2);
    expect(errs[0]).toEqual({ index: 1, name: "s1", error: "explicit failure" });
    expect(errs[1].error).toBe("legacy failure");
  });
});

describe("codex JSONL event parsing", () => {
  const at = (i: number) => 1000 + i * 10;

  test("maps events to timestamped steps, tokens and final output", () => {
    const lines = [
      { at: at(0), line: JSON.stringify({ type: "thread.started", thread_id: "t" }) },
      { at: at(1), line: JSON.stringify({ type: "turn.started" }) },
      { at: at(2), line: JSON.stringify({ type: "item.completed", item: { type: "reasoning", text: "think" } }) },
      {
        at: at(3),
        line: JSON.stringify({
          type: "item.completed",
          item: { type: "command_execution", command: "ls", aggregated_output: "a b", exit_code: 0 },
        }),
      },
      { at: at(4), line: JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "OK" } }) },
      {
        at: at(5),
        line: JSON.stringify({
          type: "turn.completed",
          usage: { input_tokens: 100, cached_input_tokens: 20, output_tokens: 30 },
        }),
      },
    ];
    const parsed = parseCodexEvents(lines, "task", "sys");
    expect(parsed.output).toBe("OK");
    expect(parsed.error).toBeNull();
    expect(parsed.tokens).toEqual({ input: 120, output: 30 });
    const types = parsed.trace.map((s) => `${s.type}:${s.name}`);
    expect(types).toEqual(["llm:reasoning", "tool-call:shell", "llm:agent-message"]);
    expect(parsed.trace.every((s) => typeof s.startedAt === "number")).toBe(true);
  });

  test("failed commands and turn.failed surface as errors", () => {
    const lines = [
      {
        at: at(0),
        line: JSON.stringify({
          type: "item.completed",
          item: { type: "command_execution", command: "false", aggregated_output: "", exit_code: 1 },
        }),
      },
      { at: at(1), line: JSON.stringify({ type: "turn.failed", error: { message: "usage limit" } }) },
    ];
    const parsed = parseCodexEvents(lines, "task", "sys");
    expect(parsed.error).toBe("usage limit");
    expect(parsed.trace[0].error).toContain("exited 1");
    expect(traceErrors(parsed.trace).length).toBe(2);
  });

  test("plain text stdout falls back to a single llm step", () => {
    const parsed = parseCodexEvents([{ at: at(0), line: "just text" }], "task", "sys");
    expect(parsed.output).toBe("just text");
    expect(parsed.trace).toHaveLength(1);
    expect(parsed.trace[0].type).toBe("llm");
  });
});
