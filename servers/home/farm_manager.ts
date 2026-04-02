import { ScriptPort } from "./ScriptPort"
import { deployScriptSet } from "./lib/fleet"
import { tlog } from "./lib/log"
import { NetworkMap } from "./lib/network_map"
import { HACK, GROW, WEAKEN } from "./lib/paths"
import { MultiTargetFarm } from "./MultiTargetFarm"
import { RoundRobinTargetLogger } from "./RoundRobinTargetLogger"

/** Main entry point */
export async function main(ns: NS) {
	ns.disableLog("disableLog")
	MultiTargetFarm.disableLogs(ns)

	const hackPct = Number(ns.args[0] ?? 0.1)
	const map = NetworkMap.build(ns)

	ns.ui.setTailTitle(`Farm Manager hackPercent=${hackPct}`)
	tlog(ns, `[Farm Manager] hackPercent=${hackPct}`)
	deployScriptSet(ns, [HACK, GROW, WEAKEN], map.allHosts)

	const logger = new RoundRobinTargetLogger(ns, map.allHosts)
	const raceArr: Promise<null | void>[] = []
	const farms: MultiTargetFarm[] = []
	let farmIdBase = 1

	function addFarm(arr: MultiTargetFarm[], hackPct: number, logger: RoundRobinTargetLogger, silent = false) {
		if (!silent) {
			tlog(ns, `[Farm;id=${farmIdBase}] Starting`)
		}
		const farm = new MultiTargetFarm(ns, hackPct, map)
		farm.setLogger(logger)
		arr.push(farm)
		raceArr.push(farm.runForever())
		farmIdBase++
		return farm
	}

	let running = true

	ns.atExit(() => {
		for (const farm of farms) {
			farm.shutdown()
		}
		logger.shutdown()
		running = false
	})

	const port = new ScriptPort<{
		msg: true
		hackPct?: number
	}>(ns, 1)
	raceArr.push(port.nextWrite().then(() => null))

	async function slowStart() {
		let hadAnyErrors = false
		// 1 = 131.04TB + 216.96TB
		// 2 = 38% of pserv-01
		// 3 = 1.26PB
		// 4 =
		// 40 = 11
		for (let i = 0; i < 18; i++) {
			addFarm(farms, hackPct, logger)
			ns.print("added farm id=", farms.length)
			do {
				await ns.asleep(5_500)
				if (!running) break
				const errs = farms.filter(v => v.hasErrors())
				if (errs.length > 0) {
					ns.tprint("farms that have errors ", errs.map(v => farms.indexOf(v)))
					hadAnyErrors = true
				}
			} while (farms.some(v => v.hasErrors()))
			if (hadAnyErrors) break
			if (!running) break
		}
		ns.tprint("[Farm Manager] ", farms.length, " farms are now running")
	}
	raceArr.push(slowStart())

	for (; ;) {
		const { idx, result } = await Promise.race(raceArr.map(async (promise, idx) => ({ idx, result: await promise })))
		raceArr.splice(idx, 1)
		if (result === void 0) continue
		const msgs = port.readAll()
		ns.tprint("got messages ", msgs)
		raceArr.push(port.nextWrite().then(() => null))
		for (const msg of msgs) {
			addFarm(farms, msg.hackPct ?? hackPct, logger)
			ns.print("added farm id=", farms.length)
			await ns.asleep(5_500)
			const errs = farms.filter(v => v.hasErrors())
			if (errs.length > 0) {
				ns.tprint("farms that have errors ", errs.map(v => farms.indexOf(v)))
			}
		}
	}
}
