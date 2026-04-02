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
