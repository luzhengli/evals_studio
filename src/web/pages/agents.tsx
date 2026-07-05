// Attribution agents: configurable analysis scenario + error-attribution criteria.

import { useState } from "react";
import { get, post } from "../api.ts";
import { t } from "../i18n.ts";
import { BusyButton, Card, EmptyState, ErrorBox, Field, PageHeader, Table, fmtTime, useLoad } from "../ui.tsx";

export function Agents() {
  const { data: agents, error, reload } = useLoad(() => get("/api/agents"));
  const [form, setForm] = useState({ name: "", scenario: "", criteria: "", judgeId: "mock-judge" });
  if (error) return <ErrorBox message={error} />;
  if (!agents) return null;
  const setF = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <PageHeader title={t("agents.title")} />
      <p className="caption mb-4 -mt-2">{t("agents.subtitle")}</p>

      {agents.length === 0 ? (
        <EmptyState message={t("agents.empty")} />
      ) : (
        <Card className="mb-4">
          <Table
            headers={[t("table.name"), t("table.scenario"), t("agents.criteria"), t("agents.judge"), t("table.created")]}
            rows={agents.map((a: any) => [
              <span className="font-medium">{a.name}</span>,
              <span className="caption">{a.scenario || "–"}</span>,
              <span className="caption">{a.criteria || "–"}</span>,
              <span className="mono caption">{a.judgeId}</span>,
              <span className="caption">{fmtTime(a.createdAt)}</span>,
            ])}
          />
        </Card>
      )}

      <Card title={t("agents.create")}>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label={t("agents.name")}>
            <input className="inp" placeholder={t("agents.namePh")} value={form.name} onChange={(e) => setF("name", e.target.value)} />
          </Field>
          <Field label={t("agents.judge")}>
            <input className="inp" value={form.judgeId} onChange={(e) => setF("judgeId", e.target.value)} />
          </Field>
          <div className="col-span-2">
            <Field label={t("agents.scenario")}>
              <textarea className="inp" placeholder={t("agents.scenarioPh")} value={form.scenario} onChange={(e) => setF("scenario", e.target.value)} />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label={t("agents.criteria")}>
              <textarea className="inp" placeholder={t("agents.criteriaPh")} value={form.criteria} onChange={(e) => setF("criteria", e.target.value)} />
            </Field>
          </div>
        </div>
        <BusyButton
          label={t("agents.create")}
          onClick={async () => {
            if (!form.name.trim()) throw new Error(t("agents.nameRequired"));
            await post("/api/agents", form);
            setForm({ name: "", scenario: "", criteria: "", judgeId: "mock-judge" });
            reload();
          }}
        />
      </Card>
    </>
  );
}
