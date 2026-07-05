// Settings: execution engines + judge endpoints. No hardcoded endpoints —
// everything is configured here and stored in the settings/engines tables.

import { useState } from "react";
import { get, post, put } from "../api.ts";
import { t } from "../i18n.ts";
import { BusyButton, Card, ErrorBox, Field, PageHeader, Table, useLoad } from "../ui.tsx";

function summarizeConfig(e: any): string {
  const c = e.config ?? {};
  const parts: string[] = [];
  if (c.baseUrl) parts.push(c.baseUrl);
  if (c.model) parts.push(c.model);
  if (c.bin) parts.push(`bin=${c.bin}`);
  return parts.join(" · ") || "–";
}

export function Settings() {
  const { data, error, reload } = useLoad(async () => {
    const [engines, settings] = await Promise.all([get("/api/engines"), get("/api/settings")]);
    return { engines, settings };
  });
  const [eng, setEng] = useState({ kind: "mock", name: "", baseUrl: "", apiKey: "", model: "", bin: "" });
  const [judge, setJudge] = useState({ id: "", baseUrl: "", apiKey: "", model: "" });
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;
  const { engines, settings } = data;
  const judgeKeys = Object.entries(settings).filter(([k]) => k.startsWith("judge."));

  return (
    <>
      <PageHeader title={t("settings.title")} />
      <div className="flex flex-col gap-4">
        <Card title={t("settings.engines")}>
          {engines.length ? (
            <Table
              headers={[t("table.name"), t("table.kind"), t("table.config")]}
              rows={engines.map((e: any) => [
                <span className="font-medium">{e.name}</span>,
                <span className="chip-neutral">{e.kind}</span>,
                <span className="mono caption">{summarizeConfig(e)}</span>,
              ])}
            />
          ) : (
            <p className="caption py-2">{t("settings.noEngines")}</p>
          )}
          <div className="grid grid-cols-3 gap-3 mt-4 mb-3">
            <Field label={t("settings.kind")}>
              <select className="inp" value={eng.kind} onChange={(e) => setEng({ ...eng, kind: e.target.value })}>
                {["mock", "openai-compat", "codex", "claude-code", "pi-agent"].map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("settings.name")}>
              <input className="inp" placeholder={t("settings.namePh")} value={eng.name} onChange={(e) => setEng({ ...eng, name: e.target.value })} />
            </Field>
            <Field label={t("settings.model")}>
              <input className="inp" placeholder={t("settings.modelPh")} value={eng.model} onChange={(e) => setEng({ ...eng, model: e.target.value })} />
            </Field>
            <Field label={t("settings.baseUrl")}>
              <input className="inp" placeholder={t("settings.baseUrlPh")} value={eng.baseUrl} onChange={(e) => setEng({ ...eng, baseUrl: e.target.value })} />
            </Field>
            <Field label={t("settings.apiKey")}>
              <input className="inp" type="password" placeholder={t("settings.apiKeyPh")} value={eng.apiKey} onChange={(e) => setEng({ ...eng, apiKey: e.target.value })} />
            </Field>
            <Field label={t("settings.cliBinary")}>
              <input className="inp" placeholder={t("settings.cliBinaryPh")} value={eng.bin} onChange={(e) => setEng({ ...eng, bin: e.target.value })} />
            </Field>
          </div>
          <BusyButton
            label={t("settings.addEngine")}
            onClick={async () => {
              const config: Record<string, string> = {};
              if (eng.baseUrl) config.baseUrl = eng.baseUrl.trim();
              if (eng.apiKey) config.apiKey = eng.apiKey.trim();
              if (eng.model) config.model = eng.model.trim();
              if (eng.bin) config.bin = eng.bin.trim();
              await post("/api/engines", { kind: eng.kind, name: eng.name.trim() || eng.kind, config });
              setEng({ kind: "mock", name: "", baseUrl: "", apiKey: "", model: "", bin: "" });
              reload();
            }}
          />
        </Card>

        <Card title={t("settings.judges")}>
          <p className="caption mb-3">{t("settings.judgeNote")}</p>
          {judgeKeys.length > 0 && (
            <div className="codeblock mb-3">
              {judgeKeys.map(([k, v]) => `${k} = ${k.includes("apiKey") ? "••••" : v}`).join("\n")}
            </div>
          )}
          <div className="grid grid-cols-4 gap-3 mb-3">
            <Field label={t("settings.judgeId")}>
              <input className="inp" placeholder={t("settings.judgeIdPh")} value={judge.id} onChange={(e) => setJudge({ ...judge, id: e.target.value })} />
            </Field>
            <Field label={t("settings.baseUrl")}>
              <input className="inp" value={judge.baseUrl} onChange={(e) => setJudge({ ...judge, baseUrl: e.target.value })} />
            </Field>
            <Field label={t("settings.apiKey")}>
              <input className="inp" type="password" value={judge.apiKey} onChange={(e) => setJudge({ ...judge, apiKey: e.target.value })} />
            </Field>
            <Field label={t("settings.model")}>
              <input className="inp" value={judge.model} onChange={(e) => setJudge({ ...judge, model: e.target.value })} />
            </Field>
          </div>
          <BusyButton
            label={t("settings.saveJudge")}
            onClick={async () => {
              const idv = judge.id.trim();
              if (!idv || !judge.baseUrl.trim()) throw new Error(t("settings.judgeRequired"));
              await put("/api/settings", {
                [`judge.${idv}.baseUrl`]: judge.baseUrl.trim(),
                [`judge.${idv}.apiKey`]: judge.apiKey.trim(),
                [`judge.${idv}.model`]: judge.model.trim(),
              });
              setJudge({ id: "", baseUrl: "", apiKey: "", model: "" });
              reload();
            }}
          />
        </Card>

        <Card title={t("settings.pipeline")}>
          <div className="codeblock">{t("settings.pipelineHelp")}</div>
        </Card>
      </div>
    </>
  );
}
