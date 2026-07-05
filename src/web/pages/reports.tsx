// Analysis reports: generate markdown reports from experiment data via
// customizable {{placeholder}} templates; view a single report inline.

import { useEffect, useState } from "react";
import { get, post } from "../api.ts";
import { t } from "../i18n.ts";
import { BusyButton, Card, EmptyState, ErrorBox, Field, PageHeader, Table, fmtTime, useLoad } from "../ui.tsx";

function ReportView({ id }: { id: string }) {
  const { data: rep, error } = useLoad(() => get(`/api/reports/${id}`), [id]);
  if (error) return <ErrorBox message={error} />;
  if (!rep) return null;
  return (
    <>
      <PageHeader title={rep.name}>
        <a className="btn-secondary" href="#/reports">
          {t("reports.backToList")}
        </a>
      </PageHeader>
      <Card>
        <pre className="codeblock whitespace-pre-wrap">{rep.content}</pre>
      </Card>
    </>
  );
}

function GenerateForm({ onDone }: { onDone: (id: string) => void }) {
  const { data, error } = useLoad(async () => {
    const [experiments, templates] = await Promise.all([get("/api/experiments"), get("/api/templates")]);
    return { experiments: experiments.filter((e: any) => e.status === "done"), templates };
  });
  const [form, setForm] = useState({ experimentId: "", templateId: "", taskId: "", name: "" });
  const [tasks, setTasks] = useState<any[]>([]);
  const expId = form.experimentId || data?.experiments[0]?.id || "";

  useEffect(() => {
    if (!expId) return;
    get(`/api/experiments/${expId}/analyses`).then(setTasks, () => setTasks([]));
  }, [expId]);

  if (error || !data) return null;
  if (data.experiments.length === 0) return <p className="caption py-2">{t("reports.empty")}</p>;
  const setF = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="flex items-end gap-2 flex-wrap">
      <Field label={t("reports.chooseExperiment")}>
        <select className="inp !w-56" value={expId} onChange={(e) => setF("experimentId", e.target.value)}>
          {data.experiments.map((e: any) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("reports.chooseTemplate")}>
        <select className="inp !w-56" value={form.templateId} onChange={(e) => setF("templateId", e.target.value)}>
          {data.templates.map((tpl: any) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.name}
              {tpl.builtIn ? ` (${t("reports.builtIn")})` : ""}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("reports.chooseTask")}>
        <select className="inp !w-48" value={form.taskId} onChange={(e) => setF("taskId", e.target.value)}>
          <option value="">{t("reports.noTask")}</option>
          {tasks.map((task: any) => (
            <option key={task.id} value={task.id}>
              {task.name}
            </option>
          ))}
        </select>
      </Field>
      <input className="inp !w-48" placeholder={t("reports.namePh")} value={form.name} onChange={(e) => setF("name", e.target.value)} />
      <BusyButton
        label={t("reports.generate")}
        onClick={async () => {
          const r = await post("/api/reports", {
            experimentId: expId,
            templateId: form.templateId || data.templates[0]?.id,
            taskId: form.taskId || null,
            name: form.name || undefined,
          });
          onDone(r.id);
        }}
      />
    </div>
  );
}

function Templates() {
  const { data: templates, error, reload } = useLoad(() => get("/api/templates"));
  const [form, setForm] = useState({ name: "", description: "", template: "" });
  if (error || !templates) return null;
  const setF = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Card title={t("reports.templates")}>
      <div className="flex flex-col gap-3">
        {templates.map((tpl: any) => (
          <details key={tpl.id} className="border border-border rounded-md p-3">
            <summary className="cursor-pointer text-[13px] font-medium">
              {tpl.name} {tpl.builtIn && <span className="chip-neutral ml-1">{t("reports.builtIn")}</span>}
              {tpl.description && <span className="caption ml-2">{tpl.description}</span>}
            </summary>
            <pre className="codeblock mt-2 max-h-60 overflow-y-auto">{tpl.template}</pre>
          </details>
        ))}
        <details className="border border-border rounded-md p-3">
          <summary className="cursor-pointer text-[13px] font-medium">{t("reports.newTemplate")}</summary>
          <div className="flex flex-col gap-3 mt-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("reports.templateName")}>
                <input className="inp" value={form.name} onChange={(e) => setF("name", e.target.value)} />
              </Field>
              <Field label={t("reports.templateDesc")}>
                <input className="inp" value={form.description} onChange={(e) => setF("description", e.target.value)} />
              </Field>
            </div>
            <Field label={t("reports.templateContent")} hint={t("reports.placeholdersHint")}>
              <textarea className="inp !min-h-40" value={form.template} onChange={(e) => setF("template", e.target.value)} />
            </Field>
            <BusyButton
              label={t("reports.saveTemplate")}
              onClick={async () => {
                if (!form.name.trim() || !form.template.trim()) throw new Error(t("reports.templateRequired"));
                await post("/api/templates", form);
                setForm({ name: "", description: "", template: "" });
                reload();
              }}
            />
          </div>
        </details>
      </div>
    </Card>
  );
}

export function Reports({ reportId }: { reportId?: string }) {
  const { data: reports, error, reload } = useLoad(() => get("/api/reports"));
  if (reportId) return <ReportView id={reportId} />;
  if (error) return <ErrorBox message={error} />;
  if (!reports) return null;

  return (
    <>
      <PageHeader title={t("reports.title")} />
      <p className="caption mb-4 -mt-2">{t("reports.subtitle")}</p>

      <div className="flex flex-col gap-4">
        <Card title={t("reports.generate")}>
          <GenerateForm
            onDone={(id) => {
              reload();
              location.hash = `#/reports/${id}`;
            }}
          />
        </Card>

        {reports.length === 0 ? (
          <EmptyState message={t("reports.empty")} />
        ) : (
          <Card>
            <Table
              headers={[t("table.name"), t("table.experiment"), t("table.template"), t("table.created"), ""]}
              rows={reports.map((r: any) => [
                <span className="font-medium">{r.name}</span>,
                <a className="link" href={`#/experiments/${r.experimentId}`}>
                  {r.experimentName}
                </a>,
                <span className="caption">{r.templateName}</span>,
                <span className="caption">{fmtTime(r.createdAt)}</span>,
                <a className="link" href={`#/reports/${r.id}`}>
                  {t("reports.view")}
                </a>,
              ])}
            />
          </Card>
        )}

        <Templates />
      </div>
    </>
  );
}
