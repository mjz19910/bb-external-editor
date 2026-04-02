import { deployScriptSet } from "./lib/fleet"
import { log } from "./lib/log"
import { NetworkMap } from "./lib/network_map"
import { HACK, GROW, WEAKEN } from "./lib/paths"
import { MultiTargetFarm } from "./smart_farm"

/** Main entry point */
export async function main(ns: NS) {
	ns.disableLog("disableLog")
	ns.disableLog("exec")
	ns.disableLog("kill")
	ns.disableLog("getServerUsedRam")
	ns.disableLog("getServerSecurityLevel")
	ns.disableLog("asleep")
	ns.disableLog("getServerMaxRam")
	ns.disableLog("getServerMaxMoney")
	ns.disableLog("getServerMinSecurityLevel")
	ns.disableLog("getServerMoneyAvailable")
	ns.disableLog("scan")
	ns.disableLog("scp")
	ns.disableLog("getHackingLevel")
	ns.disableLog("getServerRequiredHackingLevel")

	const hackPct = Number(ns.args[0] ?? 0.1)
	const map = NetworkMap.build(ns)

	ns.ui.setTailTitle(`Farm Manager hackPercent=${hackPct}`)
	log(ns, `[Farm Manager] hackPercent=${hackPct}`)
	deployScriptSet(ns, [HACK, GROW, WEAKEN], map.hosts)

	const farms: MultiTargetFarm[] = []
	for (let i = 0; i < 10; i++) {
		const farm = new MultiTargetFarm(ns, hackPct, map)
		farms.push(farm)
	}
	ns.atExit(() => {
		for (const farm of farms) {
			farm.shutdown()
		}
	})

	const results = await Promise.allSettled(farms.map((v) => v.runForever()))
	for (const res of results) {
		ns.tprint("farm done ", res)
	}
}
