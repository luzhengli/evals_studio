// LM-emulated / in-memory sandbox. Side-effecting tools NEVER touch the real
// world; they mutate an isolated SandboxState that supports snapshot+rollback.
// The 3rd side-effect grading endpoint (tool-state harm) diffs snapshots.

import type { SideEffectKind } from "../core/types.ts";

export interface SideEffectEvent {
  kind: SideEffectKind;
  locus: string;
  payload: string;
}

export interface SandboxState {
  files: Record<string, string>;
  messages: { channel: string; body: string }[];
  apiCalls: { endpoint: string; body: string }[];
  kv: Record<string, string>;
}

const emptyState = (): SandboxState => ({ files: {}, messages: [], apiCalls: [], kv: {} });

export class Sandbox {
  private state: SandboxState = emptyState();
  private snapshots: SandboxState[] = [];
  /** audit log of every side-effect attempted inside the sandbox */
  readonly events: SideEffectEvent[] = [];

  snapshot(): number {
    this.snapshots.push(structuredClone(this.state));
    return this.snapshots.length - 1;
  }

  rollback(snapshotIndex: number) {
    const snap = this.snapshots[snapshotIndex];
    if (!snap) throw new Error(`no snapshot ${snapshotIndex}`);
    this.state = structuredClone(snap);
    this.snapshots.length = snapshotIndex;
  }

  getState(): SandboxState {
    return structuredClone(this.state);
  }

  /** Apply an emulated side effect. This is the ONLY mutation path. */
  apply(kind: SideEffectKind, locus: string, payload: string) {
    this.events.push({ kind, locus, payload });
    switch (kind) {
      case "file-write":
        this.state.files[locus] = payload;
        break;
      case "message-send":
        this.state.messages.push({ channel: locus, body: payload });
        break;
      case "api-call":
        this.state.apiCalls.push({ endpoint: locus, body: payload });
        break;
      case "state-mutation":
        this.state.kv[locus] = payload;
        break;
    }
  }
}

/** Structural diff between two sandbox states — the harm evidence. */
export function diffStates(before: SandboxState, after: SandboxState): string[] {
  const changes: string[] = [];
  for (const [path, content] of Object.entries(after.files)) {
    if (before.files[path] !== content) changes.push(`file-write ${path}`);
  }
  for (const path of Object.keys(before.files)) {
    if (!(path in after.files)) changes.push(`file-delete ${path}`);
  }
  if (after.messages.length > before.messages.length) {
    for (const m of after.messages.slice(before.messages.length)) changes.push(`message-send ${m.channel}`);
  }
  if (after.apiCalls.length > before.apiCalls.length) {
    for (const c of after.apiCalls.slice(before.apiCalls.length)) changes.push(`api-call ${c.endpoint}`);
  }
  for (const [k, v] of Object.entries(after.kv)) {
    if (before.kv[k] !== v) changes.push(`state-mutation ${k}`);
  }
  return changes;
}
