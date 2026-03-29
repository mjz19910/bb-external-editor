/** prep_all.ts
 * Grow all rooted servers to max money and reduce to min security.
 *
 * Usage:
 *   run prep_all.ts
 *   run prep_all.ts --reserve 32
 */
function scanAll(ns: NS): string[] {
	const seen = new Set<string>()
	const queue = ["home"]

	while (queue.length) {
		const host = queue.shift()!
		if (seen.has(host)) continue
		seen.add(host)

		for (const next of ns.scan(host)) {
			if (!seen.has(next)) queue.push(next)
		}
	}

	return [...seen]
}

function formatMoney(ns: NS, n: number) {
	return "$" + ns.format.number(n, 2)
}

export async function main(ns: NS) {
	ns.disableLog("ALL")
	ns.clearLog()

	const reserve = ns.args.includes("--reserve")
		? Number(ns.args[ns.args.indexOf("--reserve") + 1] ?? 0)
		: 0

	const hosts = scanAll(ns).filter(h => ns.hasRootAccess(h))

	const maxRamByHost = new Map<string, number>()
	const serverMaxMoneyMap = new Map<string, number>()
	const serverMinSecMap = new Map<string, number>()
	const scriptRamMap = new Map<string, number>()

	for (const host of hosts) {
		maxRamByHost.set(host, ns.getServerMaxRam(host))
	}

	for (const target of hosts) {
		serverMaxMoneyMap.set(target, ns.getServerMaxMoney(target))
		serverMinSecMap.set(target, ns.getServerMinSecurityLevel(target))
	}

	const weaken1 = ns.weakenAnalyze(1)

	function getPrepSortKey(ns: NS, target: string): number {
		const maxMoney = serverMaxMoneyMap.get(target)!
		const money = Math.max(1, ns.getServerMoneyAvailable(target))
		const sec = serverMinSecMap.get(target)!
		const minSec = ns.getServerMinSecurityLevel(target)

		const weakenThreads = Math.ceil(Math.max(0, sec - minSec) / weaken1)

		const growThreads = money >= maxMoney ? 0 : Math.ceil(ns.growthAnalyze(target, maxMoney / money))

		const weakenForGrow = Math.ceil(ns.growthAnalyzeSecurity(growThreads, target) / weaken1)

		const weakenTime = ns.getWeakenTime(target)
		const growTime = ns.getGrowTime(target)

		return weakenThreads * weakenTime +
			growThreads * growTime * 0.05 +
			weakenForGrow * weakenTime
	}

	const targets = hosts
		.filter(h => h !== "home" && serverMaxMoneyMap.get(h)! > 0)
		.sort((a, b) => getPrepSortKey(ns, a) - getPrepSortKey(ns, b))

	ns.tprint(`Preparing ${targets.length} servers in parallel...`)

	const done = new Set<string>()

	while (done.size < targets.length) {
		for (const target of targets) {
			if (done.has(target)) continue

			const money = ns.getServerMoneyAvailable(target)
			const sec = ns.getServerSecurityLevel(target)
			const maxMoney = serverMaxMoneyMap.get(target)!
			const minSec = serverMinSecMap.get(target)!

			const moneyReady = money >= maxMoney
			const secReady = sec <= minSec + 0.001

			if (!secReady) {
				const launched = launchAcrossNetwork(ns, "tmp/prep_weak.ts", target, reserve, hosts, maxRamByHost, scriptRamMap)
				if (launched > 0) {
					const waitTime = ns.getWeakenTime(target)
					ns.tprint(`${target}: weaken x${launched}, ETA ${ns.format.time(waitTime)}`)
					// await ns.sleep(waitTime)
					await ns.sleep(200)
				}
			} else if (!moneyReady) {
				const launched = launchAcrossNetwork(ns, "tmp/prep_grow.ts", target, reserve, hosts, maxRamByHost, scriptRamMap)
				if (launched > 0) {
					const waitTime = ns.getGrowTime(target)
					ns.tprint(`${target}: grow x${launched}, ETA ${ns.format.time(waitTime)}`)
					// await ns.sleep(waitTime)
					await ns.sleep(200)
				}
			} else {
				ns.tprint(`${target}: READY (${formatMoney(ns, money)} / ${formatMoney(ns, maxMoney)}, sec ${sec.toFixed(2)})`)
				done.add(target)
			}
		}
		await ns.sleep(200)
	}
	ns.tprint("All servers prepped.")
}

function launchAcrossNetwork(
	ns: NS,
	script: string,
	target: string,
	reserve: number,
	hosts: string[],
	maxRamByHost: Map<string, number>,
	scriptRamMap: Map<string, number>
) {
	if (!scriptRamMap.has(script)) {
		scriptRamMap.set(script, ns.getScriptRam(script))
	}
	const ramPerThread = scriptRamMap.get(script)!

	const sortedHosts = hosts
		.filter(h => ns.hasRootAccess(h) && (maxRamByHost.get(h) ?? 0) > 0)
		.sort((a, b) => (maxRamByHost.get(b)! - maxRamByHost.get(a)!))

	let sum = 0
	for (const host of sortedHosts) {
		const maxRam = maxRamByHost.get(host)!
		const usedRam = ns.getServerUsedRam(host)
		const freeRam = host === "home"
			? Math.max(0, maxRam - usedRam - reserve)
			: Math.max(0, maxRam - usedRam)

		const threads = Math.floor(freeRam / ramPerThread)
		if (threads <= 0) continue

		if (host != "home") {
			ns.scp(script, host)
		}

		const pid = ns.exec(script, host, threads, target, threads)
		if (pid !== 0) {
			sum += threads
			if (sum > 2000) break
		}
	}
	return sum
}