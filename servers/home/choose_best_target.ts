import { getFarmableTargets } from "./lib/target_pool"
import { scoreTargets, TargetScore } from "./lib/score_target"

export type ChooseBestTargetOptions = {
	/** If true, prefer already-prepped / nearly-prepped servers */
	preferReady?: boolean

	/** Exclude these targets */
	exclude?: string[]

	/** Only accept targets above this readiness */
	minReadiness?: number

	/** Fraction of max money to model per batch */
	hackFraction?: number

	/** Require at least this hack chance */
	minHackChance?: number

	/** Allow only servers <= playerHack * ratio */
	maxHackLevelRatio?: number
}

/**
 * Pick the best target from currently farmable rooted servers.
 */
export function chooseBestTarget(
	ns: NS,
	opts: ChooseBestTargetOptions = {}
): string | null {
	return chooseBestTargetScore(ns, opts)?.target ?? null
}

/**
 * Same as chooseBestTarget(), but returns full score details.
 */
export function chooseBestTargetScore(
	ns: NS,
	opts: ChooseBestTargetOptions = {}
): TargetScore | null {
	const {
		preferReady = true,
		exclude = [],
		minReadiness = 0,
		hackFraction = 0.1,
		minHackChance = 0.2,
		maxHackLevelRatio = 1.0,
	} = opts

	const excluded = new Set(exclude)

	const targets = getFarmableTargets(ns).filter(t => !excluded.has(t))
	if (targets.length === 0) return null

	let scored = scoreTargets(ns, targets, {
		hackFraction,
		minHackChance,
		maxHackLevelRatio,
	})

	if (scored.length === 0) return null

	// Optional readiness filter
	scored = scored.filter(t => t.readiness >= minReadiness)
	if (scored.length === 0) return null

	if (!preferReady) {
		return scored[0] ?? null
	}

	// Prefer ready-ish targets if possible, but fall back gracefully
	const readyThresholds = [0.98, 0.95, 0.9, 0.8, 0.7]

	for (const threshold of readyThresholds) {
		const ready = scored.filter(t => t.readiness >= threshold)
		if (ready.length > 0) return ready[0]
	}

	return scored[0] ?? null
}

// TODO: upgrade to ns.flags()
/** CLI usage:
 * run choose_best_target.ts
 * run choose_best_target.ts false
 * run choose_best_target.ts true foodnstuff,joesguns
 */
export async function main(ns: NS) {
	ns.disableLog("ALL")

	const preferReady = ns.args[0] !== "false"
	const exclude =
		typeof ns.args[1] === "string" && ns.args[1].length > 0
			? String(ns.args[1]).split(",").map(s => s.trim()).filter(Boolean)
			: []

	const best = chooseBestTargetScore(ns, {
		preferReady,
		exclude,
	})

	if (!best) {
		ns.tprint("No valid target found.")
		return
	}

	ns.tprint(`Best target: ${best.target}`)
	ns.tprint(`Final score:      ${fmt(best.finalScore)}`)
	ns.tprint(`Efficiency:       ${fmt(best.efficiencyScore)}`)
	ns.tprint(`Readiness:        ${(best.readiness * 100).toFixed(2)}%`)
	ns.tprint(`Money:            ${ns.format.number(best.currentMoney)} / ${ns.format.number(best.maxMoney)} (${(best.moneyPct * 100).toFixed(1)}%)`)
	ns.tprint(`Security:         ${best.currentSec.toFixed(2)} / min ${best.minSec.toFixed(2)} (+${best.secDelta.toFixed(2)})`)
	ns.tprint(`Hack chance:      ${(best.hackChance * 100).toFixed(2)}%`)
	ns.tprint(`Weaken time:      ${(best.weakenTime / 1000).toFixed(2)}s`)
	ns.tprint(`Hack threads 10%: ${best.hackThreadsFor10Pct}`)
	ns.tprint(`Grow to max:      ${best.growThreadsToMax}`)
	ns.tprint(`Weakens needed:   ${best.weakenThreadsForSecurity}`)
	ns.tprint(`RAM est:          ${best.ramCostEstimate}`)
}

function fmt(n: number): string {
	if (!Number.isFinite(n)) return "inf"
	if (Math.abs(n) >= 1000) return n.toFixed(0)
	if (Math.abs(n) >= 100) return n.toFixed(1)
	if (Math.abs(n) >= 10) return n.toFixed(2)
	return n.toFixed(4)
}
