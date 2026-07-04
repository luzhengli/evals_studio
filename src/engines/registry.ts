import type { EngineConfig, ExecutionEngine } from "../core/types.ts";
import { MockEngine } from "./mock.ts";
import { OpenAICompatEngine } from "./openaiCompat.ts";
import { CliEngine } from "./cliEngine.ts";

export function buildEngine(cfg: EngineConfig): ExecutionEngine {
  switch (cfg.kind) {
    case "mock":
      return new MockEngine();
    case "openai-compat":
      return new OpenAICompatEngine({
        baseUrl: cfg.config.baseUrl ?? "",
        apiKey: cfg.config.apiKey ?? "",
        model: cfg.config.model ?? "",
      });
    case "codex":
    case "claude-code":
    case "pi-agent":
      return new CliEngine(cfg.kind, {
        bin: cfg.config.bin ?? defaultBin(cfg.kind),
        argsTemplate: cfg.config.argsTemplate,
        timeoutMs: cfg.config.timeoutMs ? Number(cfg.config.timeoutMs) : undefined,
      });
    default:
      throw new Error(`unknown engine kind: ${cfg.kind}`);
  }
}

function defaultBin(kind: string): string {
  return kind === "claude-code" ? "claude" : kind === "pi-agent" ? "pi" : "codex";
}
