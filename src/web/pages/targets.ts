import { get, post } from "../api.ts";
import { h, fmtTime, clear } from "../dom.ts";
import { busyButton, card, emptyState, field, pageHeader, table, typeChip } from "../components.ts";

export async function renderTargets(main: HTMLElement) {
  const targets = await get("/api/targets");

  main.appendChild(
    pageHeader(
      "eval targets",
      h("button", { class: "btn-primary", onclick: () => showNewTargetForm(main) }, "+ new target")
    )
  );
  main.appendChild(
    h("p", { class: "caption mb-4 -mt-2" }, "prompts and skills are peer eval targets — same samples, experiments, traces, attribution, versions and gates")
  );

  if (targets.length === 0) {
    main.appendChild(emptyState("no targets yet — create a prompt or skill to evaluate", h("button", { class: "btn-primary", onclick: () => showNewTargetForm(main) }, "+ new target")));
    return;
  }

  main.appendChild(
    card(
      null,
      null,
      table(
        ["name", "type", "versions", "sample sets", "created"],
        targets.map((t: any) => [
          h("a", { class: "link font-medium", href: `#/targets/${t.id}` }, t.name),
          typeChip(t.type),
          h("span", { class: "mono" }, t.versions),
          h("span", { class: "mono" }, t.sampleSets),
          h("span", { class: "caption" }, fmtTime(t.createdAt)),
        ])
      )
    )
  );
}

function showNewTargetForm(main: HTMLElement) {
  const existing = document.getElementById("new-target-form");
  if (existing) return existing.scrollIntoView();

  const nameInp = h("input", { class: "inp", placeholder: "e.g. release-notes-writer" }) as HTMLInputElement;
  const typeSel = h(
    "select",
    { class: "inp" },
    h("option", { value: "prompt" }, "prompt"),
    h("option", { value: "skill" }, "skill")
  ) as HTMLSelectElement;
  const descInp = h("input", { class: "inp", placeholder: "what this target does" }) as HTMLInputElement;
  const contentTa = h("textarea", {
    class: "inp min-h-32",
    placeholder: "prompt text — or for a skill, JSON: {\"name\", \"triggerDescription\", \"instructions\", \"tools\"}",
  }) as HTMLTextAreaElement;

  typeSel.addEventListener("change", () => {
    if (typeSel.value === "skill" && !contentTa.value.trim()) {
      contentTa.value = JSON.stringify(
        { name: "my-skill", triggerDescription: "Use when …", instructions: "Step 1 …", tools: [] },
        null,
        2
      );
    }
  });

  const form = card(
    "new target",
    null,
    h(
      "div",
      { class: "grid grid-cols-2 gap-3 mb-3" },
      field("name", nameInp),
      field("type", typeSel),
      h("div", { class: "col-span-2" }, field("description", descInp)),
      h("div", { class: "col-span-2" }, field("content (version 1)", contentTa, "for skills this must be a SkillDef JSON"))
    ),
    busyButton("create target", "btn-primary", async () => {
      if (!nameInp.value.trim() || !contentTa.value.trim()) throw new Error("name and content are required");
      if (typeSel.value === "skill") JSON.parse(contentTa.value); // validate early
      const t = await post("/api/targets", {
        name: nameInp.value.trim(),
        type: typeSel.value,
        description: descInp.value.trim(),
        content: contentTa.value,
      });
      location.hash = `#/targets/${t.id}`;
    })
  );
  form.id = "new-target-form";
  main.insertBefore(form, main.children[2] ?? null);
}

export async function renderTargetDetail(main: HTMLElement, id: string) {
  const d = await get(`/api/targets/${id}`);
  const { target, versions, sampleSets, experiments, suggestions } = d;
  const active = versions.find((v: any) => v.id === target.activeVersionId);

  main.appendChild(
    pageHeader(
      h("span", { class: "flex items-center gap-2" }, target.name, typeChip(target.type)),
      h("a", { class: "btn-secondary", href: `#/samples/new` }, "+ sample set"),
      h("a", { class: "btn-primary", href: `#/experiments/new` }, "run experiment")
    )
  );
  if (target.description) main.appendChild(h("p", { class: "caption mb-4 -mt-2" }, target.description));

  const grid = h("div", { class: "grid grid-cols-2 gap-4" });
  main.appendChild(grid);

  // ---- versions with diff ----
  const versionBody = h("div", {});
  const renderVersions = (selected?: { a: string; b: string }) => {
    clear(versionBody);
    versionBody.appendChild(
      table(
        ["v", "origin", "changelog", "created", ""],
        versions
          .slice()
          .reverse()
          .map((v: any) => [
            h(
              "span",
              { class: "flex items-center gap-1.5" },
              h("span", { class: "mono font-semibold" }, `v${v.version}`),
              v.id === target.activeVersionId ? h("span", { class: "chip-pass" }, "active") : null
            ),
            h("span", { class: v.origin === "optimizer" ? "chip-primary" : "chip-neutral" }, v.origin),
            h("span", { class: "caption" }, v.changelog || "–"),
            h("span", { class: "caption" }, fmtTime(v.createdAt)),
            h(
              "span",
              { class: "flex gap-2" },
              v.parentVersionId
                ? h(
                    "a",
                    { class: "link text-[12px]", onclick: () => renderVersions({ a: v.parentVersionId, b: v.id }) },
                    "diff"
                  )
                : null,
              v.id !== target.activeVersionId
                ? busyButton("activate", "btn-secondary !h-6 !px-2 !text-[12px]", async () => {
                    await post(`/api/targets/${id}/activate`, { versionId: v.id });
                    location.reload();
                  })
                : null
            ),
          ])
      )
    );
    if (selected) {
      get(`/api/versions/${selected.a}/diff/${selected.b}`).then((dd) => {
        versionBody.appendChild(
          h(
            "div",
            { class: "mt-3" },
            h("div", { class: "caption mb-1" }, `diff v${dd.a.version} → v${dd.b.version}`),
            h(
              "div",
              { class: "border border-border rounded-md overflow-hidden py-1 bg-code max-h-96 overflow-y-auto" },
              ...dd.diff.map((l: any) =>
                h("span", { class: `diff-line ${l.type === "add" ? "diff-add" : l.type === "del" ? "diff-del" : ""}` }, l.text || " ")
              )
            )
          )
        );
      });
    }
  };
  renderVersions();
  grid.appendChild(h("div", { class: "col-span-2" }, card("versions", null, versionBody)));

  // ---- active content ----
  if (active) {
    grid.appendChild(
      card(`active content (v${active.version})`, null, h("pre", { class: "codeblock max-h-80 overflow-y-auto" }, active.content))
    );
  }

  // ---- suggestions ----
  grid.appendChild(
    card(
      "optimizer suggestions",
      null,
      suggestions.length === 0
        ? h("p", { class: "caption py-2" }, "run attribution on a failed experiment, then generate a suggestion from its report")
        : h(
            "div",
            { class: "flex flex-col gap-3" },
            ...suggestions.map((s: any) =>
              h(
                "div",
                { class: "border border-border rounded-md p-3" },
                h(
                  "div",
                  { class: "flex items-center justify-between mb-1" },
                  h("span", { class: s.status === "accepted" ? "chip-pass" : s.status === "rejected" ? "chip-fail" : "chip-warn" }, s.status),
                  h("span", { class: "caption" }, fmtTime(s.createdAt))
                ),
                h("p", { class: "text-[13px] mb-2" }, s.rationale),
                h("details", {}, h("summary", { class: "caption cursor-pointer" }, "proposed content"), h("pre", { class: "codeblock mt-1 max-h-60 overflow-y-auto" }, s.proposedContent)),
                s.status === "proposed"
                  ? h(
                      "div",
                      { class: "flex gap-2 mt-2" },
                      busyButton("accept → new version", "btn-primary", async () => {
                        await post(`/api/suggestions/${s.id}/accept`);
                        location.reload();
                      }),
                      busyButton("reject", "btn-danger", async () => {
                        await post(`/api/suggestions/${s.id}/reject`);
                        location.reload();
                      })
                    )
                  : null
              )
            )
          )
    )
  );

  // ---- sample sets & experiments ----
  grid.appendChild(
    card(
      "sample sets",
      h("a", { class: "link text-[13px]", href: "#/samples/new" }, "+ new"),
      sampleSets.length === 0
        ? h("p", { class: "caption py-2" }, "none yet")
        : table(
            ["name", "samples"],
            sampleSets.map((s: any) => [h("a", { class: "link", href: `#/samples/${s.id}` }, s.name), h("span", { class: "mono" }, s.samples)])
          )
    )
  );
  grid.appendChild(
    card(
      "experiments",
      h("a", { class: "link text-[13px]", href: "#/experiments/new" }, "+ new"),
      experiments.length === 0
        ? h("p", { class: "caption py-2" }, "none yet")
        : table(
            ["name", "mode", "status"],
            experiments.map((e: any) => [
              h("a", { class: "link", href: `#/experiments/${e.id}` }, e.name),
              h("span", { class: "chip-neutral" }, e.mode),
              h("span", { class: "caption" }, e.status),
            ])
          )
    )
  );
}
