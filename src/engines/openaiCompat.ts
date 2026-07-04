// OpenAI-compatible chat-completions engine (DeepSeek / GLM / any gateway).
// Endpoint, key and model come from EngineConfig — never hardcoded.

import type {
  ExecutionEngine,
  ExecutionRequest,
  ExecutionResult,
  SkillDef,
  TraceStep,
} from "../core/types.ts";

export interface OpenAICompatConfig {
  baseUrl: string; // e.g. https://api.deepseek.com/v1
  apiKey: string;
  model: string;
}

export class OpenAICompatEngine implements ExecutionEngine {
  readonly kind = "openai-compat" as const;
  constructor(private cfg: OpenAICompatConfig) {
    if (!cfg.baseUrl) throw new Error("openai-compat engine requires baseUrl");
  }

  async execute(req: ExecutionRequest): Promise<ExecutionResult> {
    const started = Date.now();
    const model = req.interventions?.swapModel ?? this.cfg.model;
    const systemPrompt = buildSystemPrompt(req);
    const trace: TraceStep[] = [];
    let idx = 0;

    // routing decision is made by the model itself; we ask it to declare skill use
    const body = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: req.sample.input },
      ],
      temperature: 0.2,
    };

    const res = await fetch(`${this.cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.cfg.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        output: "",
        trace,
        tokens: { input: 0, output: 0 },
        durationMs: Date.now() - started,
        selectedSkill: null,
        error: `HTTP ${res.status}: ${text.slice(0, 500)}`,
      };
    }

    const json: any = await res.json();
    const raw: string = json.choices?.[0]?.message?.content ?? "";
    const tokens = {
      input: json.usage?.prompt_tokens ?? 0,
      output: json.usage?.completion_tokens ?? 0,
    };

    const { output, selectedSkill } = parseSkillDeclaration(raw, req.skills);

    trace.push({
      index: idx++,
      type: "routing",
      name: "skill-routing",
      input: req.sample.input,
      output: selectedSkill ? `selected skill: ${selectedSkill}` : "no skill selected",
      skillSelected: selectedSkill,
      durationMs: 0,
    });
    trace.push({
      index: idx++,
      type: "llm",
      name: "generate",
      input: req.sample.input,
      output,
      effectivePrompt: systemPrompt,
      durationMs: Date.now() - started,
      tokens,
    });

    return { output, trace, tokens, durationMs: Date.now() - started, selectedSkill, error: null };
  }
}

export function buildSystemPrompt(req: ExecutionRequest): string {
  const base = req.interventions?.rewrittenPrompt ?? req.promptText;
  const skills = req.interventions?.disableSkills ? [] : req.skills;
  if (skills.length === 0 && !req.interventions?.forceSkill) return base;

  const lines = [base, "", "## Available skills"];
  for (const s of skills) {
    lines.push(`- ${s.name}: ${s.triggerDescription}\n  instructions: ${s.instructions}`);
  }
  if (req.interventions?.forceSkill) {
    lines.push("", `You MUST use the skill "${req.interventions.forceSkill}" for this task.`);
  }
  lines.push(
    "",
    'If you use a skill, start your reply with a line "SKILL: <name>". If none applies, do not invoke any skill.'
  );
  return lines.join("\n");
}

export function parseSkillDeclaration(
  raw: string,
  skills: SkillDef[]
): { output: string; selectedSkill: string | null } {
  const m = raw.match(/^\s*SKILL:\s*(\S+)\s*\n?/);
  if (!m) return { output: raw, selectedSkill: null };
  const name = m[1];
  const known = skills.find((s) => s.name === name);
  return { output: raw.slice(m[0].length), selectedSkill: known ? known.name : name };
}
