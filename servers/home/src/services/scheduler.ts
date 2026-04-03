import { CONFIG } from "../core/config"
import { DesiredWorkload, ExecutionHost, ScheduledAllocation } from "../core/types"

export function buildSchedule(
	ns: NS,
	desiredWorkloads: DesiredWorkload[],
	hosts: ExecutionHost[]
): ScheduledAllocation[] {
	const sortedWorkloads = [...desiredWorkloads]
		.filter((w) => w.desiredThreads > 0)
		.sort((a, b) => b.priority - a.priority)

	const workingHosts = hosts.map((host) => ({
		...host,
		remainingRam: host.freeRam,
	}))

	const allocations: ScheduledAllocation[] = []

	for (const workload of sortedWorkloads) {
		const script = CONFIG.workerScripts[workload.action]
		const scriptRam = ns.getScriptRam(script, "home")

		if (scriptRam <= 0) continue

		let remainingThreads = workload.desiredThreads

		for (const host of workingHosts) {
			if (remainingThreads <= 0) break

			const maxThreadsOnHost = Math.floor(host.remainingRam / scriptRam)
			if (maxThreadsOnHost <= 0) continue

			const allocatedThreads = Math.min(maxThreadsOnHost, remainingThreads)
			if (allocatedThreads <= 0) continue

			allocations.push({
				hostname: host.hostname,
				action: workload.action,
				target: workload.target,
				threads: allocatedThreads,
			})

			host.remainingRam -= allocatedThreads * scriptRam
			remainingThreads -= allocatedThreads
		}
	}

	return allocations
}
