// farm_all.ts
import { StateManager } from "./lib/state"
import { allocateThreadsSimple } from "../../servers/home/src2/fleet" // your existing helpers

export async function main(ns: NS) {
	ns.disableLog("ALL")
	if (ns.args.length < 1) {
		ns.tprint("Usage: run farm_all.js <target>")
		return
	}
	const target = ns.args[0] as string
	const state = new StateManager(ns)
	const targetState = state.getTarget(target)

	// 1️⃣ Update server info
	const servers = ns.cloud.getServerNames().concat(["home"])
	for (const s of servers) {
		const usedRam = ns.getServerUsedRam(s)
		state.updateServer(s, { usedRam })
	}

	// 2️⃣ Compute threads for each script (hack/grow/weaken)
	const hackThreads = allocateThreadsSimple(ns, "lib/hack.ts", target)
	const growThreads = allocateThreadsSimple(ns, "lib/grow.ts", target)
	const weakenThreads = allocateThreadsSimple(ns, "lib/weaken.ts", target)

	// 3️⃣ Deploy scripts respecting RAM
	const jobs = [
		{ script: "lib/hack.ts", threads: hackThreads },
		{ script: "lib/grow.ts", threads: growThreads },
		{ script: "lib/weaken.ts", threads: weakenThreads },
	]

	for (const job of jobs) {
		// Find server with enough RAM
		for (const s of servers) {
			const serverState = state.getServer(s)
			const freeRam = serverState.maxRam - serverState.usedRam
			const scriptRam = ns.getScriptRam(job.script)
			const maxThreads = Math.floor(freeRam / scriptRam)
			const threadsToRun = Math.min(maxThreads, job.threads)

			if (threadsToRun > 0) {
				const pid = ns.run(job.script, threadsToRun, target)
				if (pid > 0) {
					serverState.activeJobs.push(pid.toString())
					serverState.usedRam += threadsToRun * scriptRam
					state.updateServer(s, serverState)
					ns.print(`Launched ${job.script} x${threadsToRun} on ${s} for ${target}`)
					break
				}
			}
		}
	}

	// 4️⃣ Update target state
	targetState.activeBatches += 1
	state.updateTarget(target, targetState)
}
