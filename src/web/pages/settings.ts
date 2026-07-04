// Settings: execution engines + judge endpoints. No hardcoded endpoints —
// everything is configured here and stored in the settings/engines tables.

import { get, post, put } from "../api.ts";
import { h } from "../dom.ts";
import { busyButton, card, field, pageHeader, table } from "../components.ts";

export async function renderSettings(main: HTMLElement) {
  const [engines, settings] = await Promise.all([get("/api/engines"), get("/api/settings")]);

  main.appendChild(pageHeader("settings"));

  // ---- engines ----
  const kindSel = h(
    "select",
    { class: "inp" },
    ...["mock", "openai-compat", "codex", "claude-code", "pi-agent"].map((k) => h("option", { value: k }, k))
  ) as HTMLSelectElement;
  const nameInp = h("input", { class: "inp", placeholder: "display name" }) as HTMLInputElement;
  const baseUrlInp = h("input", { class: "inp", placeholder: "https://api.deepseek.com/v1 (openai-compat)" }) as HTMLInputElement;
  const apiKeyInp = h("input", { class: "inp", type: "password", placeholder: "api key" }) as HTMLInputElement;
  const modelInp = h("input", { class: "inp", placeholder: "model, e.g. deepseek-chat / glm-4" }) as HTMLInputElement;
  const binInp = h("input", { class: "inp", placeholder: "binary path for CLI engines (codex / claude / pi)" }) as HTMLInputElement;

  main.appendChild(
    card(
      "execution engines",
      null,
      engines.length
        ? table(
            ["name", "kind", "config"],
            engines.map((e: any) => [
              h("span", { class: "font-medium" }, e.name),
              h("span", { class: "chip-neutral" }, e.kind),
              h("span", { class: "mono caption" }, summarizeConfig(e)),
            ])
          )
        : h("p", { class: "caption py-2" }, "no engines configured"),
      h(
        "div",
        { class: "grid grid-cols-3 gap-3 mt-4 mb-3" },
        field("kind", kindSel),
        field("name", nameInp),
        field("model", modelInp),
        field("base url", baseUrlInp),
        field("api key", apiKeyInp),
        field("cli binary", binInp)
      ),
      busyButton("add engine", "btn-primary", async () => {
        const config: Record<string, string> = {};
        if (baseUrlInp.value) config.baseUrl = baseUrlInp.value.trim();
        if (apiKeyInp.value) config.apiKey = apiKeyInp.value.trim();
        if (modelInp.value) config.model = modelInp.value.trim();
        if (binInp.value) config.bin = binInp.value.trim();
        await post("/api/engines", { kind: kindSel.value, name: nameInp.value.trim() || kindSel.value, config });
        location.reload();
      })
    )
  );

  // ---- judge ----
  const jId = h("input", { class: "inp", placeholder: "judge id, e.g. deepseek-judge", value: settings["judge.default.id"] ?? "" }) as HTMLInputElement;
  const jUrl = h("input", { class: "inp", placeholder: "base url" }) as HTMLInputElement;
  const jKey = h("input", { class: "inp", type: "password", placeholder: "api key" }) as HTMLInputElement;
  const jModel = h("input", { class: "inp", placeholder: "model" }) as HTMLInputElement;

  main.appendChild(
    card(
      "LLM judge endpoints",
      null,
      h(
        "p",
        { class: "caption mb-3" },
        "judges are pluggable: reference the judge id in an experiment's eval config. built-in “mock-judge” is deterministic and offline. calibrate any LLM judge on labeled examples before trusting it (agreement ≥ 0.8)."
      ),
      Object.keys(settings).filter((k) => k.startsWith("judge.")).length
        ? h(
            "div",
            { class: "codeblock mb-3" },
            Object.entries(settings)
              .filter(([k]) => k.startsWith("judge."))
              .map(([k, v]) => `${k} = ${k.includes("apiKey") ? "••••" : v}`)
              .join("\n")
          )
        : null,
      h(
        "div",
        { class: "grid grid-cols-4 gap-3 mb-3" },
        field("judge id", jId),
        field("base url", jUrl),
        field("api key", jKey),
        field("model", jModel)
      ),
      busyButton("save judge", "btn-primary", async () => {
        const idv = jId.value.trim();
        if (!idv || !jUrl.value.trim()) throw new Error("judge id and base url are required");
        await put("/api/settings", {
          [`judge.${idv}.baseUrl`]: jUrl.value.trim(),
          [`judge.${idv}.apiKey`]: jKey.value.trim(),
          [`judge.${idv}.model`]: jModel.value.trim(),
        });
        location.reload();
      })
    )
  );

  // ---- about ----
  main.appendChild(
    card(
      "pipeline / CI",
      null,
      h(
        "div",
        { class: "codeblock" },
        `# run evals for an experiment and gate the result (exit 1 on regression):\nbun run pipeline <experimentId> [outDir]\n# artifacts: timing.json · grading.json (per-assertion PASS/FAIL + evidence) · benchmark.json (mean+stddev+delta)`
      )
    )
  );
}

function summarizeConfig(e: any): string {
  const c = e.config ?? {};
  const parts: string[] = [];
  if (c.baseUrl) parts.push(c.baseUrl);
  if (c.model) parts.push(c.model);
  if (c.bin) parts.push(`bin=${c.bin}`);
  return parts.join(" · ") || "–";
}
