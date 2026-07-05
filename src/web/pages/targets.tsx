import { useEffect, useState } from "react";
import { get, post } from "../api.ts";
import { t, tv } from "../i18n.ts";
import {
  BusyButton,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  PageHeader,
  Table,
  TypeChip,
  fmtTime,
  useLoad,
} from "../ui.tsx";

const SKILL_TEMPLATE = JSON.stringify(
  {
    name: "my-skill",
    description: "What this skill does and when to use it.",
    triggerDescription: "Use when …",
    negativeTriggers: ["do NOT trigger when …"],
    instructions: "Step 1 …",
    tools: [],
  },
  null,
  2
);

function NewTargetForm({ onCreated }: { onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("prompt");
  const [desc, setDesc] = useState("");
  const [content, setContent] = useState("");
  const [specIssues, setSpecIssues] = useState<string[] | null>(null);

  useEffect(() => {
    if (type !== "skill" || !content.trim()) {
      setSpecIssues(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const r = await post("/api/skills/validate", { content });
        setSpecIssues(r.valid ? r.issues : r.issues);
      } catch {
        setSpecIssues(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [type, content]);

  return (
    <Card title={t("targets.formTitle")}>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Field label={t("targets.formName")}>
          <input className="inp" placeholder={t("targets.formNamePh")} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t("targets.formType")}>
          <select
            className="inp"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              if (e.target.value === "skill" && !content.trim()) setContent(SKILL_TEMPLATE);
            }}
          >
            <option value="prompt">{tv("type", "prompt")}</option>
            <option value="skill">{tv("type", "skill")}</option>
          </select>
        </Field>
        <div className="col-span-2">
          <Field label={t("targets.formDescription")}>
            <input className="inp" placeholder={t("targets.formDescriptionPh")} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label={t("targets.formContent")} hint={t("targets.formContentHint")}>
            <textarea className="inp min-h-32" placeholder={t("targets.formContentPh")} value={content} onChange={(e) => setContent(e.target.value)} />
          </Field>
        </div>
      </div>
      {type === "skill" && specIssues != null && (
        <div className={`mb-3 rounded-md border p-2.5 text-[12.5px] ${specIssues.length ? "border-warn/40 bg-warn-dim" : "border-pass/30 bg-pass-dim"}`}>
          <span className="font-medium">{t("skillspec.title")}: </span>
          {specIssues.length === 0 ? (
            <span className="text-pass">{t("skillspec.ok")}</span>
          ) : (
            <ul className="list-disc ml-5 mt-1">
              {specIssues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <BusyButton
        label={t("targets.formCreate")}
        onClick={async () => {
          if (!name.trim() || !content.trim()) throw new Error(t("targets.formRequired"));
          if (type === "skill") JSON.parse(content);
          const tg = await post("/api/targets", { name: name.trim(), type, description: desc.trim(), content });
          onCreated(tg.id);
        }}
      />
    </Card>
  );
}

export function Targets() {
  const { data: targets, error } = useLoad(() => get("/api/targets"));
  const [showForm, setShowForm] = useState(false);
  if (error) return <ErrorBox message={error} />;
  if (!targets) return null;

  return (
    <>
      <PageHeader title={t("targets.title")}>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          {t("targets.new")}
        </button>
      </PageHeader>
      <p className="caption mb-4 -mt-2">{t("targets.subtitle")}</p>
      {showForm && <div className="mb-4"><NewTargetForm onCreated={(id) => (location.hash = `#/targets/${id}`)} /></div>}
      {targets.length === 0 ? (
        !showForm && (
          <EmptyState
            message={t("targets.empty")}
            action={
              <button className="btn-primary" onClick={() => setShowForm(true)}>
                {t("targets.new")}
              </button>
            }
          />
        )
      ) : (
        <Card>
          <Table
            headers={[t("table.name"), t("table.type"), t("table.versions"), t("table.sampleSets"), t("table.created")]}
            rows={targets.map((tg: any) => [
              <a className="link font-medium" href={`#/targets/${tg.id}`}>
                {tg.name}
              </a>,
              <TypeChip type={tg.type} />,
              <span className="mono">{tg.versions}</span>,
              <span className="mono">{tg.sampleSets}</span>,
              <span className="caption">{fmtTime(tg.createdAt)}</span>,
            ])}
          />
        </Card>
      )}
    </>
  );
}

export function TargetDetail({ id }: { id: string }) {
  const { data: d, error, reload } = useLoad(() => get(`/api/targets/${id}`), [id]);
  const [diff, setDiff] = useState<{ a: any; b: any; diff: any[] } | null>(null);
  if (error) return <ErrorBox message={error} />;
  if (!d) return null;
  const { target, versions, sampleSets, experiments, suggestions } = d;
  const active = versions.find((v: any) => v.id === target.activeVersionId);

  return (
    <>
      <PageHeader
        title={
          <>
            {target.name} <TypeChip type={target.type} />
          </>
        }
      >
        <a className="btn-secondary" href="#/samples/new">
          {t("targets.newSampleSet")}
        </a>
        <a className="btn-primary" href="#/experiments/new">
          {t("common.runExperiment")}
        </a>
      </PageHeader>
      {target.description && <p className="caption mb-4 -mt-2">{target.description}</p>}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Card title={t("targets.versions")}>
            <Table
              headers={["v", t("table.origin"), t("table.changelog"), t("table.created"), ""]}
              rows={versions
                .slice()
                .reverse()
                .map((v: any) => [
                  <span className="flex items-center gap-1.5">
                    <span className="mono font-semibold">v{v.version}</span>
                    {v.id === target.activeVersionId && <span className="chip-pass">{t("targets.versionActive")}</span>}
                  </span>,
                  <span className={v.origin === "optimizer" ? "chip-primary" : "chip-neutral"}>{tv("origin", v.origin)}</span>,
                  <span className="caption">{v.changelog || "–"}</span>,
                  <span className="caption">{fmtTime(v.createdAt)}</span>,
                  <span className="flex gap-2">
                    {v.parentVersionId && (
                      <a
                        className="link text-[12px]"
                        onClick={async () => setDiff(await get(`/api/versions/${v.parentVersionId}/diff/${v.id}`))}
                      >
                        {t("targets.diff")}
                      </a>
                    )}
                    {v.id !== target.activeVersionId && (
                      <BusyButton
                        label={t("targets.activate")}
                        className="btn-secondary !h-6 !px-2 !text-[12px]"
                        onClick={async () => {
                          await post(`/api/targets/${id}/activate`, { versionId: v.id });
                          reload();
                        }}
                      />
                    )}
                  </span>,
                ])}
            />
            {diff && (
              <div className="mt-3">
                <div className="caption mb-1">{t("targets.diffTitle", { a: diff.a.version, b: diff.b.version })}</div>
                <div className="border border-border rounded-md overflow-hidden py-1 bg-code max-h-96 overflow-y-auto">
                  {diff.diff.map((l: any, i: number) => (
                    <span key={i} className={`diff-line ${l.type === "add" ? "diff-add" : l.type === "del" ? "diff-del" : ""}`}>
                      {l.text || " "}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>

        {active && (
          <Card title={t("targets.activeContent", { version: active.version })}>
            <pre className="codeblock max-h-80 overflow-y-auto">{active.content}</pre>
          </Card>
        )}

        <Card title={t("targets.suggestions")}>
          {suggestions.length === 0 ? (
            <p className="caption py-2">{t("targets.emptySuggestions")}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {suggestions.map((s: any) => (
                <div key={s.id} className="border border-border rounded-md p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className={s.status === "accepted" ? "chip-pass" : s.status === "rejected" ? "chip-fail" : "chip-warn"}>
                      {tv("status", s.status)}
                    </span>
                    <span className="caption">{fmtTime(s.createdAt)}</span>
                  </div>
                  <p className="text-[13px] mb-2">{s.rationale}</p>
                  <details>
                    <summary className="caption cursor-pointer">{t("targets.proposedContent")}</summary>
                    <pre className="codeblock mt-1 max-h-60 overflow-y-auto">{s.proposedContent}</pre>
                  </details>
                  {s.status === "proposed" && (
                    <div className="flex gap-2 mt-2">
                      <BusyButton
                        label={t("targets.acceptSuggestion")}
                        onClick={async () => {
                          await post(`/api/suggestions/${s.id}/accept`);
                          reload();
                        }}
                      />
                      <BusyButton
                        label={t("targets.rejectSuggestion")}
                        className="btn-danger"
                        onClick={async () => {
                          await post(`/api/suggestions/${s.id}/reject`);
                          reload();
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card
            title={t("targets.sampleSets")}
            action={
              <a className="link text-[13px]" href="#/samples/new">
                {t("common.new")}
              </a>
            }
          >
            {sampleSets.length === 0 ? (
              <p className="caption py-2">{t("common.noneYet")}</p>
            ) : (
              <Table
                headers={[t("table.name"), t("table.samples")]}
                rows={sampleSets.map((s: any) => [
                  <a className="link" href={`#/samples/${s.id}`}>
                    {s.name}
                  </a>,
                  <span className="mono">{s.samples}</span>,
                ])}
              />
            )}
          </Card>
          <Card
            title={t("targets.experiments")}
            action={
              <a className="link text-[13px]" href="#/experiments/new">
                {t("common.new")}
              </a>
            }
          >
            {experiments.length === 0 ? (
              <p className="caption py-2">{t("common.noneYet")}</p>
            ) : (
              <Table
                headers={[t("table.name"), t("table.mode"), t("table.status")]}
                rows={experiments.map((e: any) => [
                  <a className="link" href={`#/experiments/${e.id}`}>
                    {e.name}
                  </a>,
                  <span className="chip-neutral">{e.mode}</span>,
                  <span className="caption">{tv("status", e.status)}</span>,
                ])}
              />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
