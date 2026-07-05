import { get, post } from "../api.ts";
import { h, fmtTime, clear } from "../dom.ts";
import { busyButton, card, emptyState, field, pageHeader, table, tagChips, typeChip } from "../components.ts";
import { t, tv } from "../i18n.ts";

export async function renderSampleSets(main: HTMLElement) {
  const sets = await get("/api/sample-sets");
  main.appendChild(pageHeader(t("samples.title"), h("a", { class: "btn-primary", href: "#/samples/new" }, t("samples.new"))));

  if (sets.length === 0) {
    main.appendChild(
      emptyState(t("samples.empty"), h("a", { class: "btn-primary", href: "#/samples/new" }, t("samples.startWizard")))
    );
    return;
  }
  main.appendChild(
    card(
      null,
      null,
      table(
        [t("table.name"), t("table.target"), t("table.type"), t("table.samples"), t("table.goal")],
        sets.map((s: any) => [
          h("a", { class: "link font-medium", href: `#/samples/${s.id}` }, s.name),
          s.targetName,
          typeChip(s.targetType ?? "prompt"),
          h("span", { class: "mono" }, s.samples),
          h("span", { class: "caption" }, s.goal || "–"),
        ])
      )
    )
  );
}

// ---- wizard: goal → scenario → cases → fields ----

export async function renderSampleSetWizard(main: HTMLElement) {
  const targets = await get("/api/targets");
  main.appendChild(pageHeader(t("samples.wizardTitle")));
  if (targets.length === 0) {
    main.appendChild(emptyState(t("samples.createTargetFirst"), h("a", { class: "btn-primary", href: "#/targets" }, t("samples.goToTargets"))));
    return;
  }

  const state = {
    step: 0,
    targetId: targets[0].id,
    name: "",
    goal: "",
    scenario: "",
    description: "",
    cases: [] as { name: string; input: string }[],
  };
  const STEPS = [t("samples.stepGoal"), t("samples.stepScenario"), t("samples.stepCases"), t("samples.stepFields")];
  const body = h("div", {});
  main.appendChild(card(null, null, body));

  const render = () => {
    clear(body);
    body.appendChild(
      h(
        "div",
        { class: "flex items-center gap-2 mb-5" },
        ...STEPS.flatMap((s, i) => [
          h("span", { class: `step-dot ${i === state.step ? "active" : i < state.step ? "done" : ""}` }, i < state.step ? "✓" : String(i + 1)),
          h("span", { class: `text-[13px] ${i === state.step ? "font-semibold" : "text-ink-2"}` }, s),
          i < STEPS.length - 1 ? h("span", { class: "w-6 h-px bg-border" }) : null,
        ])
      )
    );

    const content = h("div", { class: "flex flex-col gap-3 mb-4" });
    body.appendChild(content);

    if (state.step === 0) {
      const targetSel = h(
        "select",
        { class: "inp", onchange: (e: Event) => (state.targetId = (e.target as HTMLSelectElement).value) },
        ...targets.map((tg: any) => h("option", { value: tg.id, selected: tg.id === state.targetId }, `${tg.name} (${tv("type", tg.type)})`))
      );
      content.append(
        field(t("samples.attachTarget"), targetSel, t("samples.attachTargetHint")),
        field(t("samples.setName"), bound("name", t("samples.setNamePh"))),
        field(t("samples.goalLabel"), boundTa("goal", t("samples.goalPh")))
      );
    } else if (state.step === 1) {
      content.append(
        field(t("samples.scenarioLabel"), boundTa("scenario", t("samples.scenarioPh")), t("samples.scenarioHint")),
        field(t("samples.descriptionLabel"), bound("description", t("samples.descriptionPh")))
      );
    } else if (state.step === 2) {
      const list = h("div", { class: "flex flex-col gap-2" });
      const renderCases = () => {
        clear(list);
        state.cases.forEach((c, i) => {
          list.appendChild(
            h(
              "div",
              { class: "flex gap-2 items-start" },
              h("input", { class: "inp !w-56", value: c.name, placeholder: t("samples.caseNamePh"), oninput: (e: Event) => (state.cases[i].name = (e.target as HTMLInputElement).value) }),
              h("textarea", { class: "inp flex-1 !min-h-9", value: c.input, placeholder: t("samples.caseInputPh"), oninput: (e: Event) => (state.cases[i].input = (e.target as HTMLTextAreaElement).value) }),
              h("button", { class: "btn-danger", onclick: () => { state.cases.splice(i, 1); renderCases(); } }, "✕")
            )
          );
        });
      };
      renderCases();
      content.append(
        h("p", { class: "caption" }, t("samples.casesHint")),
        list,
        h("button", { class: "btn-secondary self-start", onclick: () => { state.cases.push({ name: "", input: "" }); renderCases(); } }, t("samples.addCase"))
      );
    } else {
      content.append(
        h("p", { class: "text-[13px]" }, t("samples.fieldsNote")),
        h(
          "div",
          { class: "codeblock" },
          t("samples.summary", {
            name: state.name,
            target: targets.find((tg: any) => tg.id === state.targetId)?.name ?? "?",
            goal: state.goal,
            cases: state.cases.filter((c) => c.input.trim()).length,
          })
        )
      );
    }

    body.appendChild(
      h(
        "div",
        { class: "flex justify-end gap-2" },
        state.step > 0 ? h("button", { class: "btn-secondary", onclick: () => { state.step--; render(); } }, t("common.back")) : null,
        state.step < 3
          ? h("button", { class: "btn-primary", onclick: () => {
              if (state.step === 0 && !state.name.trim()) return alert(t("samples.nameRequired"));
              state.step++;
              render();
            } }, t("common.next"))
          : busyButton(t("samples.createSet"), "btn-primary", async () => {
              const set = await post("/api/sample-sets", state);
              for (const c of state.cases.filter((c) => c.input.trim())) {
                await post(`/api/sample-sets/${set.id}/samples`, { name: c.name || c.input.slice(0, 40), input: c.input });
              }
              location.hash = `#/samples/${set.id}`;
            })
      )
    );
  };

  function bound(key: "name" | "goal" | "scenario" | "description", placeholder: string) {
    return h("input", { class: "inp", value: (state as any)[key], placeholder, oninput: (e: Event) => ((state as any)[key] = (e.target as HTMLInputElement).value) });
  }
  function boundTa(key: "goal" | "scenario", placeholder: string) {
    return h("textarea", { class: "inp", value: (state as any)[key], placeholder, oninput: (e: Event) => ((state as any)[key] = (e.target as HTMLTextAreaElement).value) });
  }

  render();
}

// ---- set detail with sample editor ----

export async function renderSampleSetDetail(main: HTMLElement, id: string) {
  const d = await get(`/api/sample-sets/${id}`);
  const { set, target, samples } = d;
  const isSkill = target?.type === "skill";

  main.appendChild(
    pageHeader(
      set.name,
      busyButton(t("samples.runAudit"), "btn-secondary", async () => {
        await post(`/api/sample-sets/${id}/audit`);
        location.reload();
      }),
      h("a", { class: "btn-primary", href: "#/experiments/new" }, t("common.runExperiment"))
    )
  );
  main.appendChild(
    h(
      "p",
      { class: "caption mb-4 -mt-2" },
      t("samples.detailTarget"),
      h("a", { class: "link", href: `#/targets/${set.targetId}` }, target?.name ?? "?"),
      set.goal ? t("samples.detailGoal", { goal: set.goal }) : ""
    )
  );

  main.appendChild(
    card(
      t("samples.listTitle", { count: samples.length }),
      null,
      samples.length === 0
        ? h("p", { class: "caption py-2" }, t("samples.emptySamples"))
        : table(
            [t("table.name"), t("table.tags"), t("table.source"), isSkill ? t("table.expectedSkill") : t("table.groundTruth"), t("table.contamination"), t("table.freshAsOf")],
            samples.map((s: any) => [
              h("span", { class: "font-medium" }, s.name),
              tagChips(s.tags),
              h("span", { class: "chip-neutral" }, tv("source", s.source)),
              h("span", { class: "mono caption" }, isSkill ? (s.expectedSkill ?? t("samples.mustNotTrigger")) : (s.groundTruth ?? t("samples.judgeGraded"))),
              contaminationChip(s.contamination),
              h("span", { class: "caption" }, fmtTime(s.freshAsOf)),
            ])
          )
    )
  );

  // ---- add sample form (field definition step of the wizard) ----
  const nameInp = inp(t("samples.sampleNamePh"));
  const inputTa = ta(t("samples.inputPh"));
  const gtInp = inp(t("samples.groundTruthPh"));
  const trajInp = inp(t("samples.trajectoryPh"));
  const skillInp = inp(t("samples.expectedSkillPh"));
  const seInp = inp(t("samples.sideEffectsPh"));
  const tagsSel = h(
    "select",
    { class: "inp" },
    ...["happy-path", "near-miss", "false-activation", "adversarial"].map((tag) => h("option", { value: tag }, tv("tag", tag)))
  ) as HTMLSelectElement;

  main.appendChild(
    card(
      t("samples.addTitle"),
      null,
      h(
        "div",
        { class: "grid grid-cols-2 gap-3 mb-3" },
        field(t("table.name"), nameInp),
        field(t("samples.tagLabel"), tagsSel, t("samples.tagHint")),
        h("div", { class: "col-span-2" }, field(t("samples.inputLabel"), inputTa)),
        field(t("samples.groundTruthLabel"), gtInp),
        field(t("samples.trajectoryLabel"), trajInp),
        isSkill ? field(t("samples.expectedSkillLabel"), skillInp) : h("div"),
        field(t("samples.sideEffectsLabel"), seInp)
      ),
      busyButton(t("samples.addSample"), "btn-primary", async () => {
        if (!nameInp.value.trim() || !inputTa.value.trim()) throw new Error(t("samples.addRequired"));
        await post(`/api/sample-sets/${id}/samples`, {
          name: nameInp.value.trim(),
          input: inputTa.value,
          groundTruth: gtInp.value.trim() || null,
          expectedTrajectory: trajInp.value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((action) => ({ action })),
          expectedSkill: skillInp.value.trim() || null,
          expectedSideEffects: seInp.value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => {
              const [kind, ...rest] = s.split(":");
              return { kind, locus: rest.join(":"), allowed: true };
            }),
          tags: [tagsSel.value],
          source: tagsSel.value === "happy-path" ? "manual" : "adversarial",
        });
        location.reload();
      })
    )
  );

  function inp(placeholder: string) {
    return h("input", { class: "inp", placeholder }) as HTMLInputElement;
  }
  function ta(placeholder: string) {
    return h("textarea", { class: "inp", placeholder }) as HTMLTextAreaElement;
  }
}

function contaminationChip(c: any): HTMLElement {
  if (!c?.audited) return h("span", { class: "chip-neutral" }, tv("contamination", "unaudited"));
  const cls = c.verdict === "clean" ? "chip-pass" : c.verdict === "suspect" ? "chip-warn" : "chip-fail";
  const el = h("span", { class: cls, title: c.notes ?? "" }, tv("contamination", c.verdict));
  return el;
}
