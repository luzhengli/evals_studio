// CLI-backed engines: Codex / Claude Code / PI Agent.
// Each wraps a local binary in non-interactive mode behind the same
// ExecutionEngine interface. The binary path and extra args live in
// EngineConfig — nothing hardcoded. Executions run inside an isolated
// scratch directory so file side effects never touch the real project.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  EngineKind,
  ExecutionEngine,
  ExecutionRequest,
  ExecutionResult,
  TraceStep,
} from "../core/types.ts";
import { buildSystemPrompt } from "./openaiCompat.ts";

export interface CliEngineConfig {
  /** binary, e.g. "codex", "claude", "pi" */
  bin: string;
  /** extra args template; {PROMPT_FILE} is substituted */
  argsTemplate?: string;
  timeoutMs?: number;
}

const DEFAULT_ARGS: Record<string, string> = {
  codex: "exec --sandbox read-only --json -",
  "claude-code": "-p --output-format json",
  "pi-agent": "run --non-interactive",
};

export class CliEngine implements ExecutionEngine {
  constructor(
    readonly kind: EngineKind,
    private cfg: CliEngineConfig
  ) {}

  async execute(req: ExecutionRequest): Promise<ExecutionResult> {
    const started = Date.now();
    const systemPrompt = buildSystemPrompt(req);
    const fullPrompt = `${systemPrompt}\n\n---\nTask:\n${req.sample.input}`;
    const workdir = mkdtempSync(join(tmpdir(), "eval-studio-"));
    const trace: TraceStep[] = [];

    try {
      const args = (this.cfg.argsTemplate ?? DEFAULT_ARGS[this.kind] ?? "").split(/\s+/).filter(Boolean);
      const proc = Bun.spawn([this.cfg.bin, ...args], {
        cwd: workdir,
        stdin: new TextEncoder().encode(fullPrompt),
        stdout: "pipe",
        stderr: "pipe",
      });

      const timeout = this.cfg.timeoutMs ?? 300_000;
      const timer = setTimeout(() => proc.kill(), timeout);
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
      clearTimeout(timer);

      const output = extractOutput(stdout);
      trace.push({
        index: 0,
        type: "llm",
        name: `${this.kind} exec`,
        input: req.sample.input,
        output,
        effectivePrompt: systemPrompt,
        durationMs: Date.now() - started,
      });

      return {
        output,
        trace,
        tokens: { input: 0, output: 0 },
        durationMs: Date.now() - started,
        selectedSkill: parseSkillLine(output),
        error: exitCode === 0 ? null : `exit ${exitCode}: ${stderr.slice(0, 500)}`,
      };
    } catch (e: any) {
      return {
        output: "",
        trace,
        tokens: { input: 0, output: 0 },
        durationMs: Date.now() - started,
        selectedSkill: null,
        error: String(e?.message ?? e),
      };
    } finally {
      rmSync(workdir, { recursive: true, force: true });
    }
  }
}

/** CLIs may emit JSON envelopes; fall back to raw text. */
function extractOutput(stdout: string): string {
  const trimmed = stdout.trim();
  try {
    const j = JSON.parse(trimmed);
    return j.result ?? j.response ?? j.output ?? j.text ?? trimmed;
  } catch {
    return trimmed;
  }
}

function parseSkillLine(output: string): string | null {
  const m = output.match(/^\s*SKILL:\s*(\S+)/);
  return m ? m[1] : null;
}
