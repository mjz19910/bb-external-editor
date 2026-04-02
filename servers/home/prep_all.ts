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

	// Server state maps
	const srvWeakenTime = new Map<string, number>()
	const srvMaxMoney = new Map<string, number>()
	const srvMinSec = new Map<string, number>()
	const maxRamByHost = new Map<string, number>()

	for (const host of hosts) maxRamByHost.set(host, map.ramSizes[host])
	for (const target of hosts) {
		srvMaxMoney.set(target, ns.getServerMaxMoney(target))
		srvMinSec.set(target, ns.getServerMinSecurityLevel(target))
		if (target !== "home") srvWeakenTime.set(target, ns.getWeakenTime(target))
	}

	const targets = hosts.filter((h) => h !== "home" && srvMaxMoney.get(h)! > 0)
	targets.sort((a, b) => (srvWeakenTime.get(a)! - srvWeakenTime.get(b)!))

	for (const target of targets) {
		const waitTime = srvWeakenTime.get(target)!
		log(`${target}: weaken ETA ${ns.format.time(waitTime)}`)
	}

	log(`\nPreparing ${targets.length} servers in parallel...`)

	const scriptRamMap = new Map<string, number>()
	const done = new Set<string>()

	while (done.size < targets.length) {
		for (const target of targets) {
			if (done.has(target)) continue

			const money = ns.getServerMoneyAvailable(target)
			const sec = ns.getServerSecurityLevel(target)
			const maxMoney = srvMaxMoney.get(target)!
			const minSec = srvMinSec.get(target)!

			const moneyReady = money >= maxMoney
			const secReady = sec <= minSec + 0.001

			// Determine script and threads needed
			let script = ""
			let threadsNeeded = 0

			if (!secReady) {
				script = WEAK
				const weakenPerThread = ns.weakenAnalyze(1)
				threadsNeeded = Math.ceil(Math.max(0, sec - minSec) / weakenPerThread)
			} else if (!moneyReady) {
				script = GROW
				threadsNeeded = Math.ceil(ns.growthAnalyze(target, maxMoney / Math.max(1, money)))
			} else {
				log(
					`${target}: READY (${formatMoney(ns, money)} / ${formatMoney(ns, maxMoney)}, sec ${sec.toFixed(
						2
					)})`
				)
				done.add(target)
				continue
			}

			if (!scriptRamMap.has(script)) scriptRamMap.set(script, ns.getScriptRam(script))
			const ramPerThread = scriptRamMap.get(script)!

			// Inline launch across network
			let launchedThreads = 0
			const sortedHosts = hosts
				.filter((h) => ns.hasRootAccess(h) && (maxRamByHost.get(h) ?? 0) > 0)
				.sort((a, b) => (maxRamByHost.get(b)! - maxRamByHost.get(a)!))

			for (const host of sortedHosts) {
				if (threadsNeeded <= 0) break

				const maxRam = maxRamByHost.get(host)!
				const usedRam = ns.getServerUsedRam(host)
				const freeRam = host === "home" ? Math.max(0, maxRam - usedRam - reserve) : Math.max(0, maxRam - usedRam)

				const hostThreads = Math.min(Math.floor(freeRam / ramPerThread), threadsNeeded)
				if (hostThreads <= 0) continue

				const pid = ns.exec(script, host, hostThreads, target, hostThreads)
				if (pid !== 0) {
					launchedThreads += hostThreads
					threadsNeeded -= hostThreads
					await ns.sleep(50) // small stagger
				}
			}

			if (launchedThreads > 0) {
				const waitTime = script === WEAK ? ns.getWeakenTime(target) : ns.getGrowTime(target)
				log(`${target}: ${script === WEAK ? "weaken" : "grow"} x${launchedThreads}, ETA ${ns.format.time(waitTime)}`)
				await ns.sleep(waitTime)
			}
		}
		await ns.sleep(5000) // loop pause
	}

	log("All servers prepped.")
}
