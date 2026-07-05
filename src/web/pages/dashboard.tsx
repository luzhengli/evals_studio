import { get } from "../api.ts";
import { t, tv } from "../i18n.ts";
import {
  Card,
  CauseChip,
  ErrorBox,
  PageHeader,
  PassKChip,
  ROOT_CAUSE_COLORS,
  StatusChip,
  Table,
  fmtTime,
  useLoad,
} from "../ui.tsx";

function Stat({ label, value, sub }: { label: string; value: number | string; sub: string }) {
  return (
    <Card>
      <div className="caption">{label}</div>
      <div className="mono text-[26px] font-semibold leading-tight">{String(value)}</div>
      <div className="caption truncate">{sub}</div>
    </Card>
  );
}

export function Dashboard() {
  const { data: o, error } = useLoad(() => get("/api/overview"));
  if (error) return <ErrorBox message={error} />;
  if (!o) return null;

  const causes = Object.entries(o.causeCounts as Record<string, number>).sort((a, b) => b[1] - a[1]);
  const total = causes.reduce((a, [, c]) => a + c, 0);
  const top = causes[0] ?? null;

  return (
    <>
      <PageHeader title={t("dashboard.title")} />
      <div className="grid grid-cols-4 gap-3 mb-4">
        <Stat label={t("dashboard.statTargets")} value={o.targets} sub={t("dashboard.statTargetsSub", { prompts: o.prompts, skills: o.skills })} />
        <Stat label={t("dashboard.statExperiments")} value={o.experiments} sub={t("dashboard.statExperimentsSub", { done: o.experimentsDone })} />
        <Stat label={t("dashboard.statAttributions")} value={o.attributions} sub={t("dashboard.statAttributionsSub")} />
        <Stat label={t("dashboard.statTopCause")} value={top?.[1] ?? 0} sub={top ? tv("cause", top[0]) : t("dashboard.statNoneYet")} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <Card
            title={t("dashboard.recentExperiments")}
            action={
              <a className="link text-[13px]" href="#/experiments/new">
                {t("common.newExperiment")}
              </a>
            }
          >
            {o.recentExperiments.length === 0 ? (
              <p className="caption py-4">{t("dashboard.emptyExperiments")}</p>
            ) : (
              <Table
                headers={[t("table.experiment"), t("table.status"), "pass^k", t("table.gate"), t("table.when")]}
                rows={o.recentExperiments.map((e: any) => {
                  const cand = e.benchmark?.arms?.find((a: any) => a.arm === "candidate" || a.arm === "with-skill");
                  return [
                    <a className="link" href={`#/experiments/${e.id}`}>
                      {e.name}
                    </a>,
                    <StatusChip status={e.status} />,
                    cand ? <PassKChip k={cand.k} stat={cand.passK} /> : "–",
                    e.benchmark?.gate ? (
                      <span className={e.benchmark.gate.pass ? "chip-pass" : "chip-fail"}>
                        {e.benchmark.gate.pass ? t("common.gatePass") : t("common.gateFail")}
                      </span>
                    ) : (
                      "–"
                    ),
                    <span className="caption">{fmtTime(e.createdAt)}</span>,
                  ];
                })}
              />
            )}
          </Card>
        </div>
        <Card title={t("dashboard.rootCauses")}>
          {causes.length === 0 ? (
            <p className="caption py-4">{t("dashboard.emptyCauses")}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {causes.map(([cause, count]) => (
                <div key={cause}>
                  <div className="flex justify-between items-center mb-1">
                    <CauseChip cause={cause} />
                    <span className="mono text-[12px]">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-canvas overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(count / total) * 100}%`, background: ROOT_CAUSE_COLORS[cause] ?? "#5f6368" }}
                    />
                  </div>
                </div>
              ))}
              <a className="link text-[13px] mt-1" href="#/attribution">
                {t("dashboard.viewAllAttributions")}
              </a>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
