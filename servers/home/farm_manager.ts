import { ScriptPort } from "./ScriptPort"
import { deployScriptSet } from "./lib/fleet"
import { log, tlog } from "./lib/log"
import { NetworkMap } from "./lib/network_map"
import { HACK, GROW, WEAKEN } from "./lib/paths"
import { MultiTargetFarm } from "./smart_farm"

/** Main entry point */
export async function main(ns: NS) {
	ns.disableLog("disableLog")
	MultiTargetFarm.disableLogs(ns)

	const hackPct = Number(ns.args[0] ?? 0.1)
	const map = NetworkMap.build(ns)

	ns.ui.setTailTitle(`Farm Manager hackPercent=${hackPct}`)
	log(ns, `[Farm Manager] hackPercent=${hackPct}`)
	deployScriptSet(ns, [HACK, GROW, WEAKEN], map.hosts)

	const farms: MultiTargetFarm[] = []
	for (let i = 0; i < 1; i++) {
		const farm = new MultiTargetFarm(ns, hackPct, map)
		farms.push(farm)
	}
	ns.atExit(() => {
		for (const farm of farms) {
			farm.shutdown()
		}
	})

	const port = new ScriptPort<{ msg: true }>(ns, 1)
	const raceArr = []
	raceArr.push((async () => {
		for (const [idx, farm] of farms.entries()) {
			raceArr.push((async () => {
				tlog(ns, `[Farm;id=${idx + 1}] Starting`)
				return await farm.runForever()
			})())
			await ns.asleep(2000)
		}
	})())
	raceArr.push(port.nextWrite().then(() => port))
	for (; ;) {
		const [idx, results] = await Promise.race(raceArr.map(async (v, i) => [i, await v] as [number, Awaited<typeof v>]))
		raceArr.splice(idx, 1)
		if (results instanceof ScriptPort) {
			const msgs = results.readAll()
			ns.tprint("got messages ", msgs)
			raceArr.push((async () => {
				for (const _msg of msgs) {
					raceArr.push((async () => {
						const farm = new MultiTargetFarm(ns, hackPct, map)
						farms.push(farm)
						tlog(ns, `[Farm;id=${farms.length}] Starting`)
						return await farm.runForever()
					})())
					await ns.asleep(2000)
				}
			})())
		}
	}
}
