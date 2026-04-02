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

	// Inline helper to calculate threads
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

	log(`Starting prep of ${targets.length} servers...`)

	const jobsEndTimes = new Map<string, number>()

	while (targets.length > 0) {
		// Launch all jobs that are still needed
		for (const target of targets) {
			const sec = ns.getServerSecurityLevel(target)
			const money = ns.getServerMoneyAvailable(target)
			const minSec = srvMinSec.get(target)!
			const maxMoney = srvMaxMoney.get(target)!

			const needsWeaken = sec > minSec
			const needsGrow = money < maxMoney

			if (!needsWeaken && !needsGrow) {
				log(`${target}: READY (${formatMoney(ns, money)} / ${formatMoney(ns, maxMoney)}, sec ${sec.toFixed(2)})`)
				jobsEndTimes.delete(target)
				continue
			}

			const tasks: { script: string; threads: number; duration: number }[] = []
			if (needsWeaken) tasks.push({ script: WEAK, threads: threadsNeeded(target, WEAK), duration: ns.getWeakenTime(target) })
			if (needsGrow) tasks.push({ script: GROW, threads: threadsNeeded(target, GROW), duration: ns.getGrowTime(target) })

			let maxEnd = 0

			for (const task of tasks) {
				if (!scriptRamMap.has(task.script)) scriptRamMap.set(task.script, ns.getScriptRam(task.script))
				const ramPerThread = scriptRamMap.get(task.script)!
				let threadsLeft = task.threads

				// Distribute threads across hosts
				const sortedHosts = hosts
					.filter((h) => ns.hasRootAccess(h) && (maxRamByHost.get(h) ?? 0) > 0)
					.sort((a, b) => (maxRamByHost.get(b)! - maxRamByHost.get(a)!))

				let launched = 0
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
						launched += hostThreads
					}
				}

				if (launched > 0) {
					const endTime = Date.now() + task.duration
					maxEnd = Math.max(maxEnd, endTime)
					log(`${target}: launched ${task.script} x${launched}, ETA ${ns.format.time(task.duration)}`)
				}
			}

			if (maxEnd > 0) jobsEndTimes.set(target, maxEnd)
		}

		// Remove finished targets
		for (const target of targets.slice()) {
			if (!jobsEndTimes.has(target)) {
				targets.splice(targets.indexOf(target), 1)
			}
		}

		if (jobsEndTimes.size === 0) break

		// Wait for the next job to finish (shortest end time)
		const nextEnd = Math.min(...jobsEndTimes.values())
		const sleepMs = Math.max(0, nextEnd - Date.now() + 50) // 50ms buffer
		const [target] = [...jobsEndTimes.entries()].find(v => v[1] == nextEnd)!
		log(`${target}: waiting ${ns.format.time(sleepMs)} for next prep`)
		await ns.sleep(sleepMs)
	}

	log("All servers prepped.")
}
