// Shared UI components per DESIGN.md.

import { h, type Child, fmtNum } from "./dom.ts";

export function card(title: Child, action: Child, ...body: Child[]): HTMLElement {
  return h(
    "div",
    { class: "card" },
    title || action ? h("div", { class: "card-title" }, h("span", {}, title), action ? h("span", {}, action) : null) : null,
    ...body
  );
}

export function passChip(pass: boolean, label?: string): HTMLElement {
  return h("span", { class: pass ? "chip-pass" : "chip-fail" }, label ?? (pass ? "PASS" : "FAIL"));
}

export function statusChip(status: string): HTMLElement {
  const cls =
    status === "done" ? "chip-pass" : status === "failed" ? "chip-fail" : status === "running" ? "chip-warn" : "chip-neutral";
  return h("span", { class: cls }, status);
}

export function typeChip(type: string): HTMLElement {
  return h("span", { class: type === "prompt" ? "chip-primary" : "chip-warn" }, type);
}

export const ROOT_CAUSE_COLORS: Record<string, string> = {
  "prompt-instruction-defect": "#7b1fa2",
  "wrong-skill-selected": "#e37400",
  "right-skill-executed-poorly": "#f9ab00",
  "tool-call-error": "#1a73e8",
  "base-model-error": "#5f6368",
};

export function causeChip(cause: string): HTMLElement {
  const color = ROOT_CAUSE_COLORS[cause] ?? "#5f6368";
  return h(
    "span",
    { class: "chip", style: `background:${color}1a;color:${color}` },
    cause
  );
}

export function metricTile(name: string, stat: { mean: number; stddev: number; delta: number | null }): HTMLElement {
  const deltaEl =
    stat.delta == null
      ? null
      : h(
          "span",
          { class: `text-[12px] font-medium ${stat.delta >= 0 ? "text-pass" : "text-fail"}` },
          `${stat.delta >= 0 ? "▲" : "▼"} ${fmtNum(Math.abs(stat.delta))}`
        );
  return h(
    "div",
    { class: "card !p-3 min-w-32" },
    h("div", { class: "caption mb-1" }, name.replaceAll("_", " ")),
    h(
      "div",
      { class: "flex items-baseline gap-2" },
      h("span", { class: "mono text-[22px] font-semibold" }, fmtNum(stat.mean)),
      h("span", { class: "caption mono" }, `±${fmtNum(stat.stddev)}`),
      deltaEl
    )
  );
}

export function passKChip(k: number, stat: { mean: number; stddev: number }): HTMLElement {
  const cls = stat.mean >= 0.7 ? "chip-pass" : stat.mean >= 0.4 ? "chip-warn" : "chip-fail";
  return h("span", { class: `${cls} mono` }, `pass^${k} ${fmtNum(stat.mean)}±${fmtNum(stat.stddev)}`);
}

export function table(headers: Child[], rows: Child[][]): HTMLElement {
  return h(
    "table",
    { class: "tbl" },
    h("thead", {}, h("tr", {}, ...headers.map((th) => h("th", {}, th)))),
    h("tbody", {}, ...rows.map((cells) => h("tr", {}, ...cells.map((td) => h("td", {}, td)))))
  );
}

export function emptyState(message: string, action?: Child): HTMLElement {
  return h(
    "div",
    { class: "card flex flex-col items-center justify-center py-12 gap-3" },
    h("p", { class: "text-ink-2" }, message),
    action ?? null
  );
}

export function field(label: string, input: HTMLElement, hint?: string): HTMLElement {
  return h("div", {}, h("label", { class: "lbl" }, label), input, hint ? h("div", { class: "caption mt-1" }, hint) : null);
}

export function pageHeader(title: Child, ...actions: Child[]): HTMLElement {
  return h(
    "div",
    { class: "flex items-center justify-between mb-4" },
    h("h1", { class: "page-title" }, title),
    h("div", { class: "flex gap-2" }, ...actions)
  );
}

export function tagChips(tags: string[]): HTMLElement {
  return h(
    "span",
    { class: "inline-flex gap-1 flex-wrap" },
    ...tags.map((t) =>
      h("span", { class: t === "false-activation" || t === "near-miss" ? "chip-warn" : "chip-neutral" }, t)
    )
  );
}

export function busyButton(label: string, cls: string, fn: () => Promise<void>): HTMLElement {
  const btn = h("button", { class: cls }, label) as HTMLButtonElement;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const orig = btn.textContent;
    btn.textContent = "working…";
    try {
      await fn();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  });
  return btn;
}
