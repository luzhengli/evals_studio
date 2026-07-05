// CLI-backed engines: Codex / Claude Code / PI Agent.
// Each wraps a local binary in non-interactive mode behind the same
// ExecutionEngine interface. The binary path and extra args live in
// EngineConfig — nothing hardcoded. Executions run inside an isolated
// scratch directory so file side effects never touch the real project.
//
// For Codex we consume `codex exec --json` JSONL events streamed from stdout
// and convert each event into a timestamped TraceStep (agent messages,
// reasoning, command executions, tool calls, token usage, turn failures).

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
import { buildSystemPrompt, parseSkillDeclaration } from "./openaiCompat.ts";

export interface CliEngineConfig {
  /** binary, e.g. "codex", "claude", "pi" */
  bin: string;
  /** extra args template; overrides the per-kind default */
  argsTemplate?: string;
  timeoutMs?: number;
}

const DEFAULT_ARGS: Record<string, string> = {
  codex: "exec --json --ephemeral --skip-git-repo-check --sandbox read-only -",
  "claude-code": "-p --output-format json",
  "pi-agent": "run --non-interactive",
};

/** A stdout line plus the wall-clock instant it arrived. */
interface TimedLine {
  at: number;
  line: string;
}

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
      const [lines, stderr, exitCode] = await Promise.all([
        readTimedLines(proc.stdout),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
      clearTimeout(timer);

      const parsed =
        this.kind === "codex"
          ? parseCodexEvents(lines, req.sample.input, systemPrompt)
          : parsePlainOutput(lines, req.sample.input, systemPrompt, started);

      const declared = parseSkillDeclaration(parsed.output, req.skills);
      const error =
        parsed.error ?? (exitCode === 0 ? null : `exit ${exitCode}: ${stderr.slice(0, 500)}`);

      return {
        output: declared.output,
        trace: parsed.trace,
        tokens: parsed.tokens,
        durationMs: Date.now() - started,
        selectedSkill: declared.selectedSkill,
        error,
      };
    } catch (e: any) {
      return {
        output: "",
        trace: [],
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

/** Stream stdout and stamp each completed line with its arrival time. */
async function readTimedLines(stream: ReadableStream<Uint8Array>): Promise<TimedLine[]> {
  const decoder = new TextDecoder();
  const lines: TimedLine[] = [];
  let buffer = "";
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) lines.push({ at: Date.now(), line });
    }
  }
  const rest = buffer.trim();
  if (rest) lines.push({ at: Date.now(), line: rest });
  return lines;
}

interface ParsedCliRun {
  output: string;
  trace: TraceStep[];
  tokens: { input: number; output: number };
  error: string | null;
}

/**
 * Convert `codex exec --json` JSONL events into TraceSteps.
 * Event shapes (codex-cli ≥0.139): thread.started · turn.started ·
 * item.completed{item:{type: agent_message|reasoning|command_execution|
 * mcp_tool_call|web_search|error,…}} · turn.completed{usage} · turn.failed{error}.
 */
export function parseCodexEvents(lines: TimedLine[], taskInput: string, systemPrompt: string): ParsedCliRun {
  const trace: TraceStep[] = [];
  let idx = 0;
  let output = "";
  let tokens = { input: 0, output: 0 };
  let error: string | null = null;
  let prevAt: number | null = null;
  const nonJson: string[] = [];

  for (const { at, line } of lines) {
    let ev: any;
    try {
      ev = JSON.parse(line);
    } catch {
      nonJson.push(line);
      continue;
    }
    const durationMs = prevAt == null ? 0 : Math.max(0, at - prevAt);
    prevAt = at;

    if (ev.type === "turn.completed" && ev.usage) {
      tokens = {
        input: (ev.usage.input_tokens ?? 0) + (ev.usage.cached_input_tokens ?? 0),
        output: ev.usage.output_tokens ?? 0,
      };
      continue;
    }
    if (ev.type === "turn.failed" || ev.type === "error") {
      const msg = ev.error?.message ?? ev.message ?? "turn failed";
      error = msg;
      trace.push({
        index: idx++,
        type: "state",
        name: "turn-failed",
        input: "",
        output: `ERROR: ${msg}`,
        startedAt: at,
        durationMs,
        error: msg,
      });
      continue;
    }
    if (ev.type !== "item.completed" || !ev.item) continue;
    const item = ev.item;

    switch (item.type) {
      case "agent_message":
        output = item.text ?? "";
        trace.push({
          index: idx++,
          type: "llm",
          name: "agent-message",
          input: taskInput,
          output,
          effectivePrompt: systemPrompt,
          startedAt: at,
          durationMs,
        });
        break;
      case "reasoning":
        trace.push({
          index: idx++,
          type: "llm",
          name: "reasoning",
          input: "",
          output: item.text ?? "",
          startedAt: at,
          durationMs,
        });
        break;
      case "command_execution": {
        const failed = item.exit_code != null && item.exit_code !== 0;
        const err = failed ? `command exited ${item.exit_code}` : null;
        trace.push({
          index: idx++,
          type: "tool-call",
          name: "shell",
          input: item.command ?? "",
          output: failed ? `ERROR: ${err}\n${item.aggregated_output ?? ""}` : (item.aggregated_output ?? ""),
          startedAt: at,
          durationMs,
          error: err,
        });
        break;
      }
      case "mcp_tool_call":
      case "web_search":
        trace.push({
          index: idx++,
          type: "tool-call",
          name: item.type === "web_search" ? "web-search" : (item.tool ?? "mcp-tool"),
          input: JSON.stringify(item.arguments ?? item.query ?? ""),
          output: JSON.stringify(item.result ?? item.status ?? ""),
          startedAt: at,
          durationMs,
        });
        break;
      case "error": {
        const msg = item.message ?? "item error";
        error = error ?? msg;
        trace.push({
          index: idx++,
          type: "state",
          name: "item-error",
          input: "",
          output: `ERROR: ${msg}`,
          startedAt: at,
          durationMs,
          error: msg,
        });
        break;
      }
      default:
        trace.push({
          index: idx++,
          type: "state",
          name: item.type ?? "event",
          input: "",
          output: JSON.stringify(item).slice(0, 500),
          startedAt: at,
          durationMs,
        });
    }
  }

  // no JSON events at all → fall back to raw text (older CLI / plain output)
  if (trace.length === 0 && nonJson.length > 0) {
    output = extractOutput(nonJson.join("\n"));
    trace.push({
      index: 0,
      type: "llm",
      name: "cli-output",
      input: taskInput,
      output,
      effectivePrompt: systemPrompt,
      startedAt: lines[0]?.at ?? Date.now(),
      durationMs: 0,
    });
  }

  return { output, trace, tokens, error };
}

/** Non-codex CLIs: single llm step from the whole stdout. */
function parsePlainOutput(lines: TimedLine[], taskInput: string, systemPrompt: string, started: number): ParsedCliRun {
  const raw = lines.map((l) => l.line).join("\n");
  const output = extractOutput(raw);
  return {
    output,
    trace: [
      {
        index: 0,
        type: "llm",
        name: "cli-output",
        input: taskInput,
        output,
        effectivePrompt: systemPrompt,
        startedAt: started,
        durationMs: lines.length ? Math.max(0, lines[lines.length - 1].at - started) : 0,
      },
    ],
    tokens: { input: 0, output: 0 },
    error: null,
  };
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
