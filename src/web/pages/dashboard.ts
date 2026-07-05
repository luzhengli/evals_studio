import { get } from "../api.ts";
import { h, fmtTime } from "../dom.ts";
import { card, causeChip, pageHeader, passKChip, statusChip, table } from "../components.ts";
import { t, tv } from "../i18n.ts";

export async function renderDashboard(main: HTMLElement) {
  const o = await get("/api/overview");

  main.appendChild(pageHeader(t("dashboard.title")));

  main.appendChild(
    h(
      "div",
      { class: "grid grid-cols-4 gap-3 mb-4" },
      stat(t("dashboard.statTargets"), o.targets, t("dashboard.statTargetsSub", { prompts: o.prompts, skills: o.skills })),
      stat(t("dashboard.statExperiments"), o.experiments, t("dashboard.statExperimentsSub", { done: o.experimentsDone })),
      stat(t("dashboard.statAttributions"), o.attributions, t("dashboard.statAttributionsSub")),
      stat(
        t("dashboard.statTopCause"),
        topCause(o.causeCounts)?.[1] ?? 0,
        topCause(o.causeCounts) ? tv("cause", topCause(o.causeCounts)![0]) : t("dashboard.statNoneYet")
      )
    )
  );

  const causes = Object.entries(o.causeCounts as Record<string, number>).sort((a, b) => b[1] - a[1]);
  main.appendChild(
    h(
      "div",
      { class: "grid grid-cols-3 gap-4" },
      h(
        "div",
        { class: "col-span-2" },
        card(
          t("dashboard.recentExperiments"),
          h("a", { class: "link text-[13px]", href: "#/experiments/new" }, t("common.newExperiment")),
          o.recentExperiments.length === 0
            ? h("p", { class: "caption py-4" }, t("dashboard.emptyExperiments"))
            : table(
                [t("table.experiment"), t("table.status"), "pass^k", t("table.gate"), t("table.when")],
                o.recentExperiments.map((e: any) => {
                  const cand = e.benchmark?.arms?.find((a: any) => a.arm === "candidate" || a.arm === "with-skill");
                  return [
                    h("a", { class: "link", href: `#/experiments/${e.id}` }, e.name),
                    statusChip(e.status),
                    cand ? passKChip(cand.k, cand.passK) : "–",
                    e.benchmark?.gate ? (e.benchmark.gate.pass ? h("span", { class: "chip-pass" }, t("common.gatePass")) : h("span", { class: "chip-fail" }, t("common.gateFail"))) : "–",
                    h("span", { class: "caption" }, fmtTime(e.createdAt)),
                  ];
                })
              )
        )
      ),
      card(
        t("dashboard.rootCauses"),
        null,
        causes.length === 0
          ? h("p", { class: "caption py-4" }, t("dashboard.emptyCauses"))
          : h(
              "div",
              { class: "flex flex-col gap-2" },
              ...causes.map(([cause, count]) => {
                const total = causes.reduce((a, [, c]) => a + c, 0);
                return h(
                  "div",
                  {},
                  h("div", { class: "flex justify-between items-center mb-1" }, causeChip(cause), h("span", { class: "mono text-[12px]" }, count)),
                  h(
                    "div",
                    { class: "h-1.5 rounded-full bg-canvas overflow-hidden" },
                    h("div", {
                      class: "h-full rounded-full",
                      style: `width:${((count as number) / total) * 100}%;background:${causeColor(cause)}`,
                    })
                  )
                );
              }),
              h("a", { class: "link text-[13px] mt-1", href: "#/attribution" }, t("dashboard.viewAllAttributions"))
            )
      )
    )
  );
}

function stat(label: string, value: number | string, sub: string): HTMLElement {
  return card(
    null,
    null,
    h("div", { class: "caption" }, label),
    h("div", { class: "mono text-[26px] font-semibold leading-tight" }, String(value)),
    h("div", { class: "caption truncate" }, sub)
  );
}

function topCause(counts: Record<string, number>): [string, number] | null {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return entries.length ? entries[0] : null;
}

import { ROOT_CAUSE_COLORS } from "../components.ts";
function causeColor(cause: string): string {
  return ROOT_CAUSE_COLORS[cause] ?? "#5f6368";
}
