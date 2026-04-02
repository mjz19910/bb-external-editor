/** prep_all.ts
 * Grow all rooted servers to max money and reduce to min security.
 *
 * Usage:
 *   run prep_all.ts
 *   run prep_all.ts --reserve 32
 */
import { buildNetworkMap } from "./lib/network_map"

function formatMoney(ns: NS, n: number) {
	return "$" + ns.format.number(n, 2)
}

const GROW = "lib/prep_grow.ts"
const WEAK = "lib/prep_weak.ts"
const all_scripts = [GROW, WEAK]

export async function main(ns: NS) {
	function log(...args: any[]) {
		ns.tprint(...args)
		ns.print(...args)
	}

	ns.disableLog("ALL")
	ns.clearLog()

	const reserve = ns.args.includes("--reserve")
		? Number(ns.args[ns.args.indexOf("--reserve") + 1] ?? 32)
		: 32

	const map = buildNetworkMap(ns)
	const hosts = map.allHosts.filter((h) => ns.hasRootAccess(h))

	// Copy prep scripts to all hosts
	for (const host of hosts) {
		if (host !== "home") ns.scp(all_scripts, host)
	}

	// Maps for server state
	const srvMaxMoney = new Map<string, number>()
	const srvMinSec = new Map<string, number>()
	const maxRamByHost = new Map<string, number>()
	const scriptRamMap = new Map<string, number>()

	for (const host of hosts) maxRamByHost.set(host, map.ramSizes[host])
	for (const target of hosts) {
		srvMaxMoney.set(target, ns.getServerMaxMoney(target))
		srvMinSec.set(target, ns.getServerMinSecurityLevel(target))
	}

	const targets = hosts.filter((h) => h !== "home" && srvMaxMoney.get(h)! > 0)

	// Inline function to calculate needed threads
	function threadsNeeded(target: string, script: string): number {
		if (script === WEAK) {
			const sec = ns.getServerSecurityLevel(target)
			const minSec = srvMinSec.get(target)!
			if (sec <= minSec) return 0
			return Math.ceil((sec - minSec) / ns.weakenAnalyze(1))
		} else if (script === GROW) {
			const money = Math.max(1, ns.getServerMoneyAvailable(target))
			const maxMoney = srvMaxMoney.get(target)!
			if (money >= maxMoney) return 0
			return Math.ceil(ns.growthAnalyze(target, maxMoney / money))
		}
		return 0
	}

	log(`Starting prep of ${targets.length} servers in parallel...`)

	// Launch all jobs in one go
	for (const target of targets) {
		let sec = ns.getServerSecurityLevel(target)
		let money = ns.getServerMoneyAvailable(target)
		const minSec = srvMinSec.get(target)!
		const maxMoney = srvMaxMoney.get(target)!

		// Determine what needs to run
		const needsWeaken = sec > minSec
		const needsGrow = money < maxMoney

		if (!needsWeaken && !needsGrow) {
			log(`${target}: READY (${formatMoney(ns, money)} / ${formatMoney(ns, maxMoney)}, sec ${sec.toFixed(2)})`)
			continue
		}

		const tasks: { script: string; threads: number }[] = []
		if (needsWeaken) tasks.push({ script: WEAK, threads: threadsNeeded(target, WEAK) })
		if (needsGrow) tasks.push({ script: GROW, threads: threadsNeeded(target, GROW) })

		for (const task of tasks) {
			if (!scriptRamMap.has(task.script)) scriptRamMap.set(task.script, ns.getScriptRam(task.script))
			const ramPerThread = scriptRamMap.get(task.script)!
			let threadsLeft = task.threads

			// Distribute across all hosts
			const sortedHosts = hosts
				.filter((h) => ns.hasRootAccess(h) && (maxRamByHost.get(h) ?? 0) > 0)
				.sort((a, b) => (maxRamByHost.get(b)! - maxRamByHost.get(a)!))

			for (const host of sortedHosts) {
				if (threadsLeft <= 0) break

				const maxRam = maxRamByHost.get(host)!
				const usedRam = ns.getServerUsedRam(host)
				const freeRam = host === "home" ? Math.max(0, maxRam - usedRam - reserve) : Math.max(0, maxRam - usedRam)
				const hostThreads = Math.min(Math.floor(freeRam / ramPerThread), threadsLeft)

				if (hostThreads <= 0) continue

				const pid = ns.exec(task.script, host, hostThreads, target, hostThreads)
				if (pid !== 0) {
					threadsLeft -= hostThreads
				}
			}

			log(`${target}: launched ${task.script} x${task.threads - threadsLeft}`)
		}
	}

	log("All prep jobs started. Waiting for completion...")

	// Wait for all targets to finish
	for (const target of targets) {
		const weakenTime = ns.getWeakenTime(target)
		const growTime = ns.getGrowTime(target)
		const waitTime = Math.max(weakenTime, growTime)
		log(`${target}: waiting up to ${ns.format.time(waitTime)} for prep`)
		await ns.sleep(waitTime + 500) // small buffer
	}

	log("All servers prepped.")
}
