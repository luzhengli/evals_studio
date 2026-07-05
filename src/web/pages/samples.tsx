import { useState } from "react";
import { get, post } from "../api.ts";
import { t, tv } from "../i18n.ts";
import {
  BusyButton,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  Help,
  PageHeader,
  StatusChip,
  Table,
  TagChips,
  TierChip,
  TypeChip,
  fmtTime,
  useLoad,
} from "../ui.tsx";

export function SampleSets() {
  const { data: sets, error } = useLoad(() => get("/api/sample-sets"));
  if (error) return <ErrorBox message={error} />;
  if (!sets) return null;

  return (
    <>
      <PageHeader title={t("samples.title")}>
        <a className="btn-primary" href="#/samples/new">
          {t("samples.new")}
        </a>
      </PageHeader>
      {sets.length === 0 ? (
        <EmptyState
          message={t("samples.empty")}
          action={
            <a className="btn-primary" href="#/samples/new">
              {t("samples.startWizard")}
            </a>
          }
        />
      ) : (
        <Card>
          <Table
            headers={[t("table.name"), t("table.target"), t("table.type"), t("table.samples"), t("table.goal")]}
            rows={sets.map((s: any) => [
              <a className="link font-medium" href={`#/samples/${s.id}`}>
                {s.name}
              </a>,
              s.targetName,
              <TypeChip type={s.targetType ?? "prompt"} />,
              <span className="mono">{s.samples}</span>,
              <span className="caption">{s.goal || "–"}</span>,
            ])}
          />
        </Card>
      )}
    </>
  );
}

// ---- wizard: goal → scenario → cases → fields ----

export function SampleSetWizard() {
  const { data: targets, error } = useLoad(() => get("/api/targets"));
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ targetId: "", name: "", goal: "", scenario: "", description: "" });
  const [cases, setCases] = useState<{ name: string; input: string }[]>([]);
  if (error) return <ErrorBox message={error} />;
  if (!targets) return null;
  if (targets.length === 0)
    return (
      <>
        <PageHeader title={t("samples.wizardTitle")} />
        <EmptyState
          message={t("samples.createTargetFirst")}
          action={
            <a className="btn-primary" href="#/targets">
              {t("samples.goToTargets")}
            </a>
          }
        />
      </>
    );

  const targetId = form.targetId || targets[0].id;
  const STEPS = [t("samples.stepGoal"), t("samples.stepScenario"), t("samples.stepCases"), t("samples.stepFields")];
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <PageHeader title={t("samples.wizardTitle")} />
      <Card>
        <div className="flex items-center gap-2 mb-5">
          {STEPS.map((s, i) => (
            <span key={s} className="flex items-center gap-2">
              <span className={`step-dot ${i === step ? "active" : i < step ? "done" : ""}`}>{i < step ? "✓" : i + 1}</span>
              <span className={`text-[13px] ${i === step ? "font-semibold" : "text-ink-2"}`}>{s}</span>
              {i < STEPS.length - 1 && <span className="w-6 h-px bg-border" />}
            </span>
          ))}
        </div>

        <div className="flex flex-col gap-3 mb-4">
          {step === 0 && (
            <>
              <Field label={t("samples.attachTarget")} hint={t("samples.attachTargetHint")}>
                <select className="inp" value={targetId} onChange={(e) => set("targetId", e.target.value)}>
                  {targets.map((tg: any) => (
                    <option key={tg.id} value={tg.id}>
                      {tg.name} ({tv("type", tg.type)})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("samples.setName")}>
                <input className="inp" placeholder={t("samples.setNamePh")} value={form.name} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <Field label={t("samples.goalLabel")}>
                <textarea className="inp" placeholder={t("samples.goalPh")} value={form.goal} onChange={(e) => set("goal", e.target.value)} />
              </Field>
            </>
          )}
          {step === 1 && (
            <>
              <Field label={t("samples.scenarioLabel")} hint={t("samples.scenarioHint")}>
                <textarea className="inp" placeholder={t("samples.scenarioPh")} value={form.scenario} onChange={(e) => set("scenario", e.target.value)} />
              </Field>
              <Field label={t("samples.descriptionLabel")}>
                <input className="inp" placeholder={t("samples.descriptionPh")} value={form.description} onChange={(e) => set("description", e.target.value)} />
              </Field>
            </>
          )}
          {step === 2 && (
            <>
              <p className="caption">{t("samples.casesHint")}</p>
              <p className="caption">{t("samples.methodology")}</p>
              <div className="flex flex-col gap-2">
                {cases.map((c, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <input
                      className="inp !w-56"
                      value={c.name}
                      placeholder={t("samples.caseNamePh")}
                      onChange={(e) => setCases(cases.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                    />
                    <textarea
                      className="inp flex-1 !min-h-9"
                      value={c.input}
                      placeholder={t("samples.caseInputPh")}
                      onChange={(e) => setCases(cases.map((x, j) => (j === i ? { ...x, input: e.target.value } : x)))}
                    />
                    <button className="btn-danger" onClick={() => setCases(cases.filter((_, j) => j !== i))}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button className="btn-secondary self-start" onClick={() => setCases([...cases, { name: "", input: "" }])}>
                {t("samples.addCase")}
              </button>
            </>
          )}
          {step === 3 && (
            <>
              <p className="text-[13px]">{t("samples.fieldsNote")}</p>
              <div className="codeblock">
                {t("samples.summary", {
                  name: form.name,
                  target: targets.find((tg: any) => tg.id === targetId)?.name ?? "?",
                  goal: form.goal,
                  cases: cases.filter((c) => c.input.trim()).length,
                })}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2">
          {step > 0 && (
            <button className="btn-secondary" onClick={() => setStep(step - 1)}>
              {t("common.back")}
            </button>
          )}
          {step < 3 ? (
            <button
              className="btn-primary"
              onClick={() => {
                if (step === 0 && !form.name.trim()) return alert(t("samples.nameRequired"));
                setStep(step + 1);
              }}
            >
              {t("common.next")}
            </button>
          ) : (
            <BusyButton
              label={t("samples.createSet")}
              onClick={async () => {
                const created = await post("/api/sample-sets", { ...form, targetId });
                for (const c of cases.filter((c) => c.input.trim())) {
                  await post(`/api/sample-sets/${created.id}/samples`, { name: c.name || c.input.slice(0, 40), input: c.input });
                }
                location.hash = `#/samples/${created.id}`;
              }}
            />
          )}
        </div>
      </Card>
    </>
  );
}

// ---- coverage matrix ----

function CoverageMatrix({ setId }: { setId: string }) {
  const { data: cov, error } = useLoad(() => get(`/api/sample-sets/${setId}/coverage`), [setId]);
  if (error || !cov) return null;
  const tiers = ["B", "A", "E", "R"] as const;

  return (
    <Card
      title={
        <>
          {t("coverage.title")}
          <Help k="concept.matrix" />
          <Help k="concept.tiers" />
        </>
      }
      action={<span className="caption">{t("coverage.tagged", { tagged: cov.tagged, total: cov.total })}</span>}
    >
      {cov.capabilities.length === 0 ? (
        <p className="caption py-2">{t("coverage.empty")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `minmax(120px,1fr) repeat(4, minmax(56px, 90px))` }}>
            <div />
            {tiers.map((tier) => (
              <div key={tier} className="caption text-center font-medium">
                {tv("tier", tier)}
              </div>
            ))}
            {cov.capabilities.map((cap: string) => (
              <div key={cap} className="contents">
                <div className="text-[13px] font-medium flex items-center">{cap}</div>
                {tiers.map((tier) => {
                  const cell = cov.cells.find((c: any) => c.capability === cap && c.tier === tier);
                  const n = cell?.count ?? 0;
                  return (
                    <div key={tier} className={`matrix-cell ${n > 0 ? "hit" : "gap"}`}>
                      {n > 0 ? n : "·"}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex gap-4 flex-wrap">
            {cov.tiers.map((d: any) => (
              <span key={d.tier} className="caption mono">
                {d.tier}: {d.count} ({(d.actual * 100).toFixed(0)}% / {t("coverage.target")} {(d.target * 100).toFixed(0)}%)
              </span>
            ))}
          </div>
          {cov.gaps.length === 0 ? (
            <span className="chip-pass self-start">{t("coverage.noGaps")}</span>
          ) : (
            <div>
              <div className="caption font-medium mb-1">
                {t("coverage.gaps")} · {t("coverage.nextTier", { tier: cov.nextTier })}
              </div>
              <ul className="list-disc ml-5 text-[12.5px] text-ink-2">
                {cov.gaps.map((g: any, i: number) => (
                  <li key={i} className={g.kind === "empty-cell" ? "" : "text-warn"}>
                    {g.detail}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ---- analysis progress on the set page ----

function AnalysisProgress({ setId }: { setId: string }) {
  const { data: tasks, error } = useLoad(() => get(`/api/sample-sets/${setId}/analyses`), [setId]);
  if (error || !tasks) return null;
  return (
    <Card title={t("samples.analysisProgress")}>
      {tasks.length === 0 ? (
        <p className="caption py-2">{t("samples.noAnalyses")}</p>
      ) : (
        <Table
          headers={[t("table.name"), t("table.agent"), t("table.status"), t("table.progress"), t("table.experiment")]}
          rows={tasks.map((task: any) => [
            <span className="font-medium">{task.name}</span>,
            <span className="chip-neutral">{task.agentName}</span>,
            <StatusChip status={task.status} />,
            <span className="mono">{t("analysis.progress", { done: task.done, total: task.total })}</span>,
            <a className="link" href={`#/experiments/${task.experimentId}`}>
              {task.experimentId}
            </a>,
          ])}
        />
      )}
    </Card>
  );
}

// ---- set detail with sample editor ----

export function SampleSetDetail({ id }: { id: string }) {
  const { data: d, error, reload } = useLoad(() => get(`/api/sample-sets/${id}`), [id]);
  const [form, setForm] = useState({
    name: "",
    input: "",
    groundTruth: "",
    trajectory: "",
    expectedSkill: "",
    sideEffects: "",
    tag: "happy-path",
    capability: "",
    tier: "",
  });
  if (error) return <ErrorBox message={error} />;
  if (!d) return null;
  const { set: sampleSet, target, samples } = d;
  const isSkill = target?.type === "skill";
  const setF = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <PageHeader title={sampleSet.name}>
        <BusyButton
          label={t("samples.runAudit")}
          className="btn-secondary"
          onClick={async () => {
            await post(`/api/sample-sets/${id}/audit`);
            reload();
          }}
        />
        <a className="btn-primary" href="#/experiments/new">
          {t("common.runExperiment")}
        </a>
      </PageHeader>
      <p className="caption mb-4 -mt-2">
        {t("samples.detailTarget")}
        <a className="link" href={`#/targets/${sampleSet.targetId}`}>
          {target?.name ?? "?"}
        </a>
        {sampleSet.goal ? t("samples.detailGoal", { goal: sampleSet.goal }) : ""}
      </p>

      <div className="flex flex-col gap-4">
        <CoverageMatrix setId={id} />
        <AnalysisProgress setId={id} />

        <Card title={t("samples.listTitle", { count: samples.length })}>
          {samples.length === 0 ? (
            <p className="caption py-2">{t("samples.emptySamples")}</p>
          ) : (
            <Table
              headers={[
                t("table.name"),
                t("table.capability"),
                t("table.tier"),
                t("table.tags"),
                isSkill ? t("table.expectedSkill") : t("table.groundTruth"),
                t("table.contamination"),
                t("table.freshAsOf"),
              ]}
              rows={samples.map((s: any) => [
                <span className="font-medium">{s.name}</span>,
                <span className="caption mono">{s.capability ?? "–"}</span>,
                <TierChip tier={s.tier} />,
                <TagChips tags={s.tags} />,
                <span className="mono caption">
                  {isSkill ? (s.expectedSkill ?? t("samples.mustNotTrigger")) : (s.groundTruth ?? t("samples.judgeGraded"))}
                </span>,
                <ContaminationChip c={s.contamination} />,
                <span className="caption">{fmtTime(s.freshAsOf)}</span>,
              ])}
            />
          )}
        </Card>

        <Card title={t("samples.addTitle")}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Field label={t("table.name")}>
              <input className="inp" placeholder={t("samples.sampleNamePh")} value={form.name} onChange={(e) => setF("name", e.target.value)} />
            </Field>
            <Field label={t("samples.tagLabel")} hint={t("samples.tagHint")}>
              <select className="inp" value={form.tag} onChange={(e) => setF("tag", e.target.value)}>
                {["happy-path", "near-miss", "false-activation", "adversarial"].map((tag) => (
                  <option key={tag} value={tag}>
                    {tv("tag", tag)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("samples.capabilityLabel")}>
              <input className="inp" placeholder={t("samples.capabilityPh")} value={form.capability} onChange={(e) => setF("capability", e.target.value)} />
            </Field>
            <Field
              label={
                <>
                  {t("samples.tierLabel")}
                  <Help k="concept.tiers" />
                </>
              }
            >
              <select className="inp" value={form.tier} onChange={(e) => setF("tier", e.target.value)}>
                <option value="">–</option>
                {["B", "A", "E", "R"].map((tier) => (
                  <option key={tier} value={tier}>
                    {tv("tier", tier)}
                  </option>
                ))}
              </select>
            </Field>
            <div className="col-span-2">
              <Field label={t("samples.inputLabel")}>
                <textarea className="inp" placeholder={t("samples.inputPh")} value={form.input} onChange={(e) => setF("input", e.target.value)} />
              </Field>
            </div>
            <Field label={t("samples.groundTruthLabel")}>
              <input className="inp" placeholder={t("samples.groundTruthPh")} value={form.groundTruth} onChange={(e) => setF("groundTruth", e.target.value)} />
            </Field>
            <Field label={t("samples.trajectoryLabel")}>
              <input className="inp" placeholder={t("samples.trajectoryPh")} value={form.trajectory} onChange={(e) => setF("trajectory", e.target.value)} />
            </Field>
            {isSkill ? (
              <Field label={t("samples.expectedSkillLabel")}>
                <input className="inp" placeholder={t("samples.expectedSkillPh")} value={form.expectedSkill} onChange={(e) => setF("expectedSkill", e.target.value)} />
              </Field>
            ) : (
              <div />
            )}
            <Field label={t("samples.sideEffectsLabel")}>
              <input className="inp" placeholder={t("samples.sideEffectsPh")} value={form.sideEffects} onChange={(e) => setF("sideEffects", e.target.value)} />
            </Field>
          </div>
          <BusyButton
            label={t("samples.addSample")}
            onClick={async () => {
              if (!form.name.trim() || !form.input.trim()) throw new Error(t("samples.addRequired"));
              await post(`/api/sample-sets/${id}/samples`, {
                name: form.name.trim(),
                input: form.input,
                capability: form.capability.trim() || null,
                tier: form.tier || null,
                groundTruth: form.groundTruth.trim() || null,
                expectedTrajectory: form.trajectory
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((action) => ({ action })),
                expectedSkill: form.expectedSkill.trim() || null,
                expectedSideEffects: form.sideEffects
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((s) => {
                    const [kind, ...rest] = s.split(":");
                    return { kind, locus: rest.join(":"), allowed: true };
                  }),
                tags: [form.tag],
                source: form.tag === "happy-path" ? "manual" : "adversarial",
              });
              setForm({ ...form, name: "", input: "", groundTruth: "", trajectory: "", expectedSkill: "", sideEffects: "" });
              reload();
            }}
          />
        </Card>
      </div>
    </>
  );
}

function ContaminationChip({ c }: { c: any }) {
  if (!c?.audited) return <span className="chip-neutral">{tv("contamination", "unaudited")}</span>;
  const cls = c.verdict === "clean" ? "chip-pass" : c.verdict === "suspect" ? "chip-warn" : "chip-fail";
  return (
    <span className={cls} title={c.notes ?? ""}>
      {tv("contamination", c.verdict)}
    </span>
  );
}
