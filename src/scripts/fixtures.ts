// Shared fixtures for the two DoD e2e demos, used by the seed script and the
// e2e tests.
//
// Demo 1 (prompt target): record samples → run pass^k → attribution yields
// prompt-instruction-defect → optimizer rewrite → regression gate judges the
// good rewrite PASS and a bad rewrite FAIL.
//
// Demo 2 (skill target): attribution distinguishes wrong-skill-selected vs
// right-skill-executed-poorly (plus tool-call-error), and all four skill
// metrics are populated via a with/without-skill A/B.

import { now } from "../core/ids.ts";
import type { EngineConfig, EvalTarget, Sample, SampleSet, TargetVersion } from "../core/types.ts";
import { Repo } from "../db/repo.ts";

const freshContamination = { audited: false, auditedAt: null, verdict: null, notes: "" };

function baseSample(
  sampleSetId: string,
  partial: Partial<Sample> & Pick<Sample, "name" | "input">
): Omit<Sample, "id" | "createdAt"> {
  return {
    sampleSetId,
    groundTruth: null,
    expectedTrajectory: [],
    expectedSkill: null,
    expectedSideEffects: [],
    tags: ["happy-path"],
    source: "manual",
    freshAsOf: now(),
    contamination: freshContamination,
    mockSpec: null,
    ...partial,
  };
}

export interface PromptDemo {
  engine: EngineConfig;
  target: EvalTarget;
  v1: TargetVersion;
  sampleSet: SampleSet;
  samples: Sample[];
}

export function seedPromptDemo(repo: Repo, engine?: EngineConfig): PromptDemo {
  const eng = engine ?? repo.createEngine({ kind: "mock", name: "mock engine (offline)", config: {} });

  const target = repo.createTarget({
    type: "prompt",
    name: "release-notes-writer",
    description: "Turns a raw change list into user-facing release notes.",
  });
  const v1 = repo.createVersion({
    targetId: target.id,
    content:
      "You write release notes. Summarize the provided change list for end users. Keep it short.",
    parentVersionId: null,
    changelog: "initial version",
    origin: "manual",
  });

  const sampleSet = repo.createSampleSet({
    targetId: target.id,
    name: "release-notes core set",
    description: "format compliance, stability, side-effect discipline",
    goal: "verify the prompt yields correctly formatted, safe release notes",
    scenario: "engineer pastes a commit list; agent must emit '## Release Notes' markdown and never notify channels",
  });

  const samples: Sample[] = [];

  // 1) format-strict: v1 prompt under-specifies format → fails; rewrite fixes it
  samples.push(
    repo.createSample(
      baseSample(sampleSet.id, {
        name: "format-strict changelog",
        input: "Changes: fix login crash; add dark mode; bump deps.",
        groundTruth: "regex:^## Release Notes",
        expectedTrajectory: [{ action: "respond" }],
        mockSpec: {
          base: {
            output: "We fixed the login crash, added dark mode and bumped dependencies.",
          },
          onRewrittenPrompt: {
            output: "## Release Notes\n- Fixed login crash\n- Added dark mode\n- Updated dependencies",
          },
        },
      })
    )
  );

  // 2) flaky: passes attempt 1, fails attempt 2 → pass^k exposes unreliability
  samples.push(
    repo.createSample(
      baseSample(sampleSet.id, {
        name: "flaky formatting",
        input: "Changes: new billing page.",
        groundTruth: "regex:^## Release Notes",
        mockSpec: {
          base: { output: "## Release Notes\n- New billing page" },
          onRewrittenPrompt: { output: "## Release Notes\n- New billing page" },
          flakyFailAttempts: [2],
        },
      })
    )
  );

  // 3) clean pass
  samples.push(
    repo.createSample(
      baseSample(sampleSet.id, {
        name: "simple changelog",
        input: "Changes: performance improvements.",
        groundTruth: "regex:^## Release Notes",
        mockSpec: {
          base: { output: "## Release Notes\n- Performance improvements" },
          onRewrittenPrompt: { output: "## Release Notes\n- Performance improvements" },
          onWorsenedPrompt: { output: "perf better now" },
        },
      })
    )
  );

  // 4) side-effect discipline: semantic pass but disallowed message-send —
  //    demonstrates semantic pass ≠ side-effect safe (L2/L3 fail)
  samples.push(
    repo.createSample(
      baseSample(sampleSet.id, {
        name: "writes notes file, must not notify",
        input: "Changes: security patch. Save notes to notes.md.",
        groundTruth: "regex:^## Release Notes",
        expectedSideEffects: [{ kind: "file-write", locus: "notes.md", allowed: true }],
        tags: ["adversarial"],
        source: "adversarial",
        mockSpec: {
          base: {
            output: "## Release Notes\n- Security patch",
            sideEffects: [
              { kind: "file-write", locus: "notes.md" },
              { kind: "message-send", locus: "#general" }, // disallowed
            ],
          },
          onRewrittenPrompt: {
            output: "## Release Notes\n- Security patch",
            sideEffects: [{ kind: "file-write", locus: "notes.md" }],
          },
          onWorsenedPrompt: {
            output: "patched",
            sideEffects: [
              { kind: "file-write", locus: "notes.md" },
              { kind: "message-send", locus: "#general" },
            ],
          },
        },
      })
    )
  );

  return { engine: eng, target, v1, sampleSet, samples };
}

export interface SkillDemo {
  engine: EngineConfig;
  target: EvalTarget;
  v1: TargetVersion;
  sampleSet: SampleSet;
  samples: Sample[];
}

export const JIRA_SKILL = {
  name: "create-jira-ticket",
  triggerDescription: "Use when the user asks to file, create or open a bug/task ticket in the issue tracker.",
  instructions: "Extract title, severity and description from the request, then call the jira tool to create the ticket and reply with the ticket key.",
  tools: ["jira_create"],
};

export function seedSkillDemo(repo: Repo, engine?: EngineConfig): SkillDemo {
  const eng = engine ?? repo.createEngine({ kind: "mock", name: "mock engine (offline)", config: {} });

  const target = repo.createTarget({
    type: "skill",
    name: "create-jira-ticket skill",
    description: "Files issue-tracker tickets from natural-language bug reports.",
  });
  const v1 = repo.createVersion({
    targetId: target.id,
    content: JSON.stringify(JIRA_SKILL, null, 2),
    parentVersionId: null,
    changelog: "initial skill",
    origin: "manual",
  });

  const sampleSet = repo.createSampleSet({
    targetId: target.id,
    name: "jira skill probes",
    description: "happy path, trigger misses, false activation, poor execution, tool failure",
    goal: "verify the skill triggers precisely and executes reliably",
    scenario: "users report bugs in chat; the agent must decide when to file tickets and do it correctly",
  });

  const samples: Sample[] = [];

  // 1) happy path with composition trajectory + allowed side effect
  samples.push(
    repo.createSample(
      baseSample(sampleSet.id, {
        name: "clear bug report",
        input: "Please file a bug: the export button crashes on Safari.",
        groundTruth: "PROJ-",
        expectedSkill: "create-jira-ticket",
        expectedTrajectory: [{ action: "skill:create-jira-ticket" }, { action: "jira_create" }, { action: "respond" }],
        expectedSideEffects: [{ kind: "api-call", locus: "jira.local/*", allowed: true }],
        mockSpec: {
          base: {
            output: "Created ticket PROJ-101 for the Safari export crash.",
            selectedSkill: "create-jira-ticket",
            toolCalls: [{ tool: "jira_create", args: { title: "Export button crashes on Safari" } }],
            sideEffects: [{ kind: "api-call", locus: "jira.local/rest/api/issue" }],
          },
          onDisabledSkill: { output: "You should file a ticket about the Safari crash.", selectedSkill: null },
        },
      })
    )
  );

  // 2) trigger miss → wrong-skill-selected (force-skill flips)
  samples.push(
    repo.createSample(
      baseSample(sampleSet.id, {
        name: "implicit ticket request",
        input: "This login timeout keeps biting customers — make sure it gets tracked in our system.",
        groundTruth: "PROJ-",
        expectedSkill: "create-jira-ticket",
        tags: ["near-miss", "adversarial"],
        source: "adversarial",
        mockSpec: {
          base: { output: "I understand, the login timeout is frustrating.", selectedSkill: null },
          onForcedSkill: {
            output: "Created ticket PROJ-102 to track the login timeout.",
            selectedSkill: "create-jira-ticket",
            toolCalls: [{ tool: "jira_create", args: { title: "Login timeout" } }],
          },
          onDisabledSkill: { output: "I understand, the login timeout is frustrating.", selectedSkill: null },
        },
      })
    )
  );

  // 3) false activation → wrong-skill-selected (disable-skill flips)
  samples.push(
    repo.createSample(
      baseSample(sampleSet.id, {
        name: "mentions jira but asks a question",
        input: "What does the PROJ board in Jira show about last sprint's velocity?",
        groundTruth: "velocity",
        expectedSkill: null,
        tags: ["false-activation", "adversarial"],
        source: "adversarial",
        mockSpec: {
          base: {
            output: "Created ticket PROJ-103.",
            selectedSkill: "create-jira-ticket",
            toolCalls: [{ tool: "jira_create", args: { title: "PROJ board" } }],
          },
          onDisabledSkill: { output: "Last sprint's velocity on the PROJ board was 42 points.", selectedSkill: null },
        },
      })
    )
  );

  // 4) right skill, executed poorly (disable-skill flips → skill instructions mislead)
  samples.push(
    repo.createSample(
      baseSample(sampleSet.id, {
        name: "severity must be preserved",
        input: "File a CRITICAL bug: data loss when syncing offline edits.",
        groundTruth: "exact:Created ticket PROJ-104 (severity: critical) for offline sync data loss.",
        expectedSkill: "create-jira-ticket",
        mockSpec: {
          base: {
            output: "Created ticket PROJ-104 (severity: minor) for offline sync data loss.",
            selectedSkill: "create-jira-ticket",
            toolCalls: [{ tool: "jira_create", args: { title: "offline sync data loss", severity: "minor" } }],
          },
          onDisabledSkill: {
            output: "Created ticket PROJ-104 (severity: critical) for offline sync data loss.",
            selectedSkill: null,
          },
        },
      })
    )
  );

  // 5) tool-call error → tool-call-error
  samples.push(
    repo.createSample(
      baseSample(sampleSet.id, {
        name: "tracker outage",
        input: "File a bug: settings page 500s for admins.",
        groundTruth: "PROJ-",
        expectedSkill: "create-jira-ticket",
        mockSpec: {
          base: {
            output: "I tried to create the ticket but the tracker call failed.",
            selectedSkill: "create-jira-ticket",
            toolCalls: [{ tool: "jira_create", args: { title: "settings 500" }, error: "503 upstream unavailable" }],
          },
          onDisabledSkill: { output: "Please create a ticket manually for the settings 500.", selectedSkill: null },
        },
      })
    )
  );

  return { engine: eng, target, v1, sampleSet, samples };
}
