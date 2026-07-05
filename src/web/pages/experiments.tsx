import { useEffect, useState } from "react";
import { get, post } from "../api.ts";
import { t, tv } from "../i18n.ts";
import {
  BusyButton,
  Card,
  CauseChip,
  EmptyState,
  ErrorBox,
  Field,
  Help,
  MetricTile,
  PageHeader,
  PassChip,
  PassKChip,
  StatusChip,
  Table,
  TypeChip,
  fmtNum,
  fmtTime,
  useLoad,
} from "../ui.tsx";

export function Experiments() {
  const { data: exps, error } = useLoad(() => get("/api/experiments"));
  if (error) return <ErrorBox message={error} />;
  if (!exps) return null;

  return (
    <>
      <PageHeader title={t("experiments.title")}>
        <a className="btn-primary" href="#/experiments/new">
          {t("common.newExperiment")}
        </a>
      </PageHeader>
      {exps.length === 0 ? (
        <EmptyState
          message={t("experiments.empty")}
          action={
            <a className="btn-primary" href="#/experiments/new">
              {t("common.newExperiment")}
            </a>
          }
        />
      ) : (
        <Card>
          <Table
            headers={[t("table.experiment"), t("table.target"), t("table.mode"), t("table.status"), "pass^k", t("table.gate"), t("table.created")]}
            rows={exps.map((e: any) => {
              const cand = e.benchmark?.arms?.find((a: any) => a.arm === "candidate" || a.arm === "with-skill");
              return [
                <a className="link font-medium" href={`#/experiments/${e.id}`}>
                  {e.name}
                </a>,
                <span className="flex items-center gap-1.5">
                  {e.targetName} <TypeChip type={e.targetType ?? "prompt"} />
                </span>,
                <span className="chip-neutral">{e.mode}</span>,
                <StatusChip status={e.status} />,
                cand ? <PassKChip k={cand.k} stat={cand.passK} /> : "–",
                e.benchmark?.gate ? (
                  <PassChip pass={e.benchmark.gate.pass} label={e.benchmark.gate.pass ? t("common.gatePass") : t("common.gateFail")} />
                ) : (
                  "–"
                ),
                <span className="caption">{fmtTime(e.createdAt)}</span>,
              ];
            })}
          />
        </Card>
      )}
    </>
  );
}

export function ExperimentNew() {
  const { data, error } = useLoad(async () => {
    const [targets, engines] = await Promise.all([get("/api/targets"), get("/api/engines")]);
    return { targets, engines };
  });
  const [form, setForm] = useState({
    name: "",
    targetId: "",
    versionId: "",
    baselineId: "",
    setId: "",
    engineId: "",
    mode: "single",
    k: "3",
    judgeId: "mock-judge",
  });
  const [detail, setDetail] = useState<any>(null);

  const targetId = form.targetId || data?.targets[0]?.id || "";
  useEffect(() => {
    if (!targetId) return;
    get(`/api/targets/${targetId}`).then((d) => {
      setDetail(d);
      setForm((f) => ({
        ...f,
        versionId: d.target.activeVersionId ?? d.versions[d.versions.length - 1]?.id ?? "",
        setId: d.sampleSets[0]?.id ?? "",
        mode: "single",
      }));
    });
  }, [targetId]);

  if (error) return <ErrorBox message={error} />;
  if (!data) return null;
  const { targets, engines } = data;
  if (targets.length === 0)
    return (
      <>
        <PageHeader title={t("experiments.newTitle")} />
        <EmptyState message={t("experiments.createTargetFirst")} action={<a className="btn-primary" href="#/targets">{t("experiments.targetsBtn")}</a>} />
      </>
    );
  if (engines.length === 0)
    return (
      <>
        <PageHeader title={t("experiments.newTitle")} />
        <EmptyState message={t("experiments.configureEngineFirst")} action={<a className="btn-primary" href="#/settings">{t("experiments.settingsBtn")}</a>} />
      </>
    );

  const tg = targets.find((x: any) => x.id === targetId);
  const setF = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const versions = detail?.versions.slice().reverse() ?? [];

  return (
    <>
      <PageHeader title={t("experiments.newTitle")} />
      <Card>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="col-span-2">
            <Field label={t("experiments.name")}>
              <input className="inp" placeholder={t("experiments.namePh")} value={form.name} onChange={(e) => setF("name", e.target.value)} />
            </Field>
          </div>
          <Field label={t("experiments.target")}>
            <select className="inp" value={targetId} onChange={(e) => setF("targetId", e.target.value)}>
              {targets.map((x: any) => (
                <option key={x.id} value={x.id}>
                  {x.name} ({tv("type", x.type)})
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("experiments.sampleSet")}>
            <select className="inp" value={form.setId} onChange={(e) => setF("setId", e.target.value)}>
              {(detail?.sampleSets ?? []).map((s: any) => (
                <option key={s.id} value={s.id}>
                  {t("experiments.samplesSuffix", { name: s.name, count: s.samples })}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("experiments.candidateVersion")}>
            <select className="inp" value={form.versionId} onChange={(e) => setF("versionId", e.target.value)}>
              {versions.map((v: any) => (
                <option key={v.id} value={v.id}>
                  v{v.version}
                  {v.id === detail?.target.activeVersionId ? t("experiments.activeSuffix") : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("experiments.baselineVersion")}>
            <select className="inp" value={form.baselineId} onChange={(e) => setF("baselineId", e.target.value)}>
              <option value="">{t("experiments.noBaseline")}</option>
              {versions.map((v: any) => (
                <option key={v.id} value={v.id}>
                  v{v.version}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("experiments.engine")}>
            <select className="inp" value={form.engineId || engines[0].id} onChange={(e) => setF("engineId", e.target.value)}>
              {engines.map((e2: any) => (
                <option key={e2.id} value={e2.id}>
                  {e2.name} ({e2.kind})
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("experiments.mode")}>
            <select className="inp" value={form.mode} onChange={(e) => setF("mode", e.target.value)}>
              <option value="single">{t("experiments.modeSingle")}</option>
              {tg?.type === "prompt" ? (
                <option value="ab-prompt">{t("experiments.modeAbPrompt")}</option>
              ) : (
                <option value="ab-skill">{t("experiments.modeAbSkill")}</option>
              )}
            </select>
          </Field>
          <Field
            label={
              <>
                {t("experiments.kLabel")}
                <Help k="concept.passk" />
              </>
            }
            hint={t("experiments.kHint")}
          >
            <input className="inp" type="number" min={1} max={10} value={form.k} onChange={(e) => setF("k", e.target.value)} />
          </Field>
          <Field label={t("experiments.judge")} hint={t("experiments.judgeHint")}>
            <input className="inp" value={form.judgeId} onChange={(e) => setF("judgeId", e.target.value)} />
          </Field>
        </div>
        <BusyButton
          label={t("experiments.createAndRun")}
          onClick={async () => {
            const exp = await post("/api/experiments", {
              name: form.name.trim() || t("experiments.untitled"),
              targetId,
              targetVersionId: form.versionId,
              baselineVersionId: form.mode === "ab-prompt" ? form.baselineId || null : null,
              sampleSetId: form.setId,
              engineId: form.engineId || engines[0].id,
              mode: form.mode,
              k: Number(form.k),
              judgeId: form.judgeId.trim() || "mock-judge",
            });
            await post(`/api/experiments/${exp.id}/run`);
            location.hash = `#/experiments/${exp.id}`;
          }}
        />
      </Card>
    </>
  );
}

// ---- analyses section on the experiment page ----

function AnalysesSection({ expId, hasAttributions, reload }: { expId: string; hasAttributions: boolean; reload: () => void }) {
  const { data, error } = useLoad(
    async () => ({ tasks: await get(`/api/experiments/${expId}/analyses`), agents: await get("/api/agents") }),
    [expId]
  );
  const [agentId, setAgentId] = useState("");
  const [name, setName] = useState("");
  if (error || !data) return null;
  const { tasks, agents } = data;

  return (
    <Card title={t("analysis.title")}>
      {tasks.length > 0 && (
        <Table
          headers={[t("table.name"), t("table.agent"), t("table.status"), t("table.progress"), t("table.created")]}
          rows={tasks.map((task: any) => [
            <span className="font-medium">{task.name}</span>,
            <span className="chip-neutral">{task.agentName}</span>,
            <StatusChip status={task.status} />,
            <span className="mono">{t("analysis.progress", { done: task.done, total: task.total })}</span>,
            <span className="caption">{fmtTime(task.createdAt)}</span>,
          ])}
        />
      )}
      {hasAttributions ? (
        agents.length === 0 ? (
          <p className="caption py-2">
            {t("analysis.noAgents")} —{" "}
            <a className="link" href="#/agents">
              {t("analysis.agentsBtn")}
            </a>
          </p>
        ) : (
          <div className="flex items-end gap-2 mt-3">
            <Field label={t("analysis.chooseAgent")} hint={t("analysis.itemsHint")}>
              <select className="inp !w-56" value={agentId || agents[0].id} onChange={(e) => setAgentId(e.target.value)}>
                {agents.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <input className="inp !w-56" placeholder={t("analysis.namePh")} value={name} onChange={(e) => setName(e.target.value)} />
            <BusyButton
              label={t("analysis.new")}
              onClick={async () => {
                await post(`/api/experiments/${expId}/analyses`, { agentId: agentId || agents[0].id, name });
                reload();
              }}
            />
          </div>
        )
      ) : null}
    </Card>
  );
}

export function ExperimentDetail({ id }: { id: string }) {
  const { data: d, error, reload } = useLoad(() => get(`/api/experiments/${id}`), [id]);
  if (error) return <ErrorBox message={error} />;
  if (!d) return null;
  const { experiment: exp, target, benchmark, runs, attributions } = d;
  const failedFirst = runs.slice().sort((a: any, b: any) => Number(a.grading.pass) - Number(b.grading.pass));

  return (
    <>
      <PageHeader
        title={
          <>
            {exp.name} <StatusChip status={exp.status} />
          </>
        }
      >
        {exp.status !== "running" && (
          <BusyButton
            label={exp.status === "done" ? t("experiments.rerun") : t("experiments.run")}
            className="btn-secondary"
            onClick={async () => {
              await post(`/api/experiments/${id}/run`);
              reload();
            }}
          />
        )}
        {exp.status === "done" && (
          <BusyButton
            label={t("experiments.runAttribution")}
            onClick={async () => {
              await post(`/api/experiments/${id}/attribute`);
              reload();
            }}
          />
        )}
        {exp.status === "done" && (
          <BusyButton
            label={t("reports.generate")}
            className="btn-secondary"
            onClick={async () => {
              const r = await post("/api/reports", { experimentId: id });
              location.hash = `#/reports/${r.id}`;
            }}
          />
        )}
        {exp.status === "done" && (
          <BusyButton
            label={t("experiments.exportBenchmark")}
            className="btn-secondary"
            onClick={async () => {
              const r = await post(`/api/experiments/${id}/pipeline`);
              alert(t("experiments.exportDone", { outDir: r.outDir, gate: r.gatePass ? t("common.pass") : t("common.fail") }));
            }}
          />
        )}
      </PageHeader>
      <p className="caption mb-4 -mt-2">
        {t("experiments.detailTarget")}
        <a className="link" href={`#/targets/${exp.targetId}`}>
          {target?.name ?? "?"}
        </a>
        {t("experiments.detailMeta", { mode: exp.mode, k: exp.evalConfig.k, judge: exp.evalConfig.judgeId })}
      </p>

      <div className="flex flex-col gap-4">
        {benchmark?.arms.map((arm: any) => (
          <Card
            key={arm.arm}
            title={
              <>
                {t("experiments.armTitle")}
                {tv("arm", arm.arm)} <PassKChip k={arm.k} stat={arm.passK} />
              </>
            }
            action={
              <span className="caption">
                {t("experiments.armMeta", { samples: arm.samples, ms: fmtNum(arm.timeMs.mean, 0), tokens: fmtNum(arm.tokens.mean, 0) })}
              </span>
            }
          >
            <div className="grid grid-cols-5 gap-3">
              <MetricTile name={`pass^${arm.k}`} stat={arm.passK} />
              {Object.entries(arm.perMetric).map(([name, stat]: [string, any]) => (
                <MetricTile key={name} name={name} stat={stat} />
              ))}
            </div>
          </Card>
        ))}

        {benchmark?.gate && (
          <Card
            title={
              <>
                {t("experiments.regressionGate")}
                <Help k="concept.gate" />
                <PassChip pass={benchmark.gate.pass} label={benchmark.gate.pass ? t("common.pass") : t("experiments.gateFailBlocked")} />
              </>
            }
            action={<span className="caption">ε={benchmark.gate.epsilon}</span>}
          >
            <Table
              headers={[t("table.metric"), t("table.candidate"), t("table.baseline"), "Δ", t("table.verdict")]}
              rows={benchmark.gate.checks.map((c: any) => [
                <span className="mono">{c.metric}</span>,
                <span className="mono">{fmtNum(c.candidate)}</span>,
                <span className="mono">{fmtNum(c.baseline)}</span>,
                <span className={`mono font-medium ${c.delta >= 0 ? "text-pass" : "text-fail"}`}>
                  {c.delta >= 0 ? "+" : ""}
                  {fmtNum(c.delta, 4)}
                </span>,
                <PassChip pass={c.pass} />,
              ])}
            />
            <p className={`caption mt-2 ${benchmark.gate.pass ? "" : "text-fail"}`}>{benchmark.gate.summary}</p>
          </Card>
        )}

        {attributions.length > 0 && (
          <Card
            title={
              <>
                {t("experiments.attributions")}
                <Help k="concept.counterfactual" />
              </>
            }
            action={
              <a className="link text-[13px]" href="#/attribution">
                {t("experiments.fullReports")}
              </a>
            }
          >
            <div className="flex gap-2 flex-wrap">
              {attributions.map((a: any) => (
                <CauseChip key={a.id} cause={a.rootCause} />
              ))}
            </div>
            {exp.status === "done" && (
              <div className="mt-3">
                <BusyButton
                  label={t("experiments.generateSuggestion")}
                  onClick={async () => {
                    await post(`/api/targets/${exp.targetId}/suggest`, { experimentId: id });
                    location.hash = `#/targets/${exp.targetId}`;
                  }}
                />
              </div>
            )}
          </Card>
        )}

        {exp.status === "done" && <AnalysesSection expId={id} hasAttributions={attributions.length > 0} reload={reload} />}

        <Card title={t("experiments.runsTitle", { count: runs.length })}>
          <Table
            headers={[
              t("table.samples"),
              t("table.arm"),
              t("table.attempt"),
              t("table.verdict"),
              t("table.error"),
              t("table.failedAssertions"),
              t("table.skill"),
              t("table.trace"),
            ]}
            rows={failedFirst.map((r: any) => [
              <span className="font-medium">{r.sampleName}</span>,
              <span className="chip-neutral">{tv("arm", r.arm)}</span>,
              <span className="mono">{r.attempt}</span>,
              <PassChip pass={r.grading.pass} />,
              r.error ? (
                <span className="chip-fail mono" title={r.error}>
                  {r.error.slice(0, 40)}
                </span>
              ) : (
                "–"
              ),
              <span className="caption">
                {r.grading.assertions
                  .filter((a: any) => !a.pass)
                  .map((a: any) => a.name)
                  .join(", ") || "–"}
              </span>,
              <span className="mono caption">{r.selectedSkill ?? "–"}</span>,
              <a className="link" href={`#/runs/${r.id}`}>
                {t("experiments.viewTrace")}
              </a>,
            ])}
          />
        </Card>
      </div>
    </>
  );
}
