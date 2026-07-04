// Attribution reports: root cause + counterfactual matrix + trace locus +
// fix recommendation, per failing case.

import { get } from "../api.ts";
import { h, fmtTime } from "../dom.ts";
import { card, causeChip, emptyState, pageHeader, passChip, table, typeChip } from "../components.ts";

export async function renderAttributions(main: HTMLElement) {
  const attrs = await get("/api/attributions");
  main.appendChild(pageHeader("attribution reports"));
  main.appendChild(
    h(
      "p",
      { class: "caption mb-4 -mt-2" },
      "every failed case is replayed under counterfactual interventions (rewrite prompt / force skill / disable skill / swap model); the outcome flip pattern determines the root cause — selection layer first, then execution, then base model"
    )
  );

  if (attrs.length === 0) {
    main.appendChild(emptyState("no attributions yet — open a finished experiment and click “run attribution”", h("a", { class: "btn-primary", href: "#/experiments" }, "experiments")));
    return;
  }

  for (const a of attrs) {
    main.appendChild(
      card(
        h(
          "span",
          { class: "flex items-center gap-2 flex-wrap" },
          causeChip(a.rootCause),
          h("span", {}, a.sampleName),
          h("span", { class: "chip-neutral" }, `fix layer: ${a.fixLayer}`)
        ),
        h("span", { class: "caption" }, fmtTime(a.createdAt)),
        h(
          "p",
          { class: "caption mb-3" },
          "experiment: ",
          h("a", { class: "link", href: `#/experiments/${a.experimentId}` }, a.experimentName),
          " · ",
          h("a", { class: "link", href: `#/runs/${a.runId}` }, a.traceStepIndex != null ? `trace step #${a.traceStepIndex} →` : "view trace →")
        ),
        a.counterfactuals.length > 0
          ? table(
              ["counterfactual intervention", "outcome flipped?", "evidence"],
              a.counterfactuals.map((c: any) => [
                h("span", { class: "mono" }, c.intervention),
                c.applied ? passChip(c.outcomeFlipped, c.outcomeFlipped ? "FLIPPED → pass" : "still fails") : h("span", { class: "chip-neutral" }, "not applied"),
                h("span", { class: "caption" }, c.evidence),
              ])
            )
          : h("p", { class: "caption" }, "classified from trace evidence without replay (deterministic tool error)"),
        h(
          "div",
          { class: "mt-3 rounded-md border border-border bg-primary-dim/40 p-3" },
          h("div", { class: "text-[12px] font-semibold text-primary mb-1" }, "recommended fix"),
          h("p", { class: "text-[13px]" }, a.recommendation)
        )
      )
    );
  }
}
