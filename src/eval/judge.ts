// Pluggable Judge abstraction. When no oracle exists, a calibrated
// LLM-as-Judge scores against a rubric. The mock judge is deterministic so
// tests/demos run offline. LLM judge endpoints come from settings — never
// hardcoded.

export interface JudgeRequest {
  /** what the target was instructed to do */
  instructions: string;
  input: string;
  output: string;
  rubric: string;
  groundTruth?: string | null;
}

export interface JudgeVerdict {
  /** 0..1 */
  score: number;
  pass: boolean;
  reasoning: string;
}

export interface Judge {
  readonly id: string;
  judge(req: JudgeRequest): Promise<JudgeVerdict>;
}

/**
 * Deterministic heuristic judge for offline runs. Convention-based:
 *  - output containing "degraded", "VIOLATION" or "ERROR" fails
 *  - empty output fails
 *  - if groundTruth given, containment counts strongly
 */
export class MockJudge implements Judge {
  readonly id = "mock-judge";

  async judge(req: JudgeRequest): Promise<JudgeVerdict> {
    const out = req.output.trim();
    if (!out) return { score: 0, pass: false, reasoning: "empty output" };
    const bad = ["degraded", "VIOLATION", "ERROR:"].filter((m) => out.includes(m));
    if (bad.length) return { score: 0.2, pass: false, reasoning: `output contains failure markers: ${bad.join(", ")}` };
    if (req.groundTruth) {
      const hit = matchesGroundTruth(out, req.groundTruth);
      return {
        score: hit ? 1 : 0.4,
        pass: hit,
        reasoning: hit ? "output consistent with ground truth" : "output diverges from ground truth",
      };
    }
    return { score: 0.9, pass: true, reasoning: "no failure markers; rubric heuristics satisfied" };
  }
}

function matchesGroundTruth(out: string, gt: string): boolean {
  const m = gt.match(/^(exact|regex|json|code):([\s\S]*)$/);
  if (!m) return out.toLowerCase().includes(gt.toLowerCase());
  const [, strategy, value] = m;
  if (strategy === "regex") {
    try {
      return new RegExp(value, "ms").test(out);
    } catch {
      return false;
    }
  }
  if (strategy === "exact") return out.trim() === value.trim();
  // json/code strategies are the deterministic checker's job; the judge only
  // confirms the output is non-degenerate
  return true;
}

/** LLM-as-Judge over any OpenAI-compatible endpoint, with rubric prompting. */
export class LlmJudge implements Judge {
  readonly id: string;
  constructor(
    private cfg: { baseUrl: string; apiKey: string; model: string },
    id = "llm-judge"
  ) {
    this.id = id;
  }

  async judge(req: JudgeRequest): Promise<JudgeVerdict> {
    const prompt = [
      "You are a strict evaluation judge. Score the assistant output against the rubric.",
      "Return ONLY a JSON object: {\"score\": <0..1>, \"pass\": <bool>, \"reasoning\": \"...\"}.",
      "",
      `## Instructions given to the assistant\n${req.instructions}`,
      `## User input\n${req.input}`,
      req.groundTruth ? `## Reference answer\n${req.groundTruth}` : "",
      `## Rubric\n${req.rubric}`,
      `## Assistant output\n${req.output}`,
    ].join("\n\n");

    const res = await fetch(`${this.cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.cfg.apiKey}` },
      body: JSON.stringify({
        model: this.cfg.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
      }),
    });
    if (!res.ok) throw new Error(`judge HTTP ${res.status}`);
    const json: any = await res.json();
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    const m = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : "{}");
    const score = clamp01(Number(parsed.score ?? 0));
    return { score, pass: Boolean(parsed.pass ?? score >= 0.7), reasoning: String(parsed.reasoning ?? "") };
  }
}

/**
 * Judge calibration: run the judge over labeled examples and report agreement.
 * A judge should only be trusted (used in experiments) when agreement ≥ 0.8.
 */
export interface CalibrationExample {
  req: JudgeRequest;
  expectedPass: boolean;
}

export async function calibrateJudge(
  judge: Judge,
  examples: CalibrationExample[]
): Promise<{ agreement: number; mismatches: number; total: number }> {
  let agree = 0;
  for (const ex of examples) {
    const v = await judge.judge(ex.req);
    if (v.pass === ex.expectedPass) agree++;
  }
  return { agreement: examples.length ? agree / examples.length : 1, mismatches: examples.length - agree, total: examples.length };
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

export function buildJudge(judgeId: string, settings: Record<string, string>): Judge {
  if (judgeId === "mock-judge" || !judgeId) return new MockJudge();
  // judge config in settings: judge.<id>.baseUrl / apiKey / model
  const baseUrl = settings[`judge.${judgeId}.baseUrl`];
  const apiKey = settings[`judge.${judgeId}.apiKey`] ?? "";
  const model = settings[`judge.${judgeId}.model`] ?? "";
  if (!baseUrl) return new MockJudge();
  return new LlmJudge({ baseUrl, apiKey, model }, judgeId);
}
