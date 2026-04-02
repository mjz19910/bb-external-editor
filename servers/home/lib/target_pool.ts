// lib/target_pool.ts

import { NetworkMap } from "./network_map"

export function getFarmableTargets(ns: NS): string[] {
	const map = NetworkMap.build(ns)

	return map.allHosts
		.filter(host => host !== "home")
		.filter(host => ns.hasRootAccess(host))
		.filter(host => ns.getServerMaxMoney(host) > 0)
		.filter(host => ns.getServerRequiredHackingLevel(host) <= ns.getHackingLevel())
}
