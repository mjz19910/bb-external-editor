// recovery.ts
import { StateManager } from "./lib/state"

export async function main(ns: NS) {
	ns.disableLog("ALL")
	const state = new StateManager(ns)

	while (true) {
		for (const hostname in state.state.servers) {
			const server = state.getServer(hostname)
			const running = ns.ps(hostname).map(p => p.pid.toString())

			// Remove jobs that are no longer running
			server.activeJobs = server.activeJobs.filter(j => running.includes(j))
			server.usedRam = ns.getServerUsedRam(hostname)
			state.updateServer(hostname, server)
		}

		// Reset targets if stuck
		for (const tName in state.state.targets) {
			const t = state.getTarget(tName)
			if (t.activeBatches > 5) { // arbitrary sanity check
				t.activeBatches = 0
				state.updateTarget(tName, t)
				ns.print(`Resetting ${tName} due to stuck batches`)
			}
		}

		await ns.sleep(5000)
	}
}
