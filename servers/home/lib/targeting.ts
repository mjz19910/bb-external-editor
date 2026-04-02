import { buildNetworkMap, classifyServer } from "./network_map"

export type TargetInfo = {
	host: string
	score: number
	maxMoney: number
	money: number
	minSec: number
	sec: number
	reqHack: number
	growth: number
}

export function getFarmableTargets(ns: NS): string[] {
	const map = buildNetworkMap(ns)
	const out: TargetInfo[] = []

	for (const host of map.allHosts) {
		if (classifyServer(ns, host) !== "farmable") continue

		const maxMoney = ns.getServerMaxMoney(host)
		const money = ns.getServerMoneyAvailable(host)
		const minSec = ns.getServerMinSecurityLevel(host)
		const sec = ns.getServerSecurityLevel(host)
		const reqHack = ns.getServerRequiredHackingLevel(host)
		const growth = ns.getServerGrowth(host)

		if (maxMoney <= 0) continue

		const score = (maxMoney * growth) / Math.max(1, minSec * reqHack)

		out.push({
			host,
			score,
			maxMoney,
			money,
			minSec,
			sec,
			reqHack,
			growth,
		})
	}

	out.sort((a, b) => b.score - a.score)
	return out.map(v => v.host)
}

export function chooseBestTarget(ns: NS): string | null {
	return getFarmableTargets(ns)[0] ?? null
}
