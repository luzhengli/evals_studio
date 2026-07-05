// Attribution reports: root cause + counterfactual matrix + trace locus +
// fix recommendation, per failing case.

import { get } from "../api.ts";
import { h, fmtTime } from "../dom.ts";
import { card, causeChip, emptyState, pageHeader, passChip, table } from "../components.ts";
import { t, tv } from "../i18n.ts";

export async function renderAttributions(main: HTMLElement) {
  const attrs = await get("/api/attributions");
  main.appendChild(pageHeader(t("attribution.title")));
  main.appendChild(h("p", { class: "caption mb-4 -mt-2" }, t("attribution.subtitle")));

  if (attrs.length === 0) {
    main.appendChild(emptyState(t("attribution.empty"), h("a", { class: "btn-primary", href: "#/experiments" }, t("attribution.experimentsBtn"))));
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
          h("span", { class: "chip-neutral" }, t("attribution.fixLayer", { layer: tv("fixLayer", a.fixLayer) }))
        ),
        h("span", { class: "caption" }, fmtTime(a.createdAt)),
        h(
          "p",
          { class: "caption mb-3" },
          t("attribution.experimentLabel"),
          h("a", { class: "link", href: `#/experiments/${a.experimentId}` }, a.experimentName),
          " · ",
          h("a", { class: "link", href: `#/runs/${a.runId}` }, a.traceStepIndex != null ? t("attribution.traceStep", { index: a.traceStepIndex }) : t("attribution.viewTrace"))
        ),
        a.counterfactuals.length > 0
          ? table(
              [t("attribution.colIntervention"), t("attribution.colFlipped"), t("common.evidence")],
              a.counterfactuals.map((c: any) => [
                h("span", { class: "mono" }, c.intervention),
                c.applied ? passChip(c.outcomeFlipped, c.outcomeFlipped ? t("attribution.flipped") : t("attribution.stillFails")) : h("span", { class: "chip-neutral" }, t("attribution.notApplied")),
                h("span", { class: "caption" }, c.evidence),
              ])
            )
          : h("p", { class: "caption" }, t("attribution.noReplay")),
        h(
          "div",
          { class: "mt-3 rounded-md border border-border bg-primary-dim/40 p-3" },
          h("div", { class: "text-[12px] font-semibold text-primary mb-1" }, t("attribution.recommendedFix")),
          h("p", { class: "text-[13px]" }, a.recommendation)
        )
      )
    );
  }
}
