import { CONFIG } from "../core/config"
import { DesiredWorkload, RunningWorkloadGroup } from "../core/types"

export function workloadSetsMatch(
	desiredWorkloads: DesiredWorkload[],
	runningWorkloads: RunningWorkloadGroup[]
): boolean {
	const desiredMap = new Map<string, DesiredWorkload>()
	const runningMap = new Map<string, RunningWorkloadGroup>()

	for (const workload of desiredWorkloads) {
		desiredMap.set(getKey(workload.action, workload.target), workload)
	}

	for (const workload of runningWorkloads) {
		runningMap.set(getKey(workload.action, workload.target), workload)
	}

	if (desiredMap.size !== runningMap.size) {
		return false
	}

	for (const [key, desired] of desiredMap.entries()) {
		const running = runningMap.get(key)
		if (!running) return false

		const desiredThreads = Math.max(1, desired.desiredThreads)
		const differenceRatio =
			Math.abs(running.totalThreads - desiredThreads) / desiredThreads

		if (
			differenceRatio > CONFIG.workloadTolerance.minThreadDifferenceToRedeploy
		) {
			return false
		}
	}

	return true
}

function getKey(action: string, target: string): string {
	return `${action}::${target}`
}
