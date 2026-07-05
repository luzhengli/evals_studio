// Attribution reports: root cause + counterfactual matrix + trace locus +
// fix recommendation, per failing case.

import { get } from "../api.ts";
import { t, tv } from "../i18n.ts";
import { Card, CauseChip, EmptyState, ErrorBox, Help, PageHeader, PassChip, Table, fmtTime, useLoad } from "../ui.tsx";

export function Attributions() {
  const { data: attrs, error } = useLoad(() => get("/api/attributions"));
  if (error) return <ErrorBox message={error} />;
  if (!attrs) return null;

  return (
    <>
      <PageHeader
        title={
          <>
            {t("attribution.title")}
            <Help k="concept.counterfactual" />
          </>
        }
      />
      <p className="caption mb-4 -mt-2">{t("attribution.subtitle")}</p>

      {attrs.length === 0 ? (
        <EmptyState
          message={t("attribution.empty")}
          action={
            <a className="btn-primary" href="#/experiments">
              {t("attribution.experimentsBtn")}
            </a>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {attrs.map((a: any) => (
            <Card
              key={a.id}
              title={
                <>
                  <CauseChip cause={a.rootCause} />
                  <span>{a.sampleName}</span>
                  <span className="chip-neutral">{t("attribution.fixLayer", { layer: tv("fixLayer", a.fixLayer) })}</span>
                </>
              }
              action={<span className="caption">{fmtTime(a.createdAt)}</span>}
            >
              <p className="caption mb-3">
                {t("attribution.experimentLabel")}
                <a className="link" href={`#/experiments/${a.experimentId}`}>
                  {a.experimentName}
                </a>
                {" · "}
                <a className="link" href={`#/runs/${a.runId}`}>
                  {a.traceStepIndex != null ? t("attribution.traceStep", { index: a.traceStepIndex }) : t("attribution.viewTrace")}
                </a>
              </p>
              {a.counterfactuals.length > 0 ? (
                <Table
                  headers={[t("attribution.colIntervention"), t("attribution.colFlipped"), t("common.evidence")]}
                  rows={a.counterfactuals.map((c: any) => [
                    <span className="mono">{c.intervention}</span>,
                    c.applied ? (
                      <PassChip pass={c.outcomeFlipped} label={c.outcomeFlipped ? t("attribution.flipped") : t("attribution.stillFails")} />
                    ) : (
                      <span className="chip-neutral">{t("attribution.notApplied")}</span>
                    ),
                    <span className="caption">{c.evidence}</span>,
                  ])}
                />
              ) : (
                <p className="caption">{t("attribution.noReplay")}</p>
              )}
              <div className="mt-3 rounded-md border border-border bg-primary-dim/40 p-3">
                <div className="text-[12px] font-semibold text-primary mb-1">{t("attribution.recommendedFix")}</div>
                <p className="text-[13px]">{a.recommendation}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
