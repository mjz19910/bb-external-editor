import { CONFIG } from "../core/config"

export function estimateWeakenThreads(ns: NS, server: ServerState): number {
	const securityGap = Math.max(0, server.currentSecurity - server.minSecurity)
	if (securityGap <= 0) return 1

	const weakenPerThread = ns.weakenAnalyze(1)
	if (weakenPerThread <= 0) return 1

	return clampThreads(Math.ceil(securityGap / weakenPerThread), CONFIG.prep.maxWeakenThreads)
}

export function estimateGrowThreads(ns: NS, server: ServerState): number {
	if (server.maxMoney <= 0) return 1

	const currentMoney = Math.max(1, server.currentMoney)
	const desiredMoney = Math.max(currentMoney, server.maxMoney)
	const growthMultiplier = desiredMoney / currentMoney

	if (growthMultiplier <= 1) return 1

	try {
		const threads = ns.growthAnalyze(server.hostname, growthMultiplier)
		return clampThreads(Math.ceil(threads), CONFIG.prep.maxGrowThreads)
	} catch {
		return 1
	}
}

export function estimateHackThreads(ns: NS, server: ServerState): number {
	const fractionPerThread = ns.hackAnalyze(server.hostname)
	if (fractionPerThread <= 0) return 1

	const desiredFraction = CONFIG.prep.targetHackFraction
	const threads = Math.ceil(desiredFraction / fractionPerThread)

	return clampThreads(threads, CONFIG.prep.maxHackThreads)
}

function clampThreads(value: number, max: number): number {
	return Math.max(1, Math.min(max, value))
}
