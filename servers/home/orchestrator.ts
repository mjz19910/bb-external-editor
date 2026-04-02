// orchestrator.ts
import { StateManager } from "./lib/state"

export async function main(ns: NS) {
	ns.disableLog("ALL")
	const state = new StateManager(ns)

	while (true) {
		// 1. Update server info
		const servers = ns.cloud.getServerNames().concat(["home"])
		for (const host of servers) {
			const usedRam = ns.getServerUsedRam(host)
			state.updateServer(host, { usedRam })
		}

		// 2. Choose best target (placeholder, can call your scoring system)
		const bestTargetName = "n00dles" // replace with score_target.ts logic
		const target = state.getTarget(bestTargetName)

		// 3. Decide action
		if (!target.isPrepped) {
			ns.print(`Prepping ${bestTargetName}`)
			// call prep_all.ts or batch prep function
		} else {
			ns.print(`Launching batches on ${bestTargetName}`)
			// call farm_all.ts or batch manager
		}

		await ns.sleep(1000)
	}
}
