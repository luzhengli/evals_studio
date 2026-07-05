// Shared React components per DESIGN.md: calm surface, loud data.

import { useEffect, useState, type ReactNode } from "react";
import { getLocale, t, tv, type TranslationKey } from "./i18n.ts";

// ---------- formatting ----------

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleString(getLocale(), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtClock(ts: number): string {
  return new Date(ts).toLocaleTimeString(getLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "–";
  return n.toFixed(digits);
}

// ---------- data loading ----------

export function useLoad<T>(loader: () => Promise<T>, deps: unknown[] = []): {
  data: T | null;
  error: string | null;
  reload: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    loader().then(
      (d) => alive && setData(d),
      (e) => alive && setError(e?.message ?? String(e))
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, reload: () => setTick((x) => x + 1) };
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="card text-fail">{t("app.error", { message })}</div>;
}

// ---------- layout primitives ----------

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`card ${className}`}>
      {(title || action) && (
        <div className="card-title">
          <span className="flex items-center gap-2">{title}</span>
          {action && <span>{action}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

export function PageHeader({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h1 className="page-title flex items-center gap-2">{title}</h1>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center justify-center py-12 gap-3">
      <p className="text-ink-2">{message}</p>
      {action}
    </div>
  );
}

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label className="lbl">{label}</label>
      {children}
      {hint && <div className="caption mt-1">{hint}</div>}
    </div>
  );
}

export function Table({ headers, rows }: { headers: ReactNode[]; rows: ReactNode[][] }) {
  return (
    <table className="tbl">
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th key={i}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((cells, i) => (
          <tr key={i}>
            {cells.map((c, j) => (
              <td key={j}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------- chips ----------

export function PassChip({ pass, label }: { pass: boolean; label?: string }) {
  return <span className={pass ? "chip-pass" : "chip-fail"}>{label ?? (pass ? t("common.pass") : t("common.fail"))}</span>;
}

export function StatusChip({ status }: { status: string }) {
  const cls =
    status === "done" ? "chip-pass" : status === "failed" ? "chip-fail" : status === "running" ? "chip-warn" : "chip-neutral";
  return <span className={cls}>{tv("status", status)}</span>;
}

export function TypeChip({ type }: { type: string }) {
  return <span className={type === "prompt" ? "chip-primary" : "chip-warn"}>{tv("type", type)}</span>;
}

export const ROOT_CAUSE_COLORS: Record<string, string> = {
  "prompt-instruction-defect": "#7b1fa2",
  "wrong-skill-selected": "#e37400",
  "right-skill-executed-poorly": "#f9ab00",
  "tool-call-error": "#1a73e8",
  "base-model-error": "#5f6368",
};

export function CauseChip({ cause }: { cause: string }) {
  const color = ROOT_CAUSE_COLORS[cause] ?? "#5f6368";
  return (
    <span className="chip" style={{ background: `${color}1a`, color }}>
      {tv("cause", cause)}
    </span>
  );
}

const TIER_COLORS: Record<string, string> = { B: "#188038", A: "#1a73e8", E: "#e37400", R: "#d93025" };

export function TierChip({ tier }: { tier: string | null }) {
  if (!tier) return <span className="chip-neutral">–</span>;
  const color = TIER_COLORS[tier] ?? "#5f6368";
  return (
    <span className="chip mono" style={{ background: `${color}1a`, color }}>
      {tv("tier", tier)}
    </span>
  );
}

export function SeverityChip({ severity }: { severity: string }) {
  const cls = severity === "high" ? "chip-fail" : severity === "medium" ? "chip-warn" : "chip-neutral";
  return <span className={cls}>{tv("severity", severity)}</span>;
}

export function TagChips({ tags }: { tags: string[] }) {
  return (
    <span className="inline-flex gap-1 flex-wrap">
      {tags.map((tag) => (
        <span key={tag} className={tag === "false-activation" || tag === "near-miss" ? "chip-warn" : "chip-neutral"}>
          {tv("tag", tag)}
        </span>
      ))}
    </span>
  );
}

export function PassKChip({ k, stat }: { k: number; stat: { mean: number; stddev: number } }) {
  const cls = stat.mean >= 0.7 ? "chip-pass" : stat.mean >= 0.4 ? "chip-warn" : "chip-fail";
  return (
    <span className={`${cls} mono`}>
      pass^{k} {fmtNum(stat.mean)}±{fmtNum(stat.stddev)}
      <Help k="concept.passk" />
    </span>
  );
}

export function MetricTile({ name, stat }: { name: string; stat: { mean: number; stddev: number; delta: number | null } }) {
  const label = tv("metric", name) === name ? name.replaceAll("_", " ") : tv("metric", name);
  return (
    <div className="card !p-3 min-w-32">
      <div className="caption mb-1">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="mono text-[22px] font-semibold">{fmtNum(stat.mean)}</span>
        <span className="caption mono">±{fmtNum(stat.stddev)}</span>
        {stat.delta != null && (
          <span className={`text-[12px] font-medium ${stat.delta >= 0 ? "text-pass" : "text-fail"}`}>
            {stat.delta >= 0 ? "▲" : "▼"} {fmtNum(Math.abs(stat.delta))}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------- concept help tooltip ----------

/** Small ⓘ trigger with a hover/focus popover explaining a metric/algorithm. */
export function Help({ k }: { k: TranslationKey }) {
  return (
    <span className="help-tip" tabIndex={0} aria-label={t(k)}>
      <span className="help-icon">?</span>
      <span className="help-pop" role="tooltip">
        {t(k)}
      </span>
    </span>
  );
}

// ---------- buttons ----------

export function BusyButton({
  label,
  className = "btn-primary",
  onClick,
}: {
  label: string;
  className?: string;
  onClick: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onClick();
        } catch (e: any) {
          alert(e?.message ?? String(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? t("common.working") : label}
    </button>
  );
}
