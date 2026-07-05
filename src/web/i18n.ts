// Lightweight i18n layer. No framework, no deps, per CLAUDE.md.
// - `en` is the canonical key set; `zh` is typed against it so both stay complete.
// - t(key, params?) interpolates {name} placeholders.
// - Missing key => console.warn + the key itself is rendered (diagnosable, never throws).
// - Locale persists to localStorage ("studio.locale"); default is zh-CN.
// - Storage is injectable so tests run offline in bun without a DOM.

export type Locale = "zh-CN" | "en-US";

export const DEFAULT_LOCALE: Locale = "zh-CN";
export const LOCALE_STORAGE_KEY = "studio.locale";

const en = {
  // ---- app shell ----
  "app.tagline": "prompts & skills, attributed",
  "app.error": "error: {message}",
  "app.notFound": "page not found",
  "nav.dashboard": "dashboard",
  "nav.targets": "targets",
  "nav.samples": "samples",
  "nav.experiments": "experiments",
  "nav.attribution": "attribution",
  "nav.agents": "analysis agents",
  "nav.reports": "reports",
  "nav.settings": "settings",

  // ---- shared ----
  "common.pass": "PASS",
  "common.fail": "FAIL",
  "common.working": "working…",
  "common.back": "back",
  "common.next": "next",
  "common.noneYet": "none yet",
  "common.new": "+ new",
  "common.gatePass": "gate PASS",
  "common.gateFail": "gate FAIL",
  "common.runExperiment": "run experiment",
  "common.newExperiment": "+ new experiment",
  "common.evidence": "evidence",
  "common.input": "input",
  "common.output": "output",

  // ---- table headers ----
  "table.name": "name",
  "table.type": "type",
  "table.status": "status",
  "table.mode": "mode",
  "table.target": "target",
  "table.experiment": "experiment",
  "table.samples": "samples",
  "table.sampleSets": "sample sets",
  "table.versions": "versions",
  "table.created": "created",
  "table.when": "when",
  "table.gate": "gate",
  "table.goal": "goal",
  "table.tags": "tags",
  "table.source": "source",
  "table.kind": "kind",
  "table.config": "config",
  "table.metric": "metric",
  "table.candidate": "candidate",
  "table.baseline": "baseline",
  "table.verdict": "verdict",
  "table.assertion": "assertion",
  "table.score": "score",
  "table.arm": "arm",
  "table.attempt": "attempt",
  "table.failedAssertions": "failed assertions",
  "table.skill": "skill",
  "table.trace": "trace",
  "table.origin": "origin",
  "table.changelog": "changelog",
  "table.groundTruth": "ground truth",
  "table.expectedSkill": "expected skill",
  "table.contamination": "contamination",
  "table.freshAsOf": "fresh as of",

  // ---- dynamic value labels (looked up via tv(), raw value as fallback) ----
  "type.prompt": "prompt",
  "type.skill": "skill",
  "status.done": "done",
  "status.failed": "failed",
  "status.running": "running",
  "status.draft": "draft",
  "status.pending": "pending",
  "status.proposed": "proposed",
  "status.accepted": "accepted",
  "status.rejected": "rejected",
  "cause.prompt-instruction-defect": "prompt-instruction-defect",
  "cause.wrong-skill-selected": "wrong-skill-selected",
  "cause.right-skill-executed-poorly": "right-skill-executed-poorly",
  "cause.tool-call-error": "tool-call-error",
  "cause.base-model-error": "base-model-error",
  "metric.instruction_following": "instruction following",
  "metric.output_quality": "output quality",
  "metric.side_effect_safety": "side effect safety",
  "metric.reliability": "reliability",
  "metric.trigger_accuracy": "trigger accuracy",
  "metric.execution_reliability": "execution reliability",
  "metric.composition": "composition",
  "tag.happy-path": "happy-path",
  "tag.near-miss": "near-miss",
  "tag.false-activation": "false-activation",
  "tag.adversarial": "adversarial",
  "arm.candidate": "candidate",
  "arm.baseline": "baseline",
  "arm.with-skill": "with-skill",
  "arm.without-skill": "without-skill",
  "origin.manual": "manual",
  "origin.optimizer": "optimizer",
  "source.manual": "manual",
  "source.adversarial": "adversarial",
  "contamination.unaudited": "unaudited",
  "contamination.clean": "clean",
  "contamination.suspect": "suspect",
  "contamination.contaminated": "contaminated",
  "fixLayer.prompt": "prompt",
  "fixLayer.skill": "skill",
  "fixLayer.engine": "engine",
  "fixLayer.model": "model",
  "fixLayer.none": "none",

  // ---- dashboard ----
  "dashboard.title": "dashboard",
  "dashboard.statTargets": "targets",
  "dashboard.statTargetsSub": "{prompts} prompt · {skills} skill",
  "dashboard.statExperiments": "experiments",
  "dashboard.statExperimentsSub": "{done} completed",
  "dashboard.statAttributions": "failure attributions",
  "dashboard.statAttributionsSub": "counterfactual-verified",
  "dashboard.statTopCause": "top root cause",
  "dashboard.statNoneYet": "none yet",
  "dashboard.recentExperiments": "recent experiments",
  "dashboard.emptyExperiments": "no experiments yet — create a target and run one",
  "dashboard.rootCauses": "root causes",
  "dashboard.emptyCauses": "run attribution on a finished experiment to populate",
  "dashboard.viewAllAttributions": "view all attributions →",

  // ---- targets ----
  "targets.title": "eval targets",
  "targets.new": "+ new target",
  "targets.subtitle":
    "prompts and skills are peer eval targets — same samples, experiments, traces, attribution, versions and gates",
  "targets.empty": "no targets yet — create a prompt or skill to evaluate",
  "targets.formTitle": "new target",
  "targets.formName": "name",
  "targets.formNamePh": "e.g. release-notes-writer",
  "targets.formType": "type",
  "targets.formDescription": "description",
  "targets.formDescriptionPh": "what this target does",
  "targets.formContent": "content (version 1)",
  "targets.formContentPh":
    'prompt text — or for a skill, JSON: {"name", "triggerDescription", "instructions", "tools"}',
  "targets.formContentHint": "for skills this must be a SkillDef JSON",
  "targets.formCreate": "create target",
  "targets.formRequired": "name and content are required",
  "targets.newSampleSet": "+ sample set",
  "targets.versions": "versions",
  "targets.versionActive": "active",
  "targets.diff": "diff",
  "targets.activate": "activate",
  "targets.diffTitle": "diff v{a} → v{b}",
  "targets.activeContent": "active content (v{version})",
  "targets.suggestions": "optimizer suggestions",
  "targets.emptySuggestions":
    "run attribution on a failed experiment, then generate a suggestion from its report",
  "targets.proposedContent": "proposed content",
  "targets.acceptSuggestion": "accept → new version",
  "targets.rejectSuggestion": "reject",
  "targets.sampleSets": "sample sets",
  "targets.experiments": "experiments",

  // ---- sample sets ----
  "samples.title": "sample sets",
  "samples.new": "+ new sample set",
  "samples.empty": "no sample sets yet — the wizard walks you through goal → scenario → cases → fields",
  "samples.startWizard": "start wizard",
  "samples.wizardTitle": "new sample set",
  "samples.createTargetFirst": "create an eval target first",
  "samples.goToTargets": "go to targets",
  "samples.stepGoal": "goal",
  "samples.stepScenario": "scenario",
  "samples.stepCases": "cases",
  "samples.stepFields": "fields",
  "samples.attachTarget": "attach to eval target",
  "samples.attachTargetHint": "samples hang off a prompt or skill target — both are first-class",
  "samples.setName": "sample set name",
  "samples.setNamePh": "e.g. release-notes core set",
  "samples.goalLabel": "evaluation goal",
  "samples.goalPh": "what should this sample set verify about the target?",
  "samples.scenarioLabel": "scenario analysis",
  "samples.scenarioPh": "who uses this, in what situation, what varies, what goes wrong?",
  "samples.scenarioHint":
    "capture the real-world scenario the cases must cover — include failure-prone variations",
  "samples.descriptionLabel": "description",
  "samples.descriptionPh": "one-line summary",
  "samples.casesHint":
    "enumerate concrete use cases; adversarial probes (false-activation / near-miss) can be generated per sample afterwards",
  "samples.caseNamePh": "case name",
  "samples.caseInputPh": "task input given to the engine",
  "samples.addCase": "+ add case",
  "samples.fieldsNote":
    "the wizard creates the set and its cases; per-sample fields (ground truth, expected trajectory, expected skill, side-effect allowlist, tags) are defined next on the set page.",
  "samples.summary": "set: {name}\ntarget: {target}\ngoal: {goal}\ncases: {cases}",
  "samples.nameRequired": "name is required",
  "samples.createSet": "create sample set",
  "samples.runAudit": "run contamination audit",
  "samples.detailTarget": "target: ",
  "samples.detailGoal": " · goal: {goal}",
  "samples.listTitle": "samples ({count})",
  "samples.emptySamples": "no samples yet — add one below",
  "samples.mustNotTrigger": "∅ must not trigger",
  "samples.judgeGraded": "judge-graded",
  "samples.addTitle": "add sample — define fields",
  "samples.sampleNamePh": "sample name",
  "samples.inputPh": "input prompt / task given to the engine",
  "samples.groundTruthLabel": "ground truth (oracle)",
  "samples.groundTruthPh":
    "ground truth — plain containment, or prefix exact: / regex: / json: / code: (empty ⇒ LLM-judge)",
  "samples.trajectoryLabel": "expected trajectory",
  "samples.trajectoryPh":
    'expected trajectory, comma-separated actions e.g. "skill:create-jira-ticket, jira_create, respond"',
  "samples.expectedSkillLabel": "expected skill",
  "samples.expectedSkillPh": "expected skill name (empty ⇒ must NOT trigger — false-activation probe)",
  "samples.sideEffectsLabel": "side-effect allowlist",
  "samples.sideEffectsPh":
    'allowed side effects e.g. "file-write:notes.md, api-call:jira.local/*" (anything else is a violation)',
  "samples.tagLabel": "tag",
  "samples.tagHint": "false-activation & near-miss are the highest-value samples",
  "samples.inputLabel": "input",
  "samples.addSample": "add sample",
  "samples.addRequired": "name and input are required",

  // ---- experiments ----
  "experiments.title": "experiments",
  "experiments.empty":
    "no experiments — an experiment is (sample set × engine × target version × eval config)",
  "experiments.newTitle": "new experiment",
  "experiments.createTargetFirst": "create a target first",
  "experiments.targetsBtn": "targets",
  "experiments.configureEngineFirst": "configure an execution engine first",
  "experiments.settingsBtn": "settings",
  "experiments.namePh": "experiment name",
  "experiments.name": "name",
  "experiments.target": "target",
  "experiments.sampleSet": "sample set",
  "experiments.candidateVersion": "target version (candidate)",
  "experiments.baselineVersion": "baseline version (ab-prompt only)",
  "experiments.engine": "engine",
  "experiments.mode": "mode",
  "experiments.kLabel": "k (pass^k attempts)",
  "experiments.kHint":
    "every sample runs k times per arm; a sample passes only if all k attempts pass",
  "experiments.judge": "judge",
  "experiments.judgeHint": "mock-judge, or a judge id configured in settings",
  "experiments.noBaseline": "— none —",
  "experiments.activeSuffix": " (active)",
  "experiments.samplesSuffix": "{name} ({count} samples)",
  "experiments.modeSingle": "single — one arm",
  "experiments.modeAbPrompt": "A/B — candidate vs baseline version",
  "experiments.modeAbSkill": "A/B — with-skill vs without-skill",
  "experiments.createAndRun": "create & run",
  "experiments.untitled": "untitled experiment",
  "experiments.rerun": "re-run",
  "experiments.run": "run",
  "experiments.runAttribution": "run attribution",
  "experiments.exportBenchmark": "export benchmark.json",
  "experiments.exportDone": "artifacts written to {outDir}/ — gate {gate}",
  "experiments.detailMeta": " · mode: {mode} · k={k} · judge: {judge}",
  "experiments.detailTarget": "target: ",
  "experiments.armTitle": "arm: ",
  "experiments.armMeta": "{samples} samples · {ms}ms avg · {tokens} tokens avg",
  "experiments.regressionGate": "regression gate",
  "experiments.gateFailBlocked": "FAIL — blocked",
  "experiments.attributions": "failure attributions",
  "experiments.fullReports": "full reports →",
  "experiments.generateSuggestion": "generate optimizer suggestion from these attributions",
  "experiments.runsTitle": "runs ({count})",
  "experiments.viewTrace": "view trace",

  // ---- run detail ----
  "run.title": "run · {sample}",
  "run.backToExperiment": "← experiment",
  "run.meta": "arm: {arm} · attempt {attempt} · {ms}ms · {tokens} tokens",
  "run.metaSkill": " · skill: {skill}",
  "run.grading": "grading — per-assertion",
  "run.sideEffects": "side-effect endpoints",
  "run.seL1": "L1 semantic acceptance",
  "run.seL2": "L2 audit-visible evidence",
  "run.seL3": "L3 sandbox tool-state harm",
  "run.seNote":
    "graded independently — a semantic pass never implies side-effect safety; effects only ever touch the emulated sandbox",
  "run.output": "output",
  "run.emptyOutput": "(empty)",
  "run.timeline": "trace timeline · replay",
  "run.showAll": "show all",
  "run.prev": "⏮ prev",
  "run.step": "step ▶",
  "run.stepsHint":
    "{count} steps — click any step to inspect; “step” replays the trajectory one action at a time",
  "run.effectivePrompt": "effective prompt at this step",

  // ---- attribution ----
  "attribution.title": "attribution reports",
  "attribution.subtitle":
    "every failed case is replayed under counterfactual interventions (rewrite prompt / force skill / disable skill / swap model); the outcome flip pattern determines the root cause — selection layer first, then execution, then base model",
  "attribution.empty": "no attributions yet — open a finished experiment and click “run attribution”",
  "attribution.experimentsBtn": "experiments",
  "attribution.fixLayer": "fix layer: {layer}",
  "attribution.experimentLabel": "experiment: ",
  "attribution.traceStep": "trace step #{index} →",
  "attribution.viewTrace": "view trace →",
  "attribution.colIntervention": "counterfactual intervention",
  "attribution.colFlipped": "outcome flipped?",
  "attribution.flipped": "FLIPPED → pass",
  "attribution.stillFails": "still fails",
  "attribution.notApplied": "not applied",
  "attribution.noReplay": "classified from trace evidence without replay (deterministic tool error)",
  "attribution.recommendedFix": "recommended fix",

  // ---- settings ----
  "settings.title": "settings",
  "settings.engines": "execution engines",
  "settings.noEngines": "no engines configured",
  "settings.kind": "kind",
  "settings.name": "name",
  "settings.namePh": "display name",
  "settings.model": "model",
  "settings.modelPh": "model, e.g. deepseek-chat / glm-4",
  "settings.baseUrl": "base url",
  "settings.baseUrlPh": "https://api.deepseek.com/v1 (openai-compat)",
  "settings.apiKey": "api key",
  "settings.apiKeyPh": "api key",
  "settings.cliBinary": "cli binary",
  "settings.cliBinaryPh": "binary path for CLI engines (codex / claude / pi)",
  "settings.addEngine": "add engine",
  "settings.judges": "LLM judge endpoints",
  "settings.judgeNote":
    "judges are pluggable: reference the judge id in an experiment's eval config. built-in “mock-judge” is deterministic and offline. calibrate any LLM judge on labeled examples before trusting it (agreement ≥ 0.8).",
  "settings.judgeId": "judge id",
  "settings.judgeIdPh": "judge id, e.g. deepseek-judge",
  "settings.saveJudge": "save judge",
  "settings.judgeRequired": "judge id and base url are required",
  "settings.pipeline": "pipeline / CI",
  "settings.pipelineHelp":
    "# run evals for an experiment and gate the result (exit 1 on regression):\nbun run pipeline <experimentId> [outDir]\n# artifacts: timing.json · grading.json (per-assertion PASS/FAIL + evidence) · benchmark.json (mean+stddev+delta)",

  // ---- concept help (small ⓘ tooltips) ----
  "concept.passk":
    "pass^k: every sample runs k times; it only counts as passed when ALL k attempts pass. Reported as mean ± stddev — exposes flakiness that pass@1 hides.",
  "concept.counterfactual":
    "Counterfactual attribution: each failing case is replayed under targeted interventions (rewrite prompt / force skill / disable skill / swap model). Whether the outcome flips pinpoints the layer that owns the failure.",
  "concept.gate":
    "Regression gate: a candidate version must not regress against the baseline on pass^k or ANY category metric (within ε tolerance); otherwise the version is blocked.",
  "concept.sideEffect3":
    "Side effects are graded on 3 independent endpoints: L1 semantic acceptance (is the answer right), L2 audit-visible evidence (is the paper trail compliant), L3 sandbox tool-state harm (was state damaged). A semantic pass never implies safety; effects only ever hit the emulated sandbox.",
  "concept.matrix":
    "Capability matrix: samples are placed in a capability-dimension × tier grid. The goal is to cross-cover the most scenarios with the fewest cases — every empty cell is a coverage gap.",
  "concept.tiers":
    "B/A/E/R tier budget: Basic 40% · Advanced 30% · Edge 20% · adveRsarial 10%. Deviations beyond tolerance are flagged as gaps.",
  "concept.traceStep":
    "Trace step: the smallest execution unit of a run (LLM call / tool call / skill routing / state / side effect), ordered by actual start time, with duration, input/output, tokens and errors.",

  // ---- coverage matrix ----
  "coverage.title": "coverage matrix (capability × tier)",
  "coverage.tagged": "{tagged}/{total} samples tagged",
  "coverage.untagged": "{count} untagged",
  "coverage.capability": "capability",
  "coverage.gaps": "coverage gaps",
  "coverage.noGaps": "no coverage gaps",
  "coverage.nextTier": "suggested next tier: {tier}",
  "coverage.empty": "tag samples with a capability + tier to populate the matrix",
  "coverage.target": "target",

  // ---- tiers ----
  "tier.B": "B basic",
  "tier.A": "A advanced",
  "tier.E": "E edge",
  "tier.R": "R adversarial",

  // ---- severity ----
  "severity.low": "low",
  "severity.medium": "medium",
  "severity.high": "high",

  // ---- extra table headers ----
  "table.tier": "tier",
  "table.capability": "capability",
  "table.agent": "agent",
  "table.progress": "progress",
  "table.severity": "severity",
  "table.time": "time",
  "table.duration": "duration",
  "table.tokens": "tokens",
  "table.error": "error",
  "table.scenario": "scenario",
  "table.template": "template",

  // ---- sample fields ----
  "samples.capabilityLabel": "capability dimension",
  "samples.capabilityPh": "e.g. format-compliance / trigger-precision",
  "samples.tierLabel": "tier (B/A/E/R)",
  "samples.analysisProgress": "analysis progress",
  "samples.noAnalyses": "no agent analyses yet — run one from a finished experiment",
  "samples.methodology":
    "methodology: cover the most scenarios with the fewest cases — one capability × tier cell per sample; fill B first, then A/E/R per the 40/30/20/10 budget; every empty cell is a gap to author next.",

  // ---- run detail extras ----
  "run.errorBanner": "run error: {error}",
  "run.stepErrors": "{count} step error(s) in this trace",
  "run.attributionCard": "attribution for this run",
  "run.findingsCard": "agent analysis findings",
  "run.noTrace": "no trace recorded for this run",
  "run.chain": "execution chain",
  "run.chainHint": "sample → run → trace → grading → attribution → agent analysis",

  // ---- analyses ----
  "analysis.title": "agent analyses",
  "analysis.new": "run agent analysis",
  "analysis.chooseAgent": "analysis agent",
  "analysis.noAgents": "no attribution agents yet — create one first",
  "analysis.agentsBtn": "analysis agents",
  "analysis.namePh": "analysis name (optional)",
  "analysis.itemsHint": "pulls the attribution items of this experiment and analyzes each with the chosen agent",
  "analysis.progress": "{done}/{total}",
  "analysis.agrees": "confirms root cause",
  "analysis.disputes": "no confirming flip",

  // ---- attribution agents ----
  "agents.title": "attribution agents",
  "agents.subtitle":
    "an agent bundles an analysis scenario and error-attribution criteria; analyses pull an experiment's attribution items and review each one under those criteria",
  "agents.empty": "no agents yet — create one to analyze attribution results",
  "agents.name": "name",
  "agents.namePh": "e.g. skill-triage",
  "agents.scenario": "analysis scenario",
  "agents.scenarioPh": "what situation does this agent analyze? e.g. skill trigger regressions in chat support",
  "agents.criteria": "attribution criteria",
  "agents.criteriaPh":
    "what to prioritize, e.g. focus on wrong-skill-selected; treat side-effect violations as high severity",
  "agents.judge": "judge id",
  "agents.create": "create agent",
  "agents.nameRequired": "agent name is required",

  // ---- reports ----
  "reports.title": "analysis reports",
  "reports.subtitle": "generate markdown reports from experiment data via customizable templates",
  "reports.empty": "no reports yet — pick an experiment and generate one",
  "reports.generate": "generate report",
  "reports.chooseExperiment": "experiment",
  "reports.chooseTemplate": "template",
  "reports.chooseTask": "analysis task (optional)",
  "reports.noTask": "— none —",
  "reports.namePh": "report name (optional)",
  "reports.templates": "report templates",
  "reports.newTemplate": "new template",
  "reports.templateName": "template name",
  "reports.templateDesc": "description",
  "reports.templateContent": "template (markdown with {{placeholders}})",
  "reports.placeholdersHint":
    "available placeholders: {{title}} {{experiment}} {{experimentId}} {{target}} {{targetType}} {{date}} {{agent}} {{metrics}} {{causes}} {{findings}} {{coverage}} {{actions}}",
  "reports.saveTemplate": "save template",
  "reports.builtIn": "built-in",
  "reports.templateRequired": "template name and content are required",
  "reports.view": "view",
  "reports.backToList": "← reports",

  // ---- skill spec ----
  "skillspec.title": "agent-skills spec check",
  "skillspec.ok": "conforms to the Agent Skills spec (agentskills.io)",
  "skillspec.issues": "{count} spec issue(s)",

  // ---- language switcher ----
  "lang.label": "language",
} as const;

export type TranslationKey = keyof typeof en;

const zh: Record<TranslationKey, string> = {
  // ---- app shell ----
  "app.tagline": "提示词与技能，可归因评测",
  "app.error": "错误：{message}",
  "app.notFound": "页面不存在",
  "nav.dashboard": "仪表盘",
  "nav.targets": "评测目标",
  "nav.samples": "样本集",
  "nav.experiments": "实验",
  "nav.attribution": "归因",
  "nav.agents": "分析 Agent",
  "nav.reports": "分析报告",
  "nav.settings": "设置",

  // ---- shared ----
  "common.pass": "通过",
  "common.fail": "失败",
  "common.working": "处理中…",
  "common.back": "上一步",
  "common.next": "下一步",
  "common.noneYet": "暂无",
  "common.new": "+ 新建",
  "common.gatePass": "门禁通过",
  "common.gateFail": "门禁失败",
  "common.runExperiment": "运行实验",
  "common.newExperiment": "+ 新建实验",
  "common.evidence": "证据",
  "common.input": "输入",
  "common.output": "输出",

  // ---- table headers ----
  "table.name": "名称",
  "table.type": "类型",
  "table.status": "状态",
  "table.mode": "模式",
  "table.target": "目标",
  "table.experiment": "实验",
  "table.samples": "样本数",
  "table.sampleSets": "样本集",
  "table.versions": "版本数",
  "table.created": "创建时间",
  "table.when": "时间",
  "table.gate": "门禁",
  "table.goal": "目标描述",
  "table.tags": "标签",
  "table.source": "来源",
  "table.kind": "种类",
  "table.config": "配置",
  "table.metric": "指标",
  "table.candidate": "候选",
  "table.baseline": "基线",
  "table.verdict": "判定",
  "table.assertion": "断言",
  "table.score": "得分",
  "table.arm": "实验臂",
  "table.attempt": "尝试",
  "table.failedAssertions": "失败断言",
  "table.skill": "技能",
  "table.trace": "追踪",
  "table.origin": "来源",
  "table.changelog": "变更说明",
  "table.groundTruth": "标准答案",
  "table.expectedSkill": "期望技能",
  "table.contamination": "污染审计",
  "table.freshAsOf": "数据新鲜度",

  // ---- dynamic value labels ----
  "type.prompt": "提示词",
  "type.skill": "技能",
  "status.done": "已完成",
  "status.failed": "失败",
  "status.running": "运行中",
  "status.draft": "草稿",
  "status.pending": "待运行",
  "status.proposed": "待处理",
  "status.accepted": "已采纳",
  "status.rejected": "已拒绝",
  "cause.prompt-instruction-defect": "提示词指令缺陷",
  "cause.wrong-skill-selected": "技能选择错误",
  "cause.right-skill-executed-poorly": "技能执行不佳",
  "cause.tool-call-error": "工具调用错误",
  "cause.base-model-error": "基座模型错误",
  "metric.instruction_following": "指令遵循",
  "metric.output_quality": "输出质量",
  "metric.side_effect_safety": "副作用安全",
  "metric.reliability": "可靠性",
  "metric.trigger_accuracy": "触发准确率",
  "metric.execution_reliability": "执行可靠性",
  "metric.composition": "组合能力",
  "tag.happy-path": "正常路径",
  "tag.near-miss": "近似误触",
  "tag.false-activation": "误激活",
  "tag.adversarial": "对抗样本",
  "arm.candidate": "候选",
  "arm.baseline": "基线",
  "arm.with-skill": "含技能",
  "arm.without-skill": "不含技能",
  "origin.manual": "手动",
  "origin.optimizer": "优化器",
  "source.manual": "手动",
  "source.adversarial": "对抗生成",
  "contamination.unaudited": "未审计",
  "contamination.clean": "干净",
  "contamination.suspect": "可疑",
  "contamination.contaminated": "已污染",
  "fixLayer.prompt": "提示词",
  "fixLayer.skill": "技能",
  "fixLayer.engine": "引擎",
  "fixLayer.model": "模型",
  "fixLayer.none": "无",

  // ---- dashboard ----
  "dashboard.title": "仪表盘",
  "dashboard.statTargets": "评测目标",
  "dashboard.statTargetsSub": "{prompts} 个提示词 · {skills} 个技能",
  "dashboard.statExperiments": "实验",
  "dashboard.statExperimentsSub": "已完成 {done} 个",
  "dashboard.statAttributions": "失败归因",
  "dashboard.statAttributionsSub": "经反事实验证",
  "dashboard.statTopCause": "最高频根因",
  "dashboard.statNoneYet": "暂无",
  "dashboard.recentExperiments": "最近实验",
  "dashboard.emptyExperiments": "暂无实验 — 先创建评测目标并运行一个实验",
  "dashboard.rootCauses": "根因分布",
  "dashboard.emptyCauses": "对已完成的实验运行归因后，此处将显示数据",
  "dashboard.viewAllAttributions": "查看全部归因 →",

  // ---- targets ----
  "targets.title": "评测目标",
  "targets.new": "+ 新建目标",
  "targets.subtitle": "提示词与技能是对等的评测目标 — 共享样本、实验、追踪、归因、版本与门禁",
  "targets.empty": "暂无评测目标 — 创建一个提示词或技能开始评测",
  "targets.formTitle": "新建目标",
  "targets.formName": "名称",
  "targets.formNamePh": "例如 release-notes-writer",
  "targets.formType": "类型",
  "targets.formDescription": "描述",
  "targets.formDescriptionPh": "该目标的用途",
  "targets.formContent": "内容（版本 1）",
  "targets.formContentPh": '提示词文本 — 若为技能，填 JSON：{"name", "triggerDescription", "instructions", "tools"}',
  "targets.formContentHint": "技能目标的内容必须是 SkillDef JSON",
  "targets.formCreate": "创建目标",
  "targets.formRequired": "名称与内容为必填项",
  "targets.newSampleSet": "+ 样本集",
  "targets.versions": "版本",
  "targets.versionActive": "当前",
  "targets.diff": "对比",
  "targets.activate": "激活",
  "targets.diffTitle": "对比 v{a} → v{b}",
  "targets.activeContent": "当前内容（v{version}）",
  "targets.suggestions": "优化器建议",
  "targets.emptySuggestions": "对失败的实验运行归因，然后基于归因报告生成优化建议",
  "targets.proposedContent": "建议内容",
  "targets.acceptSuggestion": "采纳 → 生成新版本",
  "targets.rejectSuggestion": "拒绝",
  "targets.sampleSets": "样本集",
  "targets.experiments": "实验",

  // ---- sample sets ----
  "samples.title": "样本集",
  "samples.new": "+ 新建样本集",
  "samples.empty": "暂无样本集 — 向导将引导你完成 目标 → 场景 → 用例 → 字段",
  "samples.startWizard": "开始向导",
  "samples.wizardTitle": "新建样本集",
  "samples.createTargetFirst": "请先创建评测目标",
  "samples.goToTargets": "前往评测目标",
  "samples.stepGoal": "目标",
  "samples.stepScenario": "场景",
  "samples.stepCases": "用例",
  "samples.stepFields": "字段",
  "samples.attachTarget": "关联评测目标",
  "samples.attachTargetHint": "样本集挂在提示词或技能目标下 — 两者都是一等公民",
  "samples.setName": "样本集名称",
  "samples.setNamePh": "例如 release-notes 核心集",
  "samples.goalLabel": "评测目标",
  "samples.goalPh": "这个样本集要验证目标的什么能力？",
  "samples.scenarioLabel": "场景分析",
  "samples.scenarioPh": "谁在什么情况下使用？有哪些变化？哪里容易出错？",
  "samples.scenarioHint": "记录用例必须覆盖的真实场景 — 包含容易出错的变体",
  "samples.descriptionLabel": "描述",
  "samples.descriptionPh": "一句话概述",
  "samples.casesHint": "枚举具体用例；对抗探针（误激活 / 近似误触）可在之后按样本生成",
  "samples.caseNamePh": "用例名称",
  "samples.caseInputPh": "提供给引擎的任务输入",
  "samples.addCase": "+ 添加用例",
  "samples.fieldsNote":
    "向导会创建样本集及其用例；每个样本的字段（标准答案、期望轨迹、期望技能、副作用白名单、标签）在样本集页面中进一步定义。",
  "samples.summary": "样本集：{name}\n目标：{target}\n评测目标：{goal}\n用例数：{cases}",
  "samples.nameRequired": "名称为必填项",
  "samples.createSet": "创建样本集",
  "samples.runAudit": "运行污染审计",
  "samples.detailTarget": "目标：",
  "samples.detailGoal": " · 评测目标：{goal}",
  "samples.listTitle": "样本（{count}）",
  "samples.emptySamples": "暂无样本 — 在下方添加",
  "samples.mustNotTrigger": "∅ 不应触发",
  "samples.judgeGraded": "由评审打分",
  "samples.addTitle": "添加样本 — 定义字段",
  "samples.sampleNamePh": "样本名称",
  "samples.inputPh": "提供给引擎的输入提示 / 任务",
  "samples.groundTruthLabel": "标准答案（oracle）",
  "samples.groundTruthPh": "标准答案 — 默认包含匹配，或加前缀 exact: / regex: / json: / code:（留空 ⇒ LLM 评审）",
  "samples.trajectoryLabel": "期望轨迹",
  "samples.trajectoryPh": '期望轨迹，逗号分隔的动作，例如 "skill:create-jira-ticket, jira_create, respond"',
  "samples.expectedSkillLabel": "期望技能",
  "samples.expectedSkillPh": "期望触发的技能名（留空 ⇒ 不应触发 — 误激活探针）",
  "samples.sideEffectsLabel": "副作用白名单",
  "samples.sideEffectsPh": '允许的副作用，例如 "file-write:notes.md, api-call:jira.local/*"（其余均视为违规）',
  "samples.tagLabel": "标签",
  "samples.tagHint": "误激活与近似误触是价值最高的样本",
  "samples.inputLabel": "输入",
  "samples.addSample": "添加样本",
  "samples.addRequired": "名称与输入为必填项",

  // ---- experiments ----
  "experiments.title": "实验",
  "experiments.empty": "暂无实验 — 一个实验 = （样本集 × 引擎 × 目标版本 × 评测配置）",
  "experiments.newTitle": "新建实验",
  "experiments.createTargetFirst": "请先创建评测目标",
  "experiments.targetsBtn": "评测目标",
  "experiments.configureEngineFirst": "请先配置执行引擎",
  "experiments.settingsBtn": "设置",
  "experiments.namePh": "实验名称",
  "experiments.name": "名称",
  "experiments.target": "目标",
  "experiments.sampleSet": "样本集",
  "experiments.candidateVersion": "目标版本（候选）",
  "experiments.baselineVersion": "基线版本（仅 ab-prompt 模式）",
  "experiments.engine": "引擎",
  "experiments.mode": "模式",
  "experiments.kLabel": "k（pass^k 尝试次数）",
  "experiments.kHint": "每个样本在每个实验臂运行 k 次；k 次全部通过样本才算通过",
  "experiments.judge": "评审",
  "experiments.judgeHint": "mock-judge，或在设置中配置的评审 id",
  "experiments.noBaseline": "— 无 —",
  "experiments.activeSuffix": "（当前）",
  "experiments.samplesSuffix": "{name}（{count} 个样本）",
  "experiments.modeSingle": "单臂 — 只跑一个版本",
  "experiments.modeAbPrompt": "A/B — 候选版本 vs 基线版本",
  "experiments.modeAbSkill": "A/B — 含技能 vs 不含技能",
  "experiments.createAndRun": "创建并运行",
  "experiments.untitled": "未命名实验",
  "experiments.rerun": "重新运行",
  "experiments.run": "运行",
  "experiments.runAttribution": "运行归因",
  "experiments.exportBenchmark": "导出 benchmark.json",
  "experiments.exportDone": "产物已写入 {outDir}/ — 门禁 {gate}",
  "experiments.detailMeta": " · 模式：{mode} · k={k} · 评审：{judge}",
  "experiments.detailTarget": "目标：",
  "experiments.armTitle": "实验臂：",
  "experiments.armMeta": "{samples} 个样本 · 平均 {ms}ms · 平均 {tokens} tokens",
  "experiments.regressionGate": "回归门禁",
  "experiments.gateFailBlocked": "失败 — 已拦截",
  "experiments.attributions": "失败归因",
  "experiments.fullReports": "完整报告 →",
  "experiments.generateSuggestion": "基于这些归因生成优化建议",
  "experiments.runsTitle": "运行记录（{count}）",
  "experiments.viewTrace": "查看追踪",

  // ---- run detail ----
  "run.title": "运行 · {sample}",
  "run.backToExperiment": "← 返回实验",
  "run.meta": "实验臂：{arm} · 第 {attempt} 次尝试 · {ms}ms · {tokens} tokens",
  "run.metaSkill": " · 技能：{skill}",
  "run.grading": "评分 — 按断言",
  "run.sideEffects": "副作用三端点",
  "run.seL1": "L1 语义接受",
  "run.seL2": "L2 审计可见证据",
  "run.seL3": "L3 沙箱工具状态危害",
  "run.seNote": "三个端点独立评分 — 语义通过不代表副作用安全；副作用只作用于模拟沙箱",
  "run.output": "输出",
  "run.emptyOutput": "（空）",
  "run.timeline": "追踪时间线 · 回放",
  "run.showAll": "显示全部",
  "run.prev": "⏮ 上一步",
  "run.step": "单步 ▶",
  "run.stepsHint": "共 {count} 步 — 点击任意步骤查看详情；“单步”按动作逐步回放轨迹",
  "run.effectivePrompt": "该步骤的有效提示词",

  // ---- attribution ----
  "attribution.title": "归因报告",
  "attribution.subtitle":
    "每个失败用例都会在反事实干预下重放（重写提示词 / 强制技能 / 禁用技能 / 更换模型）；结果翻转的模式决定根因 — 先看选择层，再看执行层，最后是基座模型",
  "attribution.empty": "暂无归因 — 打开一个已完成的实验并点击“运行归因”",
  "attribution.experimentsBtn": "实验",
  "attribution.fixLayer": "修复层：{layer}",
  "attribution.experimentLabel": "实验：",
  "attribution.traceStep": "追踪步骤 #{index} →",
  "attribution.viewTrace": "查看追踪 →",
  "attribution.colIntervention": "反事实干预",
  "attribution.colFlipped": "结果翻转？",
  "attribution.flipped": "翻转 → 通过",
  "attribution.stillFails": "仍然失败",
  "attribution.notApplied": "未应用",
  "attribution.noReplay": "根据追踪证据直接归类，无需重放（确定性工具错误）",
  "attribution.recommendedFix": "修复建议",

  // ---- settings ----
  "settings.title": "设置",
  "settings.engines": "执行引擎",
  "settings.noEngines": "尚未配置引擎",
  "settings.kind": "种类",
  "settings.name": "名称",
  "settings.namePh": "显示名称",
  "settings.model": "模型",
  "settings.modelPh": "模型，例如 deepseek-chat / glm-4",
  "settings.baseUrl": "base url",
  "settings.baseUrlPh": "https://api.deepseek.com/v1（openai-compat）",
  "settings.apiKey": "api key",
  "settings.apiKeyPh": "api key",
  "settings.cliBinary": "CLI 可执行文件",
  "settings.cliBinaryPh": "CLI 引擎的可执行文件路径（codex / claude / pi）",
  "settings.addEngine": "添加引擎",
  "settings.judges": "LLM 评审端点",
  "settings.judgeNote":
    "评审可插拔：在实验的评测配置中引用评审 id。内置 “mock-judge” 是确定性且离线的。任何 LLM 评审在可信使用前需在标注样本上校准（一致率 ≥ 0.8）。",
  "settings.judgeId": "评审 id",
  "settings.judgeIdPh": "评审 id，例如 deepseek-judge",
  "settings.saveJudge": "保存评审配置",
  "settings.judgeRequired": "评审 id 与 base url 为必填项",
  "settings.pipeline": "流水线 / CI",
  "settings.pipelineHelp":
    "# 运行某个实验的评测并对结果做门禁（回归时 exit 1）：\nbun run pipeline <experimentId> [outDir]\n# 产物：timing.json · grading.json（按断言 PASS/FAIL + 证据）· benchmark.json（mean+stddev+delta）",

  // ---- concept help (small ⓘ tooltips) ----
  "concept.passk":
    "pass^k:同一样本连续运行 k 次,k 次全部通过才计为通过。报告均值 ± 标准差,能暴露 pass@1 掩盖的不稳定性。",
  "concept.counterfactual":
    "反事实归因:对每个失败用例施加定向干预(重写提示词 / 强制技能 / 禁用技能 / 更换模型)后重放,依据结果是否翻转来定位失败所属的层。",
  "concept.gate":
    "回归门禁:候选版本在 pass^k 和所有分类指标上都不得劣于基线(允许 ε 容差),否则该版本被拦截,不能激活。",
  "concept.sideEffect3":
    "副作用三层评分:L1 语义接受(答案对不对)、L2 审计可见证据(留痕是否合规)、L3 沙箱工具状态危害(状态是否受损),三层独立评分;语义通过不代表副作用安全,副作用只作用于模拟沙箱。",
  "concept.matrix":
    "能力矩阵:把样本放入「能力维度 × 层级」网格,用尽可能少的用例交叉覆盖尽可能多的场景;每个空格都是一个覆盖缺口。",
  "concept.tiers":
    "B/A/E/R 分层配比:B 基础 40% · A 进阶 30% · E 边界 20% · R 对抗 10%。偏离超过容差会被标记为缺口。",
  "concept.traceStep":
    "trace step:一次运行中的最小执行单元(LLM 调用 / 工具调用 / 技能路由 / 状态 / 副作用),按实际开始时间排序,包含耗时、输入输出、token 与错误信息。",

  // ---- coverage matrix ----
  "coverage.title": "覆盖矩阵(能力 × 层级)",
  "coverage.tagged": "已标注 {tagged}/{total} 个样本",
  "coverage.untagged": "{count} 个未标注",
  "coverage.capability": "能力维度",
  "coverage.gaps": "覆盖缺口",
  "coverage.noGaps": "无覆盖缺口",
  "coverage.nextTier": "建议下一个补充层级:{tier}",
  "coverage.empty": "为样本标注「能力维度 + 层级」后,矩阵将在此展示",
  "coverage.target": "目标占比",

  // ---- tiers ----
  "tier.B": "B 基础",
  "tier.A": "A 进阶",
  "tier.E": "E 边界",
  "tier.R": "R 对抗",

  // ---- severity ----
  "severity.low": "低",
  "severity.medium": "中",
  "severity.high": "高",

  // ---- extra table headers ----
  "table.tier": "层级",
  "table.capability": "能力维度",
  "table.agent": "Agent",
  "table.progress": "进度",
  "table.severity": "严重度",
  "table.time": "开始时间",
  "table.duration": "耗时",
  "table.tokens": "tokens",
  "table.error": "错误",
  "table.scenario": "分析场景",
  "table.template": "模板",

  // ---- sample fields ----
  "samples.capabilityLabel": "能力维度",
  "samples.capabilityPh": "例如 format-compliance / trigger-precision",
  "samples.tierLabel": "层级(B/A/E/R)",
  "samples.analysisProgress": "分析进度",
  "samples.noAnalyses": "暂无 Agent 分析 — 在已完成的实验中发起一次分析",
  "samples.methodology":
    "方法论:用尽可能少的用例交叉覆盖尽可能多的场景 — 每个样本占据一个「能力 × 层级」格;先补齐 B,再按 40/30/20/10 配比补 A/E/R;每个空格都是下一个要补的缺口。",

  // ---- run detail extras ----
  "run.errorBanner": "运行错误:{error}",
  "run.stepErrors": "该 trace 中有 {count} 个步骤错误",
  "run.attributionCard": "本次运行的归因",
  "run.findingsCard": "Agent 分析结论",
  "run.noTrace": "该运行没有记录 trace",
  "run.chain": "执行链路",
  "run.chainHint": "样本 → 运行 → 追踪 → 评分 → 归因 → Agent 分析",

  // ---- analyses ----
  "analysis.title": "Agent 分析",
  "analysis.new": "发起 Agent 分析",
  "analysis.chooseAgent": "分析 Agent",
  "analysis.noAgents": "尚无归因 Agent — 请先创建一个",
  "analysis.agentsBtn": "分析 Agent",
  "analysis.namePh": "分析名称(可选)",
  "analysis.itemsHint": "拉取该实验的归因题目,并用所选 Agent 逐条分析",
  "analysis.progress": "{done}/{total}",
  "analysis.agrees": "确认根因",
  "analysis.disputes": "缺少翻转证据",

  // ---- attribution agents ----
  "agents.title": "归因分析 Agent",
  "agents.subtitle": "Agent 由「分析场景 + 错误归因标准」组成;分析任务会拉取实验的归因题目,按该标准逐条评审",
  "agents.empty": "暂无 Agent — 创建一个用于分析归因结果",
  "agents.name": "名称",
  "agents.namePh": "例如 skill-triage",
  "agents.scenario": "分析场景",
  "agents.scenarioPh": "该 Agent 面向什么场景?例如:客服对话中的技能触发回归",
  "agents.criteria": "错误归因标准",
  "agents.criteriaPh": "优先关注什么?例如:聚焦 wrong-skill-selected;副作用违规一律视为高严重度",
  "agents.judge": "评审 id",
  "agents.create": "创建 Agent",
  "agents.nameRequired": "Agent 名称为必填项",

  // ---- reports ----
  "reports.title": "分析报告",
  "reports.subtitle": "基于可自定义模板,从实验数据生成 markdown 报告",
  "reports.empty": "暂无报告 — 选择一个实验并生成",
  "reports.generate": "生成报告",
  "reports.chooseExperiment": "实验",
  "reports.chooseTemplate": "模板",
  "reports.chooseTask": "分析任务(可选)",
  "reports.noTask": "— 无 —",
  "reports.namePh": "报告名称(可选)",
  "reports.templates": "报告模板",
  "reports.newTemplate": "新建模板",
  "reports.templateName": "模板名称",
  "reports.templateDesc": "描述",
  "reports.templateContent": "模板内容(markdown,支持 {{placeholders}})",
  "reports.placeholdersHint":
    "可用占位符:{{title}} {{experiment}} {{experimentId}} {{target}} {{targetType}} {{date}} {{agent}} {{metrics}} {{causes}} {{findings}} {{coverage}} {{actions}}",
  "reports.saveTemplate": "保存模板",
  "reports.builtIn": "内置",
  "reports.templateRequired": "模板名称与内容为必填项",
  "reports.view": "查看",
  "reports.backToList": "← 报告列表",

  // ---- skill spec ----
  "skillspec.title": "Agent Skills 规范检查",
  "skillspec.ok": "符合 Agent Skills 规范(agentskills.io)",
  "skillspec.issues": "{count} 个规范问题",

  // ---- language switcher ----
  "lang.label": "语言",
};

const DICTS: Record<Locale, Record<TranslationKey, string>> = { "en-US": en, "zh-CN": zh };

export const LOCALES: { locale: Locale; label: string }[] = [
  { locale: "zh-CN", label: "中文" },
  { locale: "en-US", label: "English" },
];

// ---- storage (injectable so bun:test runs without a DOM) ----

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function memoryStorage(): StorageLike {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

let storage: StorageLike =
  typeof localStorage !== "undefined" ? localStorage : memoryStorage();

function readStoredLocale(): Locale {
  try {
    const v = storage.getItem(LOCALE_STORAGE_KEY);
    return v === "en-US" || v === "zh-CN" ? v : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

let current: Locale = readStoredLocale();

/** Test hook: swap the backing storage and re-read the persisted locale. */
export function setI18nStorage(s: StorageLike): void {
  storage = s;
  current = readStoredLocale();
}

export function getLocale(): Locale {
  return current;
}

export function setLocale(locale: Locale): void {
  current = locale;
  try {
    storage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // persistence is best-effort; the in-memory locale still switches
  }
}

// ---- translation ----

export type TParams = Record<string, string | number>;

function interpolate(template: string, params?: TParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    params[name] != null ? String(params[name]) : match
  );
}

export function t(key: TranslationKey, params?: TParams): string {
  const entry = DICTS[current][key] ?? en[key];
  if (entry == null) {
    console.warn(`[i18n] missing translation key: ${String(key)}`);
    return String(key);
  }
  return interpolate(entry, params);
}

/**
 * Translate a dynamic value (status, root cause, metric name, …) by prefix
 * lookup, e.g. tv("status", run.status). Unmapped values render as-is so new
 * backend enums never break the UI.
 */
export function tv(prefix: string, value: string): string {
  const dict = DICTS[current] as Record<string, string>;
  return dict[`${prefix}.${value}`] ?? value;
}
