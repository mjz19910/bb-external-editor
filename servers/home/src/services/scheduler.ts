import { CONFIG } from "../core/config"
import { ExecutionHost, DesiredWorkload, ScheduledAllocation } from "../core/types"

interface WorkingHost extends ExecutionHost {
	remainingRam: number
}

export function buildSchedule(
	ns: NS,
	desiredWorkloads: DesiredWorkload[],
	hosts: ExecutionHost[],
	existingAllocations: ScheduledAllocation[] = []
): ScheduledAllocation[] {
	const sortedWorkloads = [...desiredWorkloads]
		.filter((w) => w.desiredThreads > 0)
		.sort((a, b) => b.priority - a.priority)

	const workingHosts: WorkingHost[] = hosts.map((host) => ({
		...host,
		remainingRam: host.freeRam,
	}))

	const allocations: ScheduledAllocation[] = []

	for (const workload of sortedWorkloads) {
		const script = CONFIG.workerScripts[workload.action]
		const scriptRam = ns.getScriptRam(script, "home")

		if (scriptRam <= 0) continue

		let remainingThreads = workload.desiredThreads

		const preferredHosts = getPreferredHostsForWorkload(
			workload.action,
			workload.target,
			existingAllocations,
			workingHosts
		)

		remainingThreads = allocateAcrossHosts(
			preferredHosts,
			workload,
			scriptRam,
			allocations,
			remainingThreads
		)

		if (remainingThreads > 0) {
			const fallbackHosts = getFallbackHosts(
				preferredHosts,
				workingHosts
			)

			remainingThreads = allocateAcrossHosts(
				fallbackHosts,
				workload,
				scriptRam,
				allocations,
				remainingThreads
			)
		}
	}

	return allocations
}

function allocateAcrossHosts(
	hosts: WorkingHost[],
	workload: DesiredWorkload,
	scriptRam: number,
	allocations: ScheduledAllocation[],
	remainingThreads: number
): number {
	for (const host of hosts) {
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

	return remainingThreads
}

function getPreferredHostsForWorkload(
	action: "hack" | "grow" | "weaken",
	target: string,
	existingAllocations: ScheduledAllocation[],
	workingHosts: WorkingHost[]
): WorkingHost[] {
	const preferredHostnames = existingAllocations
		.filter(
			(allocation) =>
				allocation.action === action &&
				allocation.target === target
		)
		.map((allocation) => allocation.hostname)

	const uniqueHostnames = [...new Set(preferredHostnames)]

	return uniqueHostnames
		.map((hostname) => workingHosts.find((host) => host.hostname === hostname))
		.filter((host): host is WorkingHost => host !== undefined)
		.sort((a, b) => b.remainingRam - a.remainingRam)
}

function getFallbackHosts(
	preferredHosts: WorkingHost[],
	allHosts: WorkingHost[]
): WorkingHost[] {
	const preferredSet = new Set(preferredHosts.map((host) => host.hostname))

	return allHosts
		.filter((host) => !preferredSet.has(host.hostname))
		.sort((a, b) => b.remainingRam - a.remainingRam)
}
