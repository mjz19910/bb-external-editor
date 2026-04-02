// farm_manager.ts
import { StateManager } from "./lib/state"
import { scoreTarget } from "./lib/score_target" // your scoring system

export async function main(ns: NS) {
	ns.disableLog("ALL")
	const state = new StateManager(ns)

	while (true) {
		// 2️⃣ Pick the best target
		const candidateTargets = ["n00dles", "foodnstuff", "sigma-cosmetics"] // extend with your network
		let bestScore = -Infinity
		let bestTarget = candidateTargets[0]
		for (const t of candidateTargets) {
			const score = scoreTarget(ns, t)
			if (score > bestScore) {
				bestScore = score
				bestTarget = t
			}
		}

		const targetState = state.getTarget(bestTarget)

		// 3️⃣ Decide action based on prep status
		if (!targetState.isPrepped) {
			ns.print(`Target ${bestTarget} needs prep. Launching prep...`)
			ns.run("prep_all.ts", 1, bestTarget)
		} else {
			ns.print(`Target ${bestTarget} ready. Launching farm...`)
			// farm_all.ts will handle batching & RAM allocation
			ns.run("farm_all.ts", 1, bestTarget)
		}

		await ns.sleep(5000) // loop every 5s
	}
}
