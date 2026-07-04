import { describe, expect, test } from "bun:test";
import { gradeSideEffects, sideEffectOverallPass } from "../src/eval/sideEffect.ts";
import { Sandbox, diffStates } from "../src/sandbox/sandbox.ts";
import type { TraceStep } from "../src/core/types.ts";

const se = (index: number, kind: string, locus: string): TraceStep => ({
  index,
  type: "side-effect",
  name: `${kind}:${locus}`,
  input: locus,
  output: `emulated ${kind} at ${locus}`,
  durationMs: 1,
});

describe("sandbox", () => {
  test("snapshot + rollback isolates state", () => {
    const sb = new Sandbox();
    const snap = sb.snapshot();
    sb.apply("file-write", "a.txt", "hello");
    sb.apply("message-send", "#general", "hi");
    expect(sb.getState().files["a.txt"]).toBe("hello");
    sb.rollback(snap);
    expect(sb.getState().files["a.txt"]).toBeUndefined();
    expect(sb.getState().messages).toHaveLength(0);
    // audit log survives rollback — evidence is never destroyed
    expect(sb.events).toHaveLength(2);
  });

  test("diffStates reports structural changes", () => {
    const sb = new Sandbox();
    const before = sb.getState();
    sb.apply("api-call", "api.example.com", "{}");
    const changes = diffStates(before, sb.getState());
    expect(changes).toEqual(["api-call api.example.com"]);
  });
});

describe("3-level side-effect grading", () => {
  test("semantic pass ≠ side-effect safe: disallowed message-send fails L2+L3", () => {
    const trace = [se(0, "file-write", "notes.md"), se(1, "message-send", "#general")];
    const grade = gradeSideEffects(trace, [{ kind: "file-write", locus: "notes.md", allowed: true }], true);
    expect(grade.semanticAcceptance.pass).toBe(true);
    expect(grade.auditEvidence.pass).toBe(false);
    expect(grade.auditEvidence.evidence).toContain("message-send@#general");
    expect(grade.sandboxHarm.pass).toBe(false);
    expect(sideEffectOverallPass(grade)).toBe(false);
  });

  test("allowed effects pass all levels", () => {
    const trace = [se(0, "file-write", "notes.md")];
    const grade = gradeSideEffects(trace, [{ kind: "file-write", locus: "notes.md", allowed: true }], true);
    expect(grade.auditEvidence.pass).toBe(true);
    expect(grade.sandboxHarm.pass).toBe(true);
    expect(sideEffectOverallPass(grade)).toBe(true);
  });

  test("wildcard locus patterns", () => {
    const trace = [se(0, "api-call", "jira.local/rest/api/issue")];
    const grade = gradeSideEffects(trace, [{ kind: "api-call", locus: "jira.local/*", allowed: true }], true);
    expect(grade.auditEvidence.pass).toBe(true);
  });

  test("side-effecting tool calls are audited too", () => {
    const trace: TraceStep[] = [
      {
        index: 0,
        type: "tool-call",
        name: "send_message",
        input: JSON.stringify({ channel: "#oncall", text: "page!" }),
        output: "ok",
        durationMs: 1,
      },
    ];
    const grade = gradeSideEffects(trace, [], true);
    expect(grade.auditEvidence.pass).toBe(false);
    expect(grade.auditEvidence.evidence).toContain("message-send@#oncall");
  });

  test("no effects at all is clean", () => {
    const grade = gradeSideEffects([], [], false);
    expect(grade.auditEvidence.pass).toBe(true);
    expect(grade.sandboxHarm.pass).toBe(true);
    expect(grade.semanticAcceptance.pass).toBe(false); // L1 mirrors semantic outcome independently
  });
});
