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

export async function renderExperiments(main: HTMLElement) {
  const exps = await get("/api/experiments");
  main.appendChild(pageHeader("experiments", h("a", { class: "btn-primary", href: "#/experiments/new" }, "+ new experiment")));

  if (exps.length === 0) {
    main.appendChild(emptyState("no experiments — an experiment is (sample set × engine × target version × eval config)", h("a", { class: "btn-primary", href: "#/experiments/new" }, "+ new experiment")));
    return;
  }
  main.appendChild(
    card(
      null,
      null,
      table(
        ["experiment", "target", "mode", "status", "pass^k", "gate", "created"],
        exps.map((e: any) => {
          const cand = e.benchmark?.arms?.find((a: any) => a.arm === "candidate" || a.arm === "with-skill");
          return [
            h("a", { class: "link font-medium", href: `#/experiments/${e.id}` }, e.name),
            h("span", { class: "flex items-center gap-1.5" }, e.targetName, typeChip(e.targetType ?? "prompt")),
            h("span", { class: "chip-neutral" }, e.mode),
            statusChip(e.status),
            cand ? passKChip(cand.k, cand.passK) : "–",
            e.benchmark?.gate ? passChip(e.benchmark.gate.pass, e.benchmark.gate.pass ? "gate PASS" : "gate FAIL") : "–",
            h("span", { class: "caption" }, fmtTime(e.createdAt)),
          ];
        })
      )
    )
  );
}

export async function renderExperimentNew(main: HTMLElement) {
  const [targets, engines] = await Promise.all([get("/api/targets"), get("/api/engines")]);
  main.appendChild(pageHeader("new experiment"));
  if (targets.length === 0) {
    main.appendChild(emptyState("create a target first", h("a", { class: "btn-primary", href: "#/targets" }, "targets")));
    return;
  }
  if (engines.length === 0) {
    main.appendChild(emptyState("configure an execution engine first", h("a", { class: "btn-primary", href: "#/settings" }, "settings")));
    return;
  }

  const nameInp = h("input", { class: "inp", placeholder: "experiment name" }) as HTMLInputElement;
  const targetSel = h("select", { class: "inp" }, ...targets.map((t: any) => h("option", { value: t.id }, `${t.name} (${t.type})`))) as HTMLSelectElement;
  const versionSel = h("select", { class: "inp" }) as HTMLSelectElement;
  const baselineSel = h("select", { class: "inp" }) as HTMLSelectElement;
  const setSel = h("select", { class: "inp" }) as HTMLSelectElement;
  const engineSel = h("select", { class: "inp" }, ...engines.map((e: any) => h("option", { value: e.id }, `${e.name} (${e.kind})`))) as HTMLSelectElement;
  const modeSel = h("select", { class: "inp" }) as HTMLSelectElement;
  const kInp = h("input", { class: "inp", type: "number", value: "3", min: "1", max: "10" }) as HTMLInputElement;
  const judgeInp = h("input", { class: "inp", value: "mock-judge" }) as HTMLInputElement;

  async function refreshTarget() {
    const t = targets.find((x: any) => x.id === targetSel.value);
    const detail = await get(`/api/targets/${targetSel.value}`);
    clear(versionSel);
    clear(baselineSel);
    baselineSel.appendChild(h("option", { value: "" }, "— none —"));
    for (const v of detail.versions.slice().reverse()) {
      const label = `v${v.version}${v.id === detail.target.activeVersionId ? " (active)" : ""}`;
      versionSel.appendChild(h("option", { value: v.id, selected: v.id === detail.target.activeVersionId }, label));
      baselineSel.appendChild(h("option", { value: v.id }, label));
    }
    clear(setSel);
    for (const s of detail.sampleSets) setSel.appendChild(h("option", { value: s.id }, `${s.name} (${s.samples} samples)`));
    clear(modeSel);
    modeSel.appendChild(h("option", { value: "single" }, "single — one arm"));
    if (t.type === "prompt") modeSel.appendChild(h("option", { value: "ab-prompt" }, "A/B — candidate vs baseline version"));
    else modeSel.appendChild(h("option", { value: "ab-skill" }, "A/B — with-skill vs without-skill"));
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
        h("div", { class: "col-span-2" }, field("name", nameInp)),
        field("target", targetSel),
        field("sample set", setSel),
        field("target version (candidate)", versionSel),
        field("baseline version (ab-prompt only)", baselineSel),
        field("engine", engineSel),
        field("mode", modeSel),
        field("k (pass^k attempts)", kInp, "every sample runs k times per arm; a sample passes only if all k attempts pass"),
        field("judge", judgeInp, "mock-judge, or a judge id configured in settings")
      ),
      busyButton("create & run", "btn-primary", async () => {
        const exp = await post("/api/experiments", {
          name: nameInp.value.trim() || "untitled experiment",
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
        ? busyButton(exp.status === "done" ? "re-run" : "run", "btn-secondary", async () => {
            await post(`/api/experiments/${id}/run`);
            location.reload();
          })
        : null,
      exp.status === "done"
        ? busyButton("run attribution", "btn-primary", async () => {
            await post(`/api/experiments/${id}/attribute`);
            location.reload();
          })
        : null,
      exp.status === "done"
        ? busyButton("export benchmark.json", "btn-secondary", async () => {
            const r = await post(`/api/experiments/${id}/pipeline`);
            alert(`artifacts written to ${r.outDir}/ — gate ${r.gatePass ? "PASS" : "FAIL"}`);
          })
        : null
    )
  );
  main.appendChild(
    h(
      "p",
      { class: "caption mb-4 -mt-2" },
      "target: ",
      h("a", { class: "link", href: `#/targets/${exp.targetId}` }, target?.name ?? "?"),
      ` · mode: ${exp.mode} · k=${exp.evalConfig.k} · judge: ${exp.evalConfig.judgeId}`
    )
  );

  // ---- benchmark per arm: type-specific metric tiles ----
  if (benchmark) {
    for (const arm of benchmark.arms) {
      main.appendChild(
        card(
          h("span", { class: "flex items-center gap-2" }, `arm: ${arm.arm}`, passKChip(arm.k, arm.passK)),
          h("span", { class: "caption" }, `${arm.samples} samples · ${fmtNum(arm.timeMs.mean, 0)}ms avg · ${fmtNum(arm.tokens.mean, 0)} tokens avg`),
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
          h("span", { class: "flex items-center gap-2" }, "regression gate", passChip(benchmark.gate.pass, benchmark.gate.pass ? "PASS" : "FAIL — blocked")),
          h("span", { class: "caption" }, `ε=${benchmark.gate.epsilon}`),
          table(
            ["metric", "candidate", "baseline", "Δ", "verdict"],
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
        "failure attributions",
        h("a", { class: "link text-[13px]", href: "#/attribution" }, "full reports →"),
        h(
          "div",
          { class: "flex gap-2 flex-wrap" },
          ...attributions.map((a: any) => causeChip(a.rootCause))
        ),
        exp.status === "done"
          ? h(
              "div",
              { class: "mt-3" },
              busyButton("generate optimizer suggestion from these attributions", "btn-primary", async () => {
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
      `runs (${runs.length})`,
      null,
      table(
        ["sample", "arm", "attempt", "verdict", "failed assertions", "skill", "trace"],
        failedFirst.map((r: any) => [
          h("span", { class: "font-medium" }, r.sampleName),
          h("span", { class: "chip-neutral" }, r.arm),
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
          h("a", { class: "link", href: `#/runs/${r.id}` }, "view trace"),
        ])
      )
    )
  );
}
