import { JobPhaseRunner } from "./JobPhaseRunner"
import { StateManager } from "./StateManager"

export async function main(ns: NS) {
	ns.disableLog("ALL")
	ns.clearLog()

	const sm = new StateManager(ns)
	const runner = new JobPhaseRunner(ns, sm)

	runner.copyScripts()

	runner.log("=== Hacking servers ===")
	await runner.runPhase("hack")

	runner.showStatus()
	runner.log("Complete.")
}
