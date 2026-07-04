// Run detail: grading breakdown + trace timeline with step-by-step replay.

import { get } from "../api.ts";
import { h, clear, fmtNum } from "../dom.ts";
import { card, pageHeader, passChip, table } from "../components.ts";

const STEP_COLORS: Record<string, string> = {
  llm: "#1a73e8",
  "tool-call": "#188038",
  routing: "#7b1fa2",
  state: "#5f6368",
  "side-effect": "#e37400",
};

export async function renderRun(main: HTMLElement, id: string) {
  const d = await get(`/api/runs/${id}`);
  const { run, sample, trace } = d;
  const steps = trace?.steps ?? [];

  main.appendChild(
    pageHeader(
      h("span", { class: "flex items-center gap-2" }, `run · ${sample?.name ?? run.sampleId}`, passChip(run.grading.pass)),
      h("a", { class: "btn-secondary", href: `#/experiments/${run.experimentId}` }, "← experiment")
    )
  );
  main.appendChild(
    h("p", { class: "caption mb-4 -mt-2" }, `arm: ${run.arm} · attempt ${run.attempt} · ${run.timing.durationMs}ms · ${run.tokens.input + run.tokens.output} tokens${run.selectedSkill ? ` · skill: ${run.selectedSkill}` : ""}`)
  );

  const grid = h("div", { class: "grid grid-cols-5 gap-4" });
  main.appendChild(grid);

  // ---- left: grading ----
  const left = h("div", { class: "col-span-2 flex flex-col gap-4" });
  grid.appendChild(left);

  left.appendChild(
    card(
      "grading — per-assertion",
      null,
      table(
        ["assertion", "metric", "score", "verdict"],
        run.grading.assertions.map((a: any) => [
          h("span", { title: a.evidence }, a.name),
          h("span", { class: "caption" }, a.metric.replaceAll("_", " ")),
          h("span", { class: "mono" }, fmtNum(a.score)),
          passChip(a.pass),
        ])
      ),
      h(
        "details",
        { class: "mt-2" },
        h("summary", { class: "caption cursor-pointer" }, "evidence"),
        ...run.grading.assertions.map((a: any) =>
          h("div", { class: "mt-2" }, h("div", { class: "caption font-medium" }, a.name), h("pre", { class: "codeblock" }, a.evidence))
        )
      )
    )
  );

  if (run.grading.sideEffect) {
    const se = run.grading.sideEffect;
    left.appendChild(
      card(
        "side-effect endpoints",
        null,
        h(
          "div",
          { class: "flex flex-col gap-2" },
          seRow("L1 semantic acceptance", se.semanticAcceptance),
          seRow("L2 audit-visible evidence", se.auditEvidence),
          seRow("L3 sandbox tool-state harm", se.sandboxHarm)
        ),
        h("p", { class: "caption mt-2" }, "graded independently — a semantic pass never implies side-effect safety; effects only ever touch the emulated sandbox")
      )
    );
  }

  left.appendChild(card("output", null, h("pre", { class: "codeblock max-h-64 overflow-y-auto" }, run.output || "(empty)")));

  // ---- right: trace timeline + replay ----
  let cursor = -1; // -1 = show all
  const timeline = h("div", { class: "flex flex-col gap-2" });
  const controls = h("div", { class: "flex items-center gap-2 mb-3" });

  const renderTimeline = () => {
    clear(timeline);
    steps.forEach((s: any, i: number) => {
      const visible = cursor === -1 || i <= cursor;
      const color = STEP_COLORS[s.type] ?? "#5f6368";
      const el = h(
        "div",
        { class: `trace-step ${i === cursor ? "active" : ""} ${visible ? "" : "opacity-25"}` },
        h(
          "div",
          { class: "flex items-center gap-2 px-3 py-2 cursor-pointer", onclick: () => { cursor = i; renderTimeline(); } },
          h("span", { class: "chip", style: `background:${color}1a;color:${color}` }, s.type),
          h("span", { class: "text-[13px] font-medium flex-1" }, s.name),
          s.skillSelected != null ? h("span", { class: "chip-warn mono" }, s.skillSelected) : null,
          h("span", { class: "caption mono" }, `${s.durationMs}ms`)
        ),
        visible && (cursor === -1 || i === cursor)
          ? h(
              "div",
              { class: "px-3 pb-3 flex flex-col gap-2" },
              s.effectivePrompt
                ? h("details", {}, h("summary", { class: "caption cursor-pointer" }, "effective prompt at this step"), h("pre", { class: "codeblock mt-1 max-h-48 overflow-y-auto" }, s.effectivePrompt))
                : null,
              s.input ? h("div", {}, h("div", { class: "caption" }, "input"), h("pre", { class: "codeblock" }, s.input)) : null,
              s.output ? h("div", {}, h("div", { class: "caption" }, "output"), h("pre", { class: `codeblock ${s.output.startsWith("ERROR") ? "!text-fail" : ""}` }, s.output)) : null
            )
          : null
      );
      timeline.appendChild(el);
    });
  };

  const renderControls = () => {
    clear(controls);
    controls.append(
      h("button", { class: "btn-secondary", onclick: () => { cursor = -1; renderTimeline(); renderControls(); } }, "show all"),
      h("button", { class: "btn-secondary", onclick: () => { cursor = Math.max(0, cursor <= 0 ? 0 : cursor - 1); renderTimeline(); } }, "⏮ prev"),
      h("button", { class: "btn-primary", onclick: () => { cursor = cursor >= steps.length - 1 ? steps.length - 1 : cursor + 1; renderTimeline(); } }, "step ▶"),
      h("span", { class: "caption" }, `${steps.length} steps — click any step to inspect; “step” replays the trajectory one action at a time`)
    );
  };
  renderControls();
  renderTimeline();

  grid.appendChild(h("div", { class: "col-span-3" }, card("trace timeline · replay", null, controls, timeline)));
}

function seRow(label: string, e: { pass: boolean; evidence: string }): HTMLElement {
  return h(
    "div",
    { class: "flex items-start gap-2" },
    passChip(e.pass),
    h("div", {}, h("div", { class: "text-[13px] font-medium" }, label), h("div", { class: "caption" }, e.evidence))
  );
}
