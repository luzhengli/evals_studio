import { clear, h } from "./dom.ts";
import { getLocale, setLocale, t, LOCALES, type TranslationKey } from "./i18n.ts";
import { renderDashboard } from "./pages/dashboard.ts";
import { renderTargets, renderTargetDetail } from "./pages/targets.ts";
import { renderSampleSets, renderSampleSetDetail, renderSampleSetWizard } from "./pages/samples.ts";
import { renderExperiments, renderExperimentNew, renderExperimentDetail } from "./pages/experiments.ts";
import { renderRun } from "./pages/run.ts";
import { renderAttributions } from "./pages/attribution.ts";
import { renderSettings } from "./pages/settings.ts";

const NAV: { hash: string; label: TranslationKey; icon: string }[] = [
  { hash: "#/", label: "nav.dashboard", icon: "◫" },
  { hash: "#/targets", label: "nav.targets", icon: "◎" },
  { hash: "#/samples", label: "nav.samples", icon: "☰" },
  { hash: "#/experiments", label: "nav.experiments", icon: "▶" },
  { hash: "#/attribution", label: "nav.attribution", icon: "⌖" },
  { hash: "#/settings", label: "nav.settings", icon: "⚙" },
];

type Route = { pattern: RegExp; render: (main: HTMLElement, ...args: string[]) => Promise<void> | void };

const routes: Route[] = [
  { pattern: /^#\/$/, render: renderDashboard },
  { pattern: /^#\/targets$/, render: renderTargets },
  { pattern: /^#\/targets\/([^/]+)$/, render: renderTargetDetail },
  { pattern: /^#\/samples$/, render: renderSampleSets },
  { pattern: /^#\/samples\/new$/, render: renderSampleSetWizard },
  { pattern: /^#\/samples\/([^/]+)$/, render: renderSampleSetDetail },
  { pattern: /^#\/experiments$/, render: renderExperiments },
  { pattern: /^#\/experiments\/new$/, render: renderExperimentNew },
  { pattern: /^#\/experiments\/([^/]+)$/, render: renderExperimentDetail },
  { pattern: /^#\/runs\/([^/]+)$/, render: renderRun },
  { pattern: /^#\/attribution$/, render: renderAttributions },
  { pattern: /^#\/settings$/, render: renderSettings },
];

function langSwitcher(): HTMLElement {
  return h(
    "div",
    { class: "mt-auto px-3 pt-4 flex items-center gap-1" },
    h("span", { class: "caption mr-1" }, t("lang.label")),
    ...LOCALES.map(({ locale, label }) =>
      h(
        "button",
        {
          class: `text-[12px] px-2 py-0.5 rounded-md border ${
            getLocale() === locale
              ? "border-primary text-primary font-semibold"
              : "border-border text-ink-2 cursor-pointer"
          }`,
          onclick: () => {
            if (getLocale() === locale) return;
            setLocale(locale);
            navigate();
          },
        },
        label
      )
    )
  );
}

function shell(): { main: HTMLElement } {
  document.documentElement.lang = getLocale();
  const app = clear(document.getElementById("app")!);
  const main = h("main", { class: "flex-1 min-w-0 px-6 py-5 max-w-[1200px] mx-auto w-full" });
  const currentHash = location.hash || "#/";

  app.appendChild(
    h(
      "div",
      { class: "flex min-h-screen" },
      h(
        "aside",
        { class: "w-52 shrink-0 border-r border-border bg-surface px-3 py-4 flex flex-col gap-0.5 sticky top-0 h-screen" },
        h(
          "div",
          { class: "px-3 pb-4 pt-1" },
          h("div", { class: "text-[15px] font-semibold tracking-tight" }, "⊜ agent eval studio"),
          h("div", { class: "caption" }, t("app.tagline"))
        ),
        ...NAV.map((n) => {
          const active = n.hash === "#/" ? currentHash === "#/" : currentHash.startsWith(n.hash);
          return h(
            "a",
            { class: `nav-item ${active ? "active" : ""}`, href: n.hash },
            h("span", { class: "w-4 text-center" }, n.icon),
            t(n.label)
          );
        }),
        langSwitcher()
      ),
      h("div", { class: "flex-1 min-w-0 flex" }, main)
    )
  );
  return { main };
}

async function navigate() {
  if (!location.hash) location.hash = "#/";
  const { main } = shell();
  const hash = location.hash;
  for (const r of routes) {
    const m = hash.match(r.pattern);
    if (m) {
      try {
        await r.render(main, ...m.slice(1));
      } catch (e: any) {
        main.appendChild(h("div", { class: "card text-fail" }, t("app.error", { message: e?.message ?? String(e) })));
      }
      return;
    }
  }
  main.appendChild(h("div", { class: "card" }, t("app.notFound")));
}

window.addEventListener("hashchange", navigate);
navigate();
