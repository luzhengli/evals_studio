// Run detail — the full execution chain for one question:
// sample → run → time-ordered trace → grading → attribution → agent analysis.

import { useState } from "react";
import { get } from "../api.ts";
import { t, tv } from "../i18n.ts";
import {
  Card,
  CauseChip,
  ErrorBox,
  Help,
  PageHeader,
  PassChip,
  SeverityChip,
  Table,
  fmtClock,
  fmtNum,
  useLoad,
} from "../ui.tsx";

const STEP_COLORS: Record<string, string> = {
  llm: "#1a73e8",
  "tool-call": "#188038",
  routing: "#7b1fa2",
  state: "#5f6368",
  "side-effect": "#e37400",
};

function SeRow({ label, e }: { label: string; e: { pass: boolean; evidence: string } }) {
  return (
    <div className="flex items-start gap-2">
      <PassChip pass={e.pass} />
      <div>
        <div className="text-[13px] font-medium">{label}</div>
        <div className="caption">{e.evidence}</div>
      </div>
    </div>
  );
}

function Timeline({ steps }: { steps: any[] }) {
  const [cursor, setCursor] = useState(-1); // -1 = show all

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <button className="btn-secondary" onClick={() => setCursor(-1)}>
          {t("run.showAll")}
        </button>
        <button className="btn-secondary" onClick={() => setCursor((c) => Math.max(0, c <= 0 ? 0 : c - 1))}>
          {t("run.prev")}
        </button>
        <button className="btn-primary" onClick={() => setCursor((c) => Math.min(steps.length - 1, c + 1))}>
          {t("run.step")}
        </button>
        <span className="caption">
          {t("run.stepsHint", { count: steps.length })}
          <Help k="concept.traceStep" />
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {steps.map((s: any, i: number) => {
          const visible = cursor === -1 || i <= cursor;
          const expanded = visible && (cursor === -1 || i === cursor);
          const color = STEP_COLORS[s.type] ?? "#5f6368";
          const hasError = Boolean(s.error) || String(s.output ?? "").startsWith("ERROR");
          return (
            <div key={i} className={`trace-step ${i === cursor ? "active" : ""} ${visible ? "" : "opacity-25"} ${hasError ? "!border-fail" : ""}`}>
              <div className="flex items-center gap-2 px-3 py-2 cursor-pointer" onClick={() => setCursor(i)}>
                <span className="chip" style={{ background: `${color}1a`, color }}>
                  {s.type}
                </span>
                <span className="text-[13px] font-medium flex-1">{s.name}</span>
                {hasError && <span className="chip-fail">{t("common.fail")}</span>}
                {s.skillSelected != null && <span className="chip-warn mono">{s.skillSelected}</span>}
                {s.tokens && (
                  <span className="caption mono">
                    {s.tokens.input + s.tokens.output} tok
                  </span>
                )}
                {s.startedAt != null && <span className="caption mono">{fmtClock(s.startedAt)}</span>}
                <span className="caption mono">{s.durationMs}ms</span>
              </div>
              {expanded && (
                <div className="px-3 pb-3 flex flex-col gap-2">
                  {s.error && <div className="codeblock !text-fail">{s.error}</div>}
                  {s.effectivePrompt && (
                    <details>
                      <summary className="caption cursor-pointer">{t("run.effectivePrompt")}</summary>
                      <pre className="codeblock mt-1 max-h-48 overflow-y-auto">{s.effectivePrompt}</pre>
                    </details>
                  )}
                  {s.input && (
                    <div>
                      <div className="caption">{t("common.input")}</div>
                      <pre className="codeblock">{s.input}</pre>
                    </div>
                  )}
                  {s.output && (
                    <div>
                      <div className="caption">{t("common.output")}</div>
                      <pre className={`codeblock ${String(s.output).startsWith("ERROR") ? "!text-fail" : ""}`}>{s.output}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

export function RunDetail({ id }: { id: string }) {
  const { data: d, error } = useLoad(() => get(`/api/runs/${id}`), [id]);
  if (error) return <ErrorBox message={error} />;
  if (!d) return null;
  const { run, sample, trace, stepErrors, attribution, findings } = d;
  const steps = trace?.steps ?? [];

  return (
    <>
      <PageHeader
        title={
          <>
            {t("run.title", { sample: sample?.name ?? run.sampleId })} <PassChip pass={run.grading.pass} />
          </>
        }
      >
        <a className="btn-secondary" href={`#/experiments/${run.experimentId}`}>
          {t("run.backToExperiment")}
        </a>
      </PageHeader>
      <p className="caption mb-2 -mt-2">
        {t("run.meta", { arm: tv("arm", run.arm), attempt: run.attempt, ms: run.timing.durationMs, tokens: run.tokens.input + run.tokens.output }) +
          (run.selectedSkill ? t("run.metaSkill", { skill: run.selectedSkill }) : "")}
        {" · "}
        <span title={t("run.chainHint")}>{t("run.chain")}: {t("run.chainHint")}</span>
      </p>

      {run.error && <div className="mb-3 rounded-md border border-fail bg-fail-dim p-3 text-[13px] text-fail font-medium">{t("run.errorBanner", { error: run.error })}</div>}
      {stepErrors.length > 0 && !run.error && (
        <div className="mb-3 rounded-md border border-warn bg-warn-dim p-3 text-[13px] text-warn font-medium">
          {t("run.stepErrors", { count: stepErrors.length })} — {stepErrors.map((e: any) => `#${e.index} ${e.name}`).join(", ")}
        </div>
      )}

      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-2 flex flex-col gap-4">
          <Card title={t("run.grading")}>
            <Table
              headers={[t("table.assertion"), t("table.metric"), t("table.score"), t("table.verdict")]}
              rows={run.grading.assertions.map((a: any) => [
                <span title={a.evidence}>{a.name}</span>,
                <span className="caption">{tv("metric", a.metric) === a.metric ? a.metric.replaceAll("_", " ") : tv("metric", a.metric)}</span>,
                <span className="mono">{fmtNum(a.score)}</span>,
                <PassChip pass={a.pass} />,
              ])}
            />
            <details className="mt-2">
              <summary className="caption cursor-pointer">{t("common.evidence")}</summary>
              {run.grading.assertions.map((a: any) => (
                <div key={a.name} className="mt-2">
                  <div className="caption font-medium">{a.name}</div>
                  <pre className="codeblock">{a.evidence}</pre>
                </div>
              ))}
            </details>
          </Card>

          {run.grading.sideEffect && (
            <Card
              title={
                <>
                  {t("run.sideEffects")}
                  <Help k="concept.sideEffect3" />
                </>
              }
            >
              <div className="flex flex-col gap-2">
                <SeRow label={t("run.seL1")} e={run.grading.sideEffect.semanticAcceptance} />
                <SeRow label={t("run.seL2")} e={run.grading.sideEffect.auditEvidence} />
                <SeRow label={t("run.seL3")} e={run.grading.sideEffect.sandboxHarm} />
              </div>
              <p className="caption mt-2">{t("run.seNote")}</p>
            </Card>
          )}

          {attribution && (
            <Card
              title={
                <>
                  {t("run.attributionCard")}
                  <Help k="concept.counterfactual" />
                </>
              }
            >
              <div className="flex items-center gap-2 mb-2">
                <CauseChip cause={attribution.rootCause} />
                <span className="chip-neutral">{t("attribution.fixLayer", { layer: tv("fixLayer", attribution.fixLayer) })}</span>
              </div>
              <p className="text-[13px]">{attribution.recommendation}</p>
            </Card>
          )}

          {findings.length > 0 && (
            <Card title={t("run.findingsCard")}>
              <div className="flex flex-col gap-2">
                {findings.map((f: any, i: number) => (
                  <div key={i} className="border border-border rounded-md p-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <SeverityChip severity={f.severity} />
                      <span className="text-[13px] font-medium">{f.agentName}</span>
                      <span className={f.agreesWithRootCause ? "chip-pass" : "chip-warn"}>
                        {f.agreesWithRootCause ? t("analysis.agrees") : t("analysis.disputes")}
                      </span>
                    </div>
                    <p className="caption">{f.notes}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card title={t("run.output")}>
            <pre className="codeblock max-h-64 overflow-y-auto">{run.output || t("run.emptyOutput")}</pre>
          </Card>
        </div>

        <div className="col-span-3">
          <Card title={t("run.timeline")}>{steps.length === 0 ? <p className="caption py-2">{t("run.noTrace")}</p> : <Timeline steps={steps} />}</Card>
        </div>
      </div>
    </>
  );
}
