// Settings: execution engines + judge endpoints. No hardcoded endpoints —
// everything is configured here and stored in the settings/engines tables.

import { get, post, put } from "../api.ts";
import { h } from "../dom.ts";
import { busyButton, card, field, pageHeader, table } from "../components.ts";
import { t } from "../i18n.ts";

export async function renderSettings(main: HTMLElement) {
  const [engines, settings] = await Promise.all([get("/api/engines"), get("/api/settings")]);

  main.appendChild(pageHeader(t("settings.title")));

  // ---- engines ----
  const kindSel = h(
    "select",
    { class: "inp" },
    ...["mock", "openai-compat", "codex", "claude-code", "pi-agent"].map((k) => h("option", { value: k }, k))
  ) as HTMLSelectElement;
  const nameInp = h("input", { class: "inp", placeholder: t("settings.namePh") }) as HTMLInputElement;
  const baseUrlInp = h("input", { class: "inp", placeholder: t("settings.baseUrlPh") }) as HTMLInputElement;
  const apiKeyInp = h("input", { class: "inp", type: "password", placeholder: t("settings.apiKeyPh") }) as HTMLInputElement;
  const modelInp = h("input", { class: "inp", placeholder: t("settings.modelPh") }) as HTMLInputElement;
  const binInp = h("input", { class: "inp", placeholder: t("settings.cliBinaryPh") }) as HTMLInputElement;

  main.appendChild(
    card(
      t("settings.engines"),
      null,
      engines.length
        ? table(
            [t("table.name"), t("table.kind"), t("table.config")],
            engines.map((e: any) => [
              h("span", { class: "font-medium" }, e.name),
              h("span", { class: "chip-neutral" }, e.kind),
              h("span", { class: "mono caption" }, summarizeConfig(e)),
            ])
          )
        : h("p", { class: "caption py-2" }, t("settings.noEngines")),
      h(
        "div",
        { class: "grid grid-cols-3 gap-3 mt-4 mb-3" },
        field(t("settings.kind"), kindSel),
        field(t("settings.name"), nameInp),
        field(t("settings.model"), modelInp),
        field(t("settings.baseUrl"), baseUrlInp),
        field(t("settings.apiKey"), apiKeyInp),
        field(t("settings.cliBinary"), binInp)
      ),
      busyButton(t("settings.addEngine"), "btn-primary", async () => {
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
  const jId = h("input", { class: "inp", placeholder: t("settings.judgeIdPh"), value: settings["judge.default.id"] ?? "" }) as HTMLInputElement;
  const jUrl = h("input", { class: "inp", placeholder: t("settings.baseUrl") }) as HTMLInputElement;
  const jKey = h("input", { class: "inp", type: "password", placeholder: t("settings.apiKeyPh") }) as HTMLInputElement;
  const jModel = h("input", { class: "inp", placeholder: t("settings.model") }) as HTMLInputElement;

  main.appendChild(
    card(
      t("settings.judges"),
      null,
      h("p", { class: "caption mb-3" }, t("settings.judgeNote")),
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
        field(t("settings.judgeId"), jId),
        field(t("settings.baseUrl"), jUrl),
        field(t("settings.apiKey"), jKey),
        field(t("settings.model"), jModel)
      ),
      busyButton(t("settings.saveJudge"), "btn-primary", async () => {
        const idv = jId.value.trim();
        if (!idv || !jUrl.value.trim()) throw new Error(t("settings.judgeRequired"));
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
  main.appendChild(card(t("settings.pipeline"), null, h("div", { class: "codeblock" }, t("settings.pipelineHelp"))));
}

function summarizeConfig(e: any): string {
  const c = e.config ?? {};
  const parts: string[] = [];
  if (c.baseUrl) parts.push(c.baseUrl);
  if (c.model) parts.push(c.model);
  if (c.bin) parts.push(`bin=${c.bin}`);
  return parts.join(" · ") || "–";
}
