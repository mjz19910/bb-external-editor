
export type PrepPlanV1 = {
	needWeaken: number
	needGrow: number
	needGrowWeaken: number
	totalWeaken: number
	isPrepped: boolean
}

export function calcPrepPlanV1(ns: NS, target: string): PrepPlanV1 {
	const sec = ns.getServerSecurityLevel(target)
	const minSec = ns.getServerMinSecurityLevel(target)
	const money = Math.max(1, ns.getServerMoneyAvailable(target))
	const maxMoney = Math.max(1, ns.getServerMaxMoney(target))

	const secDiff = Math.max(0, sec - minSec - 0.3)
	const weakenPerThread = ns.weakenAnalyze(1)
	const needWeaken = Math.ceil(secDiff / weakenPerThread)

	let needGrow = 0
	let needGrowWeaken = 0

	if (money < maxMoney * 0.35) {
		const growthFactor = maxMoney / money
		needGrow = Math.ceil(ns.growthAnalyze(target, growthFactor))
		const growSec = ns.growthAnalyzeSecurity(needGrow)
		needGrowWeaken = Math.ceil(growSec / weakenPerThread)
	}

	const totalWeaken = needWeaken + needGrowWeaken
	const isPrepped = needWeaken === 0 && needGrow === 0 &&
		needGrowWeaken === 0

	return {
		needWeaken,
		needGrow,
		needGrowWeaken,
		totalWeaken,
		isPrepped,
	}
}

export function calcHackThreadsForPercent(
	ns: NS,
	target: string,
	percent = 0.1,
): number {
	const perThread = ns.hackAnalyze(target)
	if (perThread <= 0) return 0
	return Math.max(1, Math.floor(percent / perThread))
}

/**
 * calcPrepPlan
 * Calculate how many grow and weaken threads are needed to prep a target
 * so it can be safely hacked at desired hack percent.
 */

interface PrepPlanOptions {
	growThreshold?: number    // e.g., 0.98 -> grow until 98% max money
	weakenThreshold?: number  // e.g., 1.02 -> weaken until security <= 2% above min
}

export interface PrepPlan {
	growThreads: number
	weakenThreads: number
}

/**
 * Calculate prep plan for a target
 */
export function calcPrepPlan(ns: NS, target: string, options: PrepPlanOptions = {}): PrepPlan {
	const maxMoney = ns.getServerMaxMoney(target)
	const moneyAvailable = ns.getServerMoneyAvailable(target)
	const minSec = ns.getServerMinSecurityLevel(target)
	const currentSec = ns.getServerSecurityLevel(target)

	const growThreshold = options.growThreshold ?? 0.98
	const weakenThreshold = options.weakenThreshold ?? 1.02

	// Calculate needed grow threads
	let growThreads = 0
	if (moneyAvailable / maxMoney < growThreshold) {
		const growFactor = Math.min(maxMoney / Math.max(moneyAvailable, 1), 1000) // cap factor
		growThreads = Math.ceil(ns.growthAnalyze(target, growFactor))
	}

	// Calculate needed weaken threads
	let weakenThreads = 0
	const targetSec = minSec * weakenThreshold   // apply weaken threshold here
	const secDelta = currentSec - targetSec
	if (secDelta > 0) {
		weakenThreads = Math.ceil(secDelta / ns.weakenAnalyze(1))
	}

	return {
		growThreads,
		weakenThreads,
	}
}
