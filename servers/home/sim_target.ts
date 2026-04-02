/**
 * sim_target.ts
 * Simulate potential batches for a target to estimate $/sec and RAM efficiency.
 */

import { getConfig } from "./lib/config_helpers"
import { calcHackThreadsForPercent, calcPrepPlan } from "./lib/prep"

export async function main(ns: NS) {
	ns.disableLog("ALL")

	const target = ns.args[0] as string
	if (!target) {
		ns.tprint("Usage: run sim_target.js <target>")
		return
	}

	// Load config
	const hackPercent = getConfig("batchHackPercent", 0.05)
	const prepGrowThreshold = getConfig("prepGrowThreshold", 0.98)
	const prepWeakenThreshold = getConfig("prepWeakenThreshold", 1.02)

	// Get server stats
	const serverMaxMoney = ns.getServerMaxMoney(target)
	const serverMoney = ns.getServerMoneyAvailable(target)

	// Calculate prep plan with proper thresholds
	const prepPlan = calcPrepPlan(ns, target, {
		growThreshold: prepGrowThreshold,
		weakenThreshold: prepWeakenThreshold,
	})

	// Calculate hack threads
	const hackThreads = calcHackThreadsForPercent(ns, target, hackPercent)

	// Calculate RAM usage
	const hackRam = ns.getScriptRam("lib/hack.js") * hackThreads
	const growRam = ns.getScriptRam("lib/grow.js") * prepPlan.growThreads
	const weakenRam = ns.getScriptRam("lib/weaken.js") * prepPlan.weakenThreads
	const totalRam = hackRam + growRam + weakenRam

	// Calculate expected hack income
	const expectedHackMoney = serverMaxMoney * hackPercent
	const hackTime = ns.getHackTime(target) / 1000 // seconds

	const incomePerSec = expectedHackMoney / hackTime
	const efficiency = totalRam > 0 ? incomePerSec / totalRam : 0

	// Display simulation
	ns.tprint(`=== Simulation for ${target} ===`)
	ns.tprint(`Server money: ${serverMoney} / ${serverMaxMoney}`)
	ns.tprint(`Hack threads: ${hackThreads}`)
	ns.tprint(`Grow threads: ${prepPlan.growThreads}`)
	ns.tprint(`Weaken threads: ${prepPlan.weakenThreads}`)
	ns.tprint(`Total RAM: ${totalRam.toFixed(2)} GB`)
	ns.tprint(`Expected hack $: ${expectedHackMoney.toFixed(2)}`)
	ns.tprint(`Hack time: ${hackTime.toFixed(2)} s`)
	ns.tprint(`Income/sec: ${incomePerSec.toFixed(2)}`)
	ns.tprint(`Efficiency ($/sec/GB): ${efficiency.toFixed(2)}`)
}
