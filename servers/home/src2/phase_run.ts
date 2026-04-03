import { JobPhaseRunner } from "./JobPhaseRunner"
import { StateManager } from "./StateManager"

export async function main(ns: NS) {
	ns.disableLog("ALL")
	ns.clearLog()

	const reserve = ns.args.includes("--reserve")
		? Number(ns.args[ns.args.indexOf("--reserve") + 1] ?? 32)
		: 32

	const sm = new StateManager(ns)
	const runner = new JobPhaseRunner(ns, sm, reserve)

	runner.copyScripts()

	runner.log("=== Phase 1: Weakening servers ===")
	await runner.runPhase("weaken")

	runner.log("=== Phase 2: Growing servers ===")
	await runner.runPhase("grow")

	runner.log("=== Phase 3: Hacking servers ===")
	await runner.runPhase("hack")

	runner.showStatus()
	runner.log("All phases complete.")
}
