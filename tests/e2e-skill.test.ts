// DoD e2e demo 2 (skill target): with/without-skill A/B, all four skill
// metrics populated, attribution distinguishes wrong-skill-selected vs
// right-skill-executed-poorly vs tool-call-error.

import { describe, expect, test } from "bun:test";
import { openDb } from "../src/db/db.ts";
import { Repo } from "../src/db/repo.ts";
import { seedSkillDemo } from "../src/scripts/fixtures.ts";
import { runExperiment } from "../src/eval/runner.ts";
import { attributeExperiment } from "../src/attribution/attribute.ts";
import { proposeSkillPatch } from "../src/optimize/optimizer.ts";
import { parseSkill } from "../src/eval/runner.ts";

const K = 2;

describe("e2e skill target", () => {
  const repo = new Repo(openDb(":memory:"));
  const demo = seedSkillDemo(repo);

  test("with/without-skill A/B + four metrics + root-cause separation", async () => {
    const exp = repo.createExperiment({
      name: "jira skill A/B",
      targetId: demo.target.id,
      targetVersionId: demo.v1.id,
      baselineVersionId: null,
      sampleSetId: demo.sampleSet.id,
      engineId: demo.engine.id,
      mode: "ab-skill",
      evalConfig: { k: K, judgeId: "mock-judge", passThreshold: 1 },
    });
    const { runs, report } = await runExperiment(repo, exp.id);

    // two isolated arms
    expect(runs.filter((r) => r.arm === "with-skill")).toHaveLength(demo.samples.length * K);
    expect(runs.filter((r) => r.arm === "without-skill")).toHaveLength(demo.samples.length * K);

    const withArm = report.arms.find((a) => a.arm === "with-skill")!;
    const withoutArm = report.arms.find((a) => a.arm === "without-skill")!;
    // all four skill metrics, never collapsed
    expect(Object.keys(withArm.perMetric).sort()).toEqual(
      ["composition", "execution_reliability", "side_effect_safety", "trigger_accuracy"].sort()
    );
    // with-skill arm reports delta vs without-skill baseline
    expect(withArm.passK.delta).not.toBeNull();
    expect(withoutArm.passK.mean).toBeGreaterThanOrEqual(0);
    // gate is computed for the A/B comparison
    expect(report.gate).not.toBeNull();

    // trigger accuracy: happy path passes, near-miss + false-activation fail
    const withRuns = runs.filter((r) => r.arm === "with-skill");
    const trig = (i: number) =>
      withRuns.find((r) => r.sampleId === demo.samples[i].id)!.grading.assertions.find((a) => a.name === "trigger-accuracy")!;
    expect(trig(0).pass).toBe(true);
    expect(trig(1).pass).toBe(false); // near-miss trigger missed
    expect(trig(2).pass).toBe(false); // false activation
    expect(trig(2).evidence).toContain("false activation");

    // ---- attribution separates root causes via counterfactual replay ----
    const attrs = await attributeExperiment(repo, exp.id);
    const byName = (i: number) => attrs.find((a) => a.sampleId === demo.samples[i].id)!;

    expect(byName(1).rootCause).toBe("wrong-skill-selected"); // trigger miss; force-skill flips
    expect(byName(1).counterfactuals.find((c) => c.intervention === "force-skill")!.outcomeFlipped).toBe(true);

    expect(byName(2).rootCause).toBe("wrong-skill-selected"); // false activation; disable-skill flips
    expect(byName(2).counterfactuals.find((c) => c.intervention === "disable-skill")!.outcomeFlipped).toBe(true);
    expect(byName(2).recommendation).toContain("False activation");

    expect(byName(3).rootCause).toBe("right-skill-executed-poorly");
    expect(byName(3).fixLayer).toBe("skill");

    expect(byName(4).rootCause).toBe("tool-call-error");
    expect(byName(4).traceStepIndex).not.toBeNull();

    // every attribution points at the skill layer with a concrete recommendation
    for (const a of attrs) {
      expect(a.fixLayer).toBe("skill");
      expect(a.recommendation.length).toBeGreaterThan(10);
    }

    // ---- dual-track optimizer: skill patch reacts to both failure classes ----
    const base = repo.getVersion(demo.v1.id)!;
    const patch = proposeSkillPatch(base, attrs);
    const patched = parseSkill(patch.proposedContent);
    expect(patched.triggerDescription).toContain("Trigger ONLY");
    expect(patched.instructions).toContain("Execute carefully");
    expect(patch.rationale).toContain("selection failure");
    expect(patch.rationale).toContain("execution failure");
  });
});
