import { get, post } from "../api.ts";
import { h, fmtNum, fmtTime, clear } from "../dom.ts";
import {
  busyButton,
  card,
  causeChip,
  emptyState,
  field,
  metricTile,
  pageHeader,
  passChip,
  passKChip,
  statusChip,
  table,
  typeChip,
} from "../components.ts";
import { t, tv } from "../i18n.ts";

export async function renderExperiments(main: HTMLElement) {
  const exps = await get("/api/experiments");
  main.appendChild(pageHeader(t("experiments.title"), h("a", { class: "btn-primary", href: "#/experiments/new" }, t("common.newExperiment"))));

  if (exps.length === 0) {
    main.appendChild(emptyState(t("experiments.empty"), h("a", { class: "btn-primary", href: "#/experiments/new" }, t("common.newExperiment"))));
    return;
  }
  main.appendChild(
    card(
      null,
      null,
      table(
        [t("table.experiment"), t("table.target"), t("table.mode"), t("table.status"), "pass^k", t("table.gate"), t("table.created")],
        exps.map((e: any) => {
          const cand = e.benchmark?.arms?.find((a: any) => a.arm === "candidate" || a.arm === "with-skill");
          return [
            h("a", { class: "link font-medium", href: `#/experiments/${e.id}` }, e.name),
            h("span", { class: "flex items-center gap-1.5" }, e.targetName, typeChip(e.targetType ?? "prompt")),
            h("span", { class: "chip-neutral" }, e.mode),
            statusChip(e.status),
            cand ? passKChip(cand.k, cand.passK) : "–",
            e.benchmark?.gate ? passChip(e.benchmark.gate.pass, e.benchmark.gate.pass ? t("common.gatePass") : t("common.gateFail")) : "–",
            h("span", { class: "caption" }, fmtTime(e.createdAt)),
          ];
        })
      )
    )
  );
}

export async function renderExperimentNew(main: HTMLElement) {
  const [targets, engines] = await Promise.all([get("/api/targets"), get("/api/engines")]);
  main.appendChild(pageHeader(t("experiments.newTitle")));
  if (targets.length === 0) {
    main.appendChild(emptyState(t("experiments.createTargetFirst"), h("a", { class: "btn-primary", href: "#/targets" }, t("experiments.targetsBtn"))));
    return;
  }
  if (engines.length === 0) {
    main.appendChild(emptyState(t("experiments.configureEngineFirst"), h("a", { class: "btn-primary", href: "#/settings" }, t("experiments.settingsBtn"))));
    return;
  }

  const nameInp = h("input", { class: "inp", placeholder: t("experiments.namePh") }) as HTMLInputElement;
  const targetSel = h("select", { class: "inp" }, ...targets.map((tg: any) => h("option", { value: tg.id }, `${tg.name} (${tv("type", tg.type)})`))) as HTMLSelectElement;
  const versionSel = h("select", { class: "inp" }) as HTMLSelectElement;
  const baselineSel = h("select", { class: "inp" }) as HTMLSelectElement;
  const setSel = h("select", { class: "inp" }) as HTMLSelectElement;
  const engineSel = h("select", { class: "inp" }, ...engines.map((e: any) => h("option", { value: e.id }, `${e.name} (${e.kind})`))) as HTMLSelectElement;
  const modeSel = h("select", { class: "inp" }) as HTMLSelectElement;
  const kInp = h("input", { class: "inp", type: "number", value: "3", min: "1", max: "10" }) as HTMLInputElement;
  const judgeInp = h("input", { class: "inp", value: "mock-judge" }) as HTMLInputElement;

  async function refreshTarget() {
    const tg = targets.find((x: any) => x.id === targetSel.value);
    const detail = await get(`/api/targets/${targetSel.value}`);
    clear(versionSel);
    clear(baselineSel);
    baselineSel.appendChild(h("option", { value: "" }, t("experiments.noBaseline")));
    for (const v of detail.versions.slice().reverse()) {
      const label = `v${v.version}${v.id === detail.target.activeVersionId ? t("experiments.activeSuffix") : ""}`;
      versionSel.appendChild(h("option", { value: v.id, selected: v.id === detail.target.activeVersionId }, label));
      baselineSel.appendChild(h("option", { value: v.id }, label));
    }
    clear(setSel);
    for (const s of detail.sampleSets) setSel.appendChild(h("option", { value: s.id }, t("experiments.samplesSuffix", { name: s.name, count: s.samples })));
    clear(modeSel);
    modeSel.appendChild(h("option", { value: "single" }, t("experiments.modeSingle")));
    if (tg.type === "prompt") modeSel.appendChild(h("option", { value: "ab-prompt" }, t("experiments.modeAbPrompt")));
    else modeSel.appendChild(h("option", { value: "ab-skill" }, t("experiments.modeAbSkill")));
  }
  targetSel.addEventListener("change", refreshTarget);
  await refreshTarget();

  main.appendChild(
    card(
      null,
      null,
      h(
        "div",
        { class: "grid grid-cols-2 gap-3 mb-4" },
        h("div", { class: "col-span-2" }, field(t("experiments.name"), nameInp)),
        field(t("experiments.target"), targetSel),
        field(t("experiments.sampleSet"), setSel),
        field(t("experiments.candidateVersion"), versionSel),
        field(t("experiments.baselineVersion"), baselineSel),
        field(t("experiments.engine"), engineSel),
        field(t("experiments.mode"), modeSel),
        field(t("experiments.kLabel"), kInp, t("experiments.kHint")),
        field(t("experiments.judge"), judgeInp, t("experiments.judgeHint"))
      ),
      busyButton(t("experiments.createAndRun"), "btn-primary", async () => {
        const exp = await post("/api/experiments", {
          name: nameInp.value.trim() || t("experiments.untitled"),
          targetId: targetSel.value,
          targetVersionId: versionSel.value,
          baselineVersionId: modeSel.value === "ab-prompt" ? baselineSel.value || null : null,
          sampleSetId: setSel.value,
          engineId: engineSel.value,
          mode: modeSel.value,
          k: Number(kInp.value),
          judgeId: judgeInp.value.trim() || "mock-judge",
        });
        await post(`/api/experiments/${exp.id}/run`);
        location.hash = `#/experiments/${exp.id}`;
      })
    )
  );
}

export async function renderExperimentDetail(main: HTMLElement, id: string) {
  const d = await get(`/api/experiments/${id}`);
  const { experiment: exp, target, benchmark, runs, attributions } = d;

  main.appendChild(
    pageHeader(
      h("span", { class: "flex items-center gap-2" }, exp.name, statusChip(exp.status)),
      exp.status !== "running"
        ? busyButton(exp.status === "done" ? t("experiments.rerun") : t("experiments.run"), "btn-secondary", async () => {
            await post(`/api/experiments/${id}/run`);
            location.reload();
          })
        : null,
      exp.status === "done"
        ? busyButton(t("experiments.runAttribution"), "btn-primary", async () => {
            await post(`/api/experiments/${id}/attribute`);
            location.reload();
          })
        : null,
      exp.status === "done"
        ? busyButton(t("experiments.exportBenchmark"), "btn-secondary", async () => {
            const r = await post(`/api/experiments/${id}/pipeline`);
            alert(t("experiments.exportDone", { outDir: r.outDir, gate: r.gatePass ? t("common.pass") : t("common.fail") }));
          })
        : null
    )
  );
  main.appendChild(
    h(
      "p",
      { class: "caption mb-4 -mt-2" },
      t("experiments.detailTarget"),
      h("a", { class: "link", href: `#/targets/${exp.targetId}` }, target?.name ?? "?"),
      t("experiments.detailMeta", { mode: exp.mode, k: exp.evalConfig.k, judge: exp.evalConfig.judgeId })
    )
  );

  // ---- benchmark per arm: type-specific metric tiles ----
  if (benchmark) {
    for (const arm of benchmark.arms) {
      main.appendChild(
        card(
          h("span", { class: "flex items-center gap-2" }, t("experiments.armTitle") + tv("arm", arm.arm), passKChip(arm.k, arm.passK)),
          h("span", { class: "caption" }, t("experiments.armMeta", { samples: arm.samples, ms: fmtNum(arm.timeMs.mean, 0), tokens: fmtNum(arm.tokens.mean, 0) })),
          h(
            "div",
            { class: "grid grid-cols-5 gap-3" },
            metricTile("pass^" + arm.k, arm.passK),
            ...Object.entries(arm.perMetric).map(([name, stat]: [string, any]) => metricTile(name, stat))
          )
        )
      );
    }
    if (benchmark.gate) {
      main.appendChild(
        card(
          h("span", { class: "flex items-center gap-2" }, t("experiments.regressionGate"), passChip(benchmark.gate.pass, benchmark.gate.pass ? t("common.pass") : t("experiments.gateFailBlocked"))),
          h("span", { class: "caption" }, `ε=${benchmark.gate.epsilon}`),
          table(
            [t("table.metric"), t("table.candidate"), t("table.baseline"), "Δ", t("table.verdict")],
            benchmark.gate.checks.map((c: any) => [
              h("span", { class: "mono" }, c.metric),
              h("span", { class: "mono" }, fmtNum(c.candidate)),
              h("span", { class: "mono" }, fmtNum(c.baseline)),
              h("span", { class: `mono font-medium ${c.delta >= 0 ? "text-pass" : "text-fail"}` }, `${c.delta >= 0 ? "+" : ""}${fmtNum(c.delta, 4)}`),
              passChip(c.pass),
            ])
          ),
          h("p", { class: `caption mt-2 ${benchmark.gate.pass ? "" : "text-fail"}` }, benchmark.gate.summary)
        )
      );
    }
  }

  // ---- attributions summary ----
  if (attributions.length > 0) {
    main.appendChild(
      card(
        t("experiments.attributions"),
        h("a", { class: "link text-[13px]", href: "#/attribution" }, t("experiments.fullReports")),
        h(
          "div",
          { class: "flex gap-2 flex-wrap" },
          ...attributions.map((a: any) => causeChip(a.rootCause))
        ),
        exp.status === "done"
          ? h(
              "div",
              { class: "mt-3" },
              busyButton(t("experiments.generateSuggestion"), "btn-primary", async () => {
                await post(`/api/targets/${exp.targetId}/suggest`, { experimentId: id });
                location.hash = `#/targets/${exp.targetId}`;
              })
            )
          : null
      )
    );
  }

  // ---- runs table (per-sample detail) ----
  const failedFirst = runs.slice().sort((a: any, b: any) => Number(a.grading.pass) - Number(b.grading.pass));
  main.appendChild(
    card(
      t("experiments.runsTitle", { count: runs.length }),
      null,
      table(
        [t("table.samples"), t("table.arm"), t("table.attempt"), t("table.verdict"), t("table.failedAssertions"), t("table.skill"), t("table.trace")],
        failedFirst.map((r: any) => [
          h("span", { class: "font-medium" }, r.sampleName),
          h("span", { class: "chip-neutral" }, tv("arm", r.arm)),
          h("span", { class: "mono" }, `${r.attempt}`),
          passChip(r.grading.pass),
          h(
            "span",
            { class: "caption" },
            r.grading.assertions
              .filter((a: any) => !a.pass)
              .map((a: any) => a.name)
              .join(", ") || "–"
          ),
          h("span", { class: "mono caption" }, r.selectedSkill ?? "–"),
          h("a", { class: "link", href: `#/runs/${r.id}` }, t("experiments.viewTrace")),
        ])
      )
    )
  );
}
