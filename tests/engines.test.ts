import { describe, expect, test } from "bun:test";
import { buildSystemPrompt, parseSkillDeclaration } from "../src/engines/openaiCompat.ts";
import { buildEngine } from "../src/engines/registry.ts";
import { MockEngine } from "../src/engines/mock.ts";
import { auditContamination } from "../src/samples/tools.ts";
import type { EngineConfig, Sample } from "../src/core/types.ts";

const sample = (over: Partial<Sample> = {}): Sample => ({
  id: "s1",
  sampleSetId: "set1",
  name: "t",
  input: "do the thing",
  groundTruth: null,
  expectedTrajectory: [],
  expectedSkill: null,
  expectedSideEffects: [],
  tags: [],
  source: "manual",
  freshAsOf: Date.now(),
  contamination: { audited: false, auditedAt: null, verdict: null, notes: "" },
  mockSpec: null,
  createdAt: 0,
  ...over,
});

describe("engine registry", () => {
  test("builds every engine kind behind the same interface", () => {
    const kinds: EngineConfig["kind"][] = ["mock", "openai-compat", "codex", "claude-code", "pi-agent"];
    for (const kind of kinds) {
      const engine = buildEngine({
        id: "e",
        kind,
        name: kind,
        config: kind === "openai-compat" ? { baseUrl: "http://localhost:1", apiKey: "k", model: "m" } : {},
        createdAt: 0,
      });
      expect(engine.kind).toBe(kind);
      expect(typeof engine.execute).toBe("function");
    }
  });

  test("openai-compat requires baseUrl (no hardcoded endpoints)", () => {
    expect(() =>
      buildEngine({ id: "e", kind: "openai-compat", name: "x", config: {}, createdAt: 0 })
    ).toThrow();
  });
});

describe("skill prompting protocol", () => {
  test("buildSystemPrompt lists skills and force-skill directive", () => {
    const p = buildSystemPrompt({
      sample: sample(),
      targetType: "skill",
      promptText: "base",
      skills: [{ name: "sk", triggerDescription: "when x", instructions: "do y", tools: [] }],
      interventions: { forceSkill: "sk" },
      attempt: 1,
    });
    expect(p).toContain("- sk: when x");
    expect(p).toContain('You MUST use the skill "sk"');
  });

  test("disable-skill intervention removes skills from the prompt", () => {
    const p = buildSystemPrompt({
      sample: sample(),
      targetType: "skill",
      promptText: "base",
      skills: [{ name: "sk", triggerDescription: "when x", instructions: "do y", tools: [] }],
      interventions: { disableSkills: true },
      attempt: 1,
    });
    expect(p).toBe("base");
  });

  test("parseSkillDeclaration extracts SKILL: line", () => {
    const skills = [{ name: "sk", triggerDescription: "", instructions: "", tools: [] }];
    expect(parseSkillDeclaration("SKILL: sk\nanswer", skills)).toEqual({ output: "answer", selectedSkill: "sk" });
    expect(parseSkillDeclaration("plain answer", skills)).toEqual({ output: "plain answer", selectedSkill: null });
  });
});

describe("mock engine determinism", () => {
  test("interventions select scripted outcomes", async () => {
    const eng = new MockEngine();
    const s = sample({
      mockSpec: {
        base: { output: "bad", selectedSkill: null },
        onForcedSkill: { output: "good", selectedSkill: "sk" },
      },
    });
    const base = await eng.execute({ sample: s, targetType: "skill", promptText: "p", skills: [], attempt: 1 });
    expect(base.output).toBe("bad");
    const forced = await eng.execute({
      sample: s,
      targetType: "skill",
      promptText: "p",
      skills: [],
      interventions: { forceSkill: "sk" },
      attempt: 1,
    });
    expect(forced.output).toBe("good");
    expect(forced.selectedSkill).toBe("sk");
  });

  test("flaky attempts fail deterministically", async () => {
    const eng = new MockEngine();
    const s = sample({ mockSpec: { base: { output: "ok" }, flakyFailAttempts: [2] } });
    const a1 = await eng.execute({ sample: s, targetType: "prompt", promptText: "p", skills: [], attempt: 1 });
    const a2 = await eng.execute({ sample: s, targetType: "prompt", promptText: "p", skills: [], attempt: 2 });
    expect(a1.output).toBe("ok");
    expect(a2.output).toContain("degraded");
  });

  test("trace carries effective prompt and routing decision", async () => {
    const eng = new MockEngine();
    const s = sample({ mockSpec: { base: { output: "ok", selectedSkill: "sk" } } });
    const r = await eng.execute({
      sample: s,
      targetType: "skill",
      promptText: "system-prompt",
      skills: [{ name: "sk", triggerDescription: "", instructions: "", tools: [] }],
      attempt: 1,
    });
    const routing = r.trace.find((t) => t.type === "routing");
    expect(routing?.skillSelected).toBe("sk");
    const llm = r.trace.find((t) => t.type === "llm");
    expect(llm?.effectivePrompt).toBe("system-prompt");
  });
});

describe("contamination audit", () => {
  test("flags answer leakage as contaminated", () => {
    const a = auditContamination(sample({ input: "What is foo? (answer: the-secret-answer)", groundTruth: "the-secret-answer" }));
    expect(a.verdict).toBe("contaminated");
  });

  test("flags public benchmark references as suspect", () => {
    const a = auditContamination(sample({ input: "Solve this GSM8K problem: ..." }));
    expect(a.verdict).toBe("suspect");
  });

  test("clean sample stays clean", () => {
    const a = auditContamination(sample());
    expect(a.verdict).toBe("clean");
    expect(a.audited).toBe(true);
  });
});
