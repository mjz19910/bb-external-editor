// lib/score_target.ts

export type TargetScore = {
	target: string

	// raw stats
	maxMoney: number
	currentMoney: number
	moneyPct: number

	minSec: number
	currentSec: number
	secDelta: number

	hackChance: number
	weakenTime: number

	// thread estimates
	hackThreadsFor10Pct: number
	growThreadsToMax: number
	weakenThreadsForSecurity: number

	// scoring
	prepPenalty: number
	ramCostEstimate: number
	readiness: number
	incomeEstimate: number
	efficiencyScore: number
	finalScore: number
}

export type ScoreTargetOptions = {
	/** Fraction of max money to model per batch */
	hackFraction?: number

	/** Penalty multiplier for unprepped targets */
	prepPenaltyWeight?: number

	/** Ignore targets below this chance */
	minHackChance?: number

	/** Optional hard filter */
	maxHackLevelRatio?: number
}

export function scoreTargetEx(
	ns: NS,
	target: string,
	opts: ScoreTargetOptions = {}
): TargetScore | null {
	const {
		hackFraction = 0.1,
		prepPenaltyWeight = 2.5,
		minHackChance = 0.15,
		maxHackLevelRatio = 1.0,
	} = opts

	const playerHack = ns.getHackingLevel()
	const reqHack = ns.getServerRequiredHackingLevel(target)

	if (reqHack > playerHack * maxHackLevelRatio) return null
	if (!ns.hasRootAccess(target)) return null

	const maxMoney = ns.getServerMaxMoney(target)
	if (maxMoney <= 0) return null

	const currentMoney = Math.max(1, ns.getServerMoneyAvailable(target))
	const moneyPct = currentMoney / maxMoney

	const minSec = ns.getServerMinSecurityLevel(target)
	const currentSec = ns.getServerSecurityLevel(target)
	const secDelta = Math.max(0, currentSec - minSec)

	const hackChance = ns.hackAnalyzeChance(target)
	if (hackChance < minHackChance) return null

	const weakenTime = ns.getWeakenTime(target)

	// How many hack threads to steal hackFraction of current max
	const hackPctPerThread = ns.hackAnalyze(target)
	const hackThreadsFor10Pct =
		hackPctPerThread > 0 ? Math.ceil(hackFraction / hackPctPerThread) : Number.MAX_SAFE_INTEGER

	// How many grow threads to go from current money back to max
	let growThreadsToMax = 0
	if (moneyPct < 0.999) {
		const growthMult = maxMoney / Math.max(1, currentMoney)
		try {
			growThreadsToMax = Math.ceil(ns.growthAnalyze(target, growthMult))
		} catch {
			growThreadsToMax = Number.MAX_SAFE_INTEGER
		}
	}

	// How many weakens to clear current sec drift + estimated HG security impact
	const hackSec = hackThreadsFor10Pct * 0.002
	const growSec = growThreadsToMax * 0.004
	const totalSecToRemove = secDelta + hackSec + growSec
	const weakenThreadsForSecurity = Math.ceil(totalSecToRemove / 0.05)

	// Prep/readiness model
	const moneyReadiness = clamp01(moneyPct)
	const secReadiness = clamp01(1 - secDelta / 25) // heuristic
	const readiness = moneyReadiness * secReadiness

	// Penalize ugly targets that need lots of prep before they become productive
	const prepPenalty =
		(1 - readiness) * prepPenaltyWeight +
		secDelta * 0.03 +
		(1 - moneyPct) * 1.5

	// Rough RAM proxy: total threads required to run a productive cycle
	const ramCostEstimate =
		hackThreadsFor10Pct +
		growThreadsToMax +
		weakenThreadsForSecurity

	// Income estimate for one "idealized" batch
	const incomeEstimate = maxMoney * hackFraction * hackChance

	// Core metric: money per time per estimated RAM burden
	const efficiencyScore =
		incomeEstimate / Math.max(1, weakenTime / 1000) / Math.max(1, ramCostEstimate)

	const finalScore = efficiencyScore / Math.max(0.25, prepPenalty)

	return {
		target,
		maxMoney,
		currentMoney,
		moneyPct,
		minSec,
		currentSec,
		secDelta,
		hackChance,
		weakenTime,
		hackThreadsFor10Pct,
		growThreadsToMax,
		weakenThreadsForSecurity,
		prepPenalty,
		ramCostEstimate,
		readiness,
		incomeEstimate,
		efficiencyScore,
		finalScore,
	}
}

export function scoreTargetsEx(
	ns: NS,
	targets: string[],
	opts: ScoreTargetOptions = {}
): TargetScore[] {
	return targets
		.map(t => scoreTargetEx(ns, t, opts))
		.filter((x): x is TargetScore => x !== null)
		.sort((a, b) => b.finalScore - a.finalScore)
}

function clamp01(x: number): number {
	return Math.max(0, Math.min(1, x))
}

export function scoreTarget(ns: NS, target: string): number {
	const server = ns.getServer(target)
	if ("isOnline" in server) throw new Error("Unable to handle darkweb server")

	// Skip servers you can't hack
	if (ns.getHackingLevel() < server.requiredHackingSkill!) return -Infinity

	const moneyRatio = server.moneyMax! > 0 ? server.moneyAvailable! / server.moneyMax! : 0
	const securityRatio = (server.minDifficulty! / Math.max(server.hackDifficulty!, 1)) // lower is better
	const hackDifficultyFactor = Math.max(0.1, (server.requiredHackingSkill! / ns.getHackingLevel())) // <=1 is easier
	const potentialMoney = server.moneyMax!

	// Weighted scoring formula (can tune weights)
	const score =
		potentialMoney * moneyRatio * securityRatio / hackDifficultyFactor

	return score
}
