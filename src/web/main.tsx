// React SPA entry: hash routing + app shell (sidebar nav, language switcher).

import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { getLocale, setLocale, t, LOCALES, type TranslationKey } from "./i18n.ts";
import { Dashboard } from "./pages/dashboard.tsx";
import { Targets, TargetDetail } from "./pages/targets.tsx";
import { SampleSets, SampleSetWizard, SampleSetDetail } from "./pages/samples.tsx";
import { Experiments, ExperimentNew, ExperimentDetail } from "./pages/experiments.tsx";
import { RunDetail } from "./pages/run.tsx";
import { Attributions } from "./pages/attribution.tsx";
import { Agents } from "./pages/agents.tsx";
import { Reports } from "./pages/reports.tsx";
import { Settings } from "./pages/settings.tsx";

const NAV: { hash: string; label: TranslationKey; icon: string }[] = [
  { hash: "#/", label: "nav.dashboard", icon: "◫" },
  { hash: "#/targets", label: "nav.targets", icon: "◎" },
  { hash: "#/samples", label: "nav.samples", icon: "☰" },
  { hash: "#/experiments", label: "nav.experiments", icon: "▶" },
  { hash: "#/attribution", label: "nav.attribution", icon: "⌖" },
  { hash: "#/agents", label: "nav.agents", icon: "◈" },
  { hash: "#/reports", label: "nav.reports", icon: "▤" },
  { hash: "#/settings", label: "nav.settings", icon: "⚙" },
];

const ROUTES: { pattern: RegExp; render: (args: string[]) => React.ReactNode }[] = [
  { pattern: /^#\/$/, render: () => <Dashboard /> },
  { pattern: /^#\/targets$/, render: () => <Targets /> },
  { pattern: /^#\/targets\/([^/]+)$/, render: ([id]) => <TargetDetail id={id} /> },
  { pattern: /^#\/samples$/, render: () => <SampleSets /> },
  { pattern: /^#\/samples\/new$/, render: () => <SampleSetWizard /> },
  { pattern: /^#\/samples\/([^/]+)$/, render: ([id]) => <SampleSetDetail id={id} /> },
  { pattern: /^#\/experiments$/, render: () => <Experiments /> },
  { pattern: /^#\/experiments\/new$/, render: () => <ExperimentNew /> },
  { pattern: /^#\/experiments\/([^/]+)$/, render: ([id]) => <ExperimentDetail id={id} /> },
  { pattern: /^#\/runs\/([^/]+)$/, render: ([id]) => <RunDetail id={id} /> },
  { pattern: /^#\/attribution$/, render: () => <Attributions /> },
  { pattern: /^#\/agents$/, render: () => <Agents /> },
  { pattern: /^#\/reports$/, render: () => <Reports /> },
  { pattern: /^#\/reports\/([^/]+)$/, render: ([id]) => <Reports reportId={id} /> },
  { pattern: /^#\/settings$/, render: () => <Settings /> },
];

function useHash(): string {
  const [hash, setHash] = useState(location.hash || "#/");
  useEffect(() => {
    const onChange = () => setHash(location.hash || "#/");
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash;
}

function LangSwitcher({ onSwitch }: { onSwitch: () => void }) {
  return (
    <div className="mt-auto px-3 pt-4 flex items-center gap-1">
      <span className="caption mr-1">{t("lang.label")}</span>
      {LOCALES.map(({ locale, label }) => (
        <button
          key={locale}
          className={`text-[12px] px-2 py-0.5 rounded-md border ${
            getLocale() === locale ? "border-primary text-primary font-semibold" : "border-border text-ink-2 cursor-pointer"
          }`}
          onClick={() => {
            if (getLocale() === locale) return;
            setLocale(locale);
            onSwitch();
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function App() {
  const hash = useHash();
  const [, forceRender] = useState(0);
  useEffect(() => {
    document.documentElement.lang = getLocale();
  });

  let page: React.ReactNode = <div className="card">{t("app.notFound")}</div>;
  for (const r of ROUTES) {
    const m = hash.match(r.pattern);
    if (m) {
      page = r.render(m.slice(1));
      break;
    }
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-52 shrink-0 border-r border-border bg-surface px-3 py-4 flex flex-col gap-0.5 sticky top-0 h-screen">
        <div className="px-3 pb-4 pt-1">
          <div className="text-[15px] font-semibold tracking-tight">⊜ agent eval studio</div>
          <div className="caption">{t("app.tagline")}</div>
        </div>
        {NAV.map((n) => {
          const active = n.hash === "#/" ? hash === "#/" : hash.startsWith(n.hash);
          return (
            <a key={n.hash} className={`nav-item ${active ? "active" : ""}`} href={n.hash}>
              <span className="w-4 text-center">{n.icon}</span>
              {t(n.label)}
            </a>
          );
        })}
        <LangSwitcher onSwitch={() => forceRender((x) => x + 1)} />
      </aside>
      <div className="flex-1 min-w-0 flex">
        <main key={`${hash}:${getLocale()}`} className="flex-1 min-w-0 px-6 py-5 max-w-[1200px] mx-auto w-full">
          {page}
        </main>
      </div>
    </div>
  );
}

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
