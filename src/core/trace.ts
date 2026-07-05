// Trace utilities: timeline ordering and error surfacing.
// Steps are displayed strictly in wall-clock order (startedAt ascending);
// index is the fallback for engines that do not stamp startedAt.

import type { TraceStep } from "./types.ts";

/** Sort steps by actual occurrence time (earliest first); index breaks ties. */
export function sortTraceSteps(steps: TraceStep[]): TraceStep[] {
  return steps
    .slice()
    .sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0) || a.index - b.index);
}

export interface TraceErrorRef {
  index: number;
  name: string;
  error: string;
}

/** Collect step-level errors (explicit `error` field or legacy "ERROR:" output). */
export function traceErrors(steps: TraceStep[]): TraceErrorRef[] {
  const out: TraceErrorRef[] = [];
  for (const s of steps) {
    if (s.error) out.push({ index: s.index, name: s.name, error: s.error });
    else if (s.output.startsWith("ERROR:"))
      out.push({ index: s.index, name: s.name, error: s.output.slice("ERROR:".length).trim() });
  }
  return out;
}
