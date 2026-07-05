// Capability × tier coverage analysis for high-quality eval datasets.
// Methodology: cover as many scenarios as possible with as few cases as
// possible — every sample is placed in a (capability dimension × tier) cell,
// tiers follow the B40/A30/E20/R10 budget, and gaps are reported as concrete
// authoring actions (empty cells, tier deficits, untagged samples).

import type {
  CoverageCell,
  CoverageGap,
  CoverageReport,
  Sample,
  SampleTier,
  TierDistribution,
} from "../core/types.ts";
import { SAMPLE_TIERS, TIER_TARGETS } from "../core/types.ts";

/** Deficit tolerance in share points before a tier counts as a gap. */
const TIER_TOLERANCE = 0.1;

export function computeCoverage(sampleSetId: string, samples: Sample[]): CoverageReport {
  const tagged = samples.filter((s) => s.capability && s.tier);
  const untagged = samples.length - tagged.length;
  const capabilities = [...new Set(tagged.map((s) => s.capability as string))].sort();

  const cells: CoverageCell[] = [];
  for (const capability of capabilities) {
    for (const tier of SAMPLE_TIERS) {
      const hits = tagged.filter((s) => s.capability === capability && s.tier === tier);
      cells.push({ capability, tier, count: hits.length, sampleIds: hits.map((s) => s.id) });
    }
  }

  const tiers: TierDistribution[] = SAMPLE_TIERS.map((tier) => {
    const count = tagged.filter((s) => s.tier === tier).length;
    const actual = tagged.length ? count / tagged.length : 0;
    const target = TIER_TARGETS[tier];
    return { tier, count, actual: round(actual), target, deviation: round(actual - target) };
  });

  const gaps: CoverageGap[] = [];
  for (const cell of cells) {
    if (cell.count === 0) {
      gaps.push({
        capability: cell.capability,
        tier: cell.tier,
        kind: "empty-cell",
        detail: `capability "${cell.capability}" has no ${cell.tier}-tier sample`,
      });
    }
  }
  for (const d of tiers) {
    if (tagged.length > 0 && d.actual + TIER_TOLERANCE < d.target) {
      gaps.push({
        capability: null,
        tier: d.tier,
        kind: "tier-deficit",
        detail: `tier ${d.tier} at ${(d.actual * 100).toFixed(0)}% vs target ${(d.target * 100).toFixed(0)}%`,
      });
    }
  }
  if (untagged > 0) {
    gaps.push({
      capability: null,
      tier: null,
      kind: "untagged",
      detail: `${untagged} sample(s) missing capability/tier tags`,
    });
  }

  return {
    sampleSetId,
    total: samples.length,
    tagged: tagged.length,
    untagged,
    capabilities,
    cells,
    tiers,
    gaps,
  };
}

/** Suggested tier for the next sample: the tier with the largest deficit. */
export function nextTierSuggestion(report: CoverageReport): SampleTier {
  let best: SampleTier = "B";
  let worst = Infinity;
  for (const d of report.tiers) {
    if (d.deviation < worst) {
      worst = d.deviation;
      best = d.tier;
    }
  }
  return best;
}

const round = (n: number) => Math.round(n * 10000) / 10000;
