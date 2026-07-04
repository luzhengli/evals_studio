import { get, post } from "../api.ts";
import { h, fmtTime, clear } from "../dom.ts";
import { busyButton, card, emptyState, field, pageHeader, table, tagChips, typeChip } from "../components.ts";

export async function renderSampleSets(main: HTMLElement) {
  const sets = await get("/api/sample-sets");
  main.appendChild(pageHeader("sample sets", h("a", { class: "btn-primary", href: "#/samples/new" }, "+ new sample set")));

  if (sets.length === 0) {
    main.appendChild(
      emptyState("no sample sets yet — the wizard walks you through goal → scenario → cases → fields", h("a", { class: "btn-primary", href: "#/samples/new" }, "start wizard"))
    );
    return;
  }
  main.appendChild(
    card(
      null,
      null,
      table(
        ["name", "target", "type", "samples", "goal"],
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
  main.appendChild(pageHeader("new sample set"));
  if (targets.length === 0) {
    main.appendChild(emptyState("create an eval target first", h("a", { class: "btn-primary", href: "#/targets" }, "go to targets")));
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
  const STEPS = ["goal", "scenario", "cases", "fields"];
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
        ...targets.map((t: any) => h("option", { value: t.id, selected: t.id === state.targetId }, `${t.name} (${t.type})`))
      );
      content.append(
        field("attach to eval target", targetSel, "samples hang off a prompt or skill target — both are first-class"),
        field("sample set name", bound("name", "e.g. release-notes core set")),
        field("evaluation goal", boundTa("goal", "what should this sample set verify about the target?"))
      );
    } else if (state.step === 1) {
      content.append(
        field("scenario analysis", boundTa("scenario", "who uses this, in what situation, what varies, what goes wrong?"), "capture the real-world scenario the cases must cover — include failure-prone variations"),
        field("description", bound("description", "one-line summary"))
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
              h("input", { class: "inp !w-56", value: c.name, placeholder: "case name", oninput: (e: Event) => (state.cases[i].name = (e.target as HTMLInputElement).value) }),
              h("textarea", { class: "inp flex-1 !min-h-9", value: c.input, placeholder: "task input given to the engine", oninput: (e: Event) => (state.cases[i].input = (e.target as HTMLTextAreaElement).value) }),
              h("button", { class: "btn-danger", onclick: () => { state.cases.splice(i, 1); renderCases(); } }, "✕")
            )
          );
        });
      };
      renderCases();
      content.append(
        h("p", { class: "caption" }, "enumerate concrete use cases; adversarial probes (false-activation / near-miss) can be generated per sample afterwards"),
        list,
        h("button", { class: "btn-secondary self-start", onclick: () => { state.cases.push({ name: "", input: "" }); renderCases(); } }, "+ add case")
      );
    } else {
      content.append(
        h("p", { class: "text-[13px]" }, "the wizard creates the set and its cases; per-sample fields (ground truth, expected trajectory, expected skill, side-effect allowlist, tags) are defined next on the set page."),
        h(
          "div",
          { class: "codeblock" },
          `set: ${state.name}\ntarget: ${targets.find((t: any) => t.id === state.targetId)?.name}\ngoal: ${state.goal}\ncases: ${state.cases.filter((c) => c.input.trim()).length}`
        )
      );
    }

    body.appendChild(
      h(
        "div",
        { class: "flex justify-end gap-2" },
        state.step > 0 ? h("button", { class: "btn-secondary", onclick: () => { state.step--; render(); } }, "back") : null,
        state.step < 3
          ? h("button", { class: "btn-primary", onclick: () => {
              if (state.step === 0 && !state.name.trim()) return alert("name is required");
              state.step++;
              render();
            } }, "next")
          : busyButton("create sample set", "btn-primary", async () => {
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
      busyButton("run contamination audit", "btn-secondary", async () => {
        await post(`/api/sample-sets/${id}/audit`);
        location.reload();
      }),
      h("a", { class: "btn-primary", href: "#/experiments/new" }, "run experiment")
    )
  );
  main.appendChild(
    h(
      "p",
      { class: "caption mb-4 -mt-2" },
      `target: `,
      h("a", { class: "link", href: `#/targets/${set.targetId}` }, target?.name ?? "?"),
      set.goal ? ` · goal: ${set.goal}` : ""
    )
  );

  main.appendChild(
    card(
      `samples (${samples.length})`,
      null,
      samples.length === 0
        ? h("p", { class: "caption py-2" }, "no samples yet — add one below")
        : table(
            ["name", "tags", "source", isSkill ? "expected skill" : "ground truth", "contamination", "fresh as of"],
            samples.map((s: any) => [
              h("span", { class: "font-medium" }, s.name),
              tagChips(s.tags),
              h("span", { class: "chip-neutral" }, s.source),
              h("span", { class: "mono caption" }, isSkill ? (s.expectedSkill ?? "∅ must not trigger") : (s.groundTruth ?? "judge-graded")),
              contaminationChip(s.contamination),
              h("span", { class: "caption" }, fmtTime(s.freshAsOf)),
            ])
          )
    )
  );

  // ---- add sample form (field definition step of the wizard) ----
  const nameInp = inp("sample name");
  const inputTa = ta("input prompt / task given to the engine");
  const gtInp = inp("ground truth — plain containment, or prefix exact: / regex: / json: / code: (empty ⇒ LLM-judge)");
  const trajInp = inp('expected trajectory, comma-separated actions e.g. "skill:create-jira-ticket, jira_create, respond"');
  const skillInp = inp("expected skill name (empty ⇒ must NOT trigger — false-activation probe)");
  const seInp = inp('allowed side effects e.g. "file-write:notes.md, api-call:jira.local/*" (anything else is a violation)');
  const tagsSel = h(
    "select",
    { class: "inp" },
    ...["happy-path", "near-miss", "false-activation", "adversarial"].map((t) => h("option", { value: t }, t))
  ) as HTMLSelectElement;

  main.appendChild(
    card(
      "add sample — define fields",
      null,
      h(
        "div",
        { class: "grid grid-cols-2 gap-3 mb-3" },
        field("name", nameInp),
        field("tag", tagsSel, "false-activation & near-miss are the highest-value samples"),
        h("div", { class: "col-span-2" }, field("input", inputTa)),
        field("ground truth (oracle)", gtInp),
        field("expected trajectory", trajInp),
        isSkill ? field("expected skill", skillInp) : h("div"),
        field("side-effect allowlist", seInp)
      ),
      busyButton("add sample", "btn-primary", async () => {
        if (!nameInp.value.trim() || !inputTa.value.trim()) throw new Error("name and input are required");
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
  if (!c?.audited) return h("span", { class: "chip-neutral" }, "unaudited");
  const cls = c.verdict === "clean" ? "chip-pass" : c.verdict === "suspect" ? "chip-warn" : "chip-fail";
  const el = h("span", { class: cls, title: c.notes ?? "" }, c.verdict);
  return el;
}
