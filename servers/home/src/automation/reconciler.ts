import { DesiredWorkload, RunningFleetState, ServerState, ReconcileResult } from "../core/types"
import { diffAllocations } from "../services/allocationDiff"
import { getExecutionHosts, killSpecificAllocations, ensureWorkerScripts, dispatchSchedule } from "../services/executor"
import { buildSchedule } from "../services/scheduler"
import { workloadSetsMatch } from "../services/workloadCompare"

export async function reconcileFleetWorkloads(
	ns: NS,
	desiredWorkloads: DesiredWorkload[],
	runningFleet: RunningFleetState,
	rootedServers: ServerState[]
): Promise<ReconcileResult> {
	const hosts = getExecutionHosts(rootedServers)
	const desiredSchedule = buildSchedule(ns, desiredWorkloads, hosts)

	if (desiredWorkloads.length === 0) {
		if (runningFleet.processes.length === 0) {
			return {
				changed: false,
				reason: "No desired workloads and no managed workloads running.",
				totalThreads: 0,
				hostsUsed: 0,
				launchedProcesses: 0,
				scheduledAllocations: 0,
			}
		}

		const killed = killSpecificAllocations(ns, runningFleet.allocations)

		return {
			changed: killed > 0,
			reason: "Stopped managed workloads because no desired workloads exist.",
			totalThreads: 0,
			hostsUsed: 0,
			launchedProcesses: 0,
			scheduledAllocations: 0,
		}
	}

	if (workloadSetsMatch(desiredWorkloads, runningFleet.workloads)) {
		return {
			changed: false,
			reason: "Running fleet already satisfies desired workload set.",
			totalThreads: runningFleet.processes.reduce((sum, p) => sum + p.threads, 0),
			hostsUsed: new Set(runningFleet.processes.map((p) => p.hostname)).size,
			launchedProcesses: runningFleet.processes.length,
			scheduledAllocations: runningFleet.allocations.length,
		}
	}

	await ensureWorkerScripts(ns, rootedServers.map((s) => s.hostname))

	const diff = diffAllocations(desiredSchedule, runningFleet.allocations)

	const killedProcesses = killSpecificAllocations(ns, diff.stop)
	const launchResults = dispatchSchedule(ns, diff.start)

	const totalThreadsAfter = desiredSchedule.reduce(
		(sum, allocation) => sum + allocation.threads,
		0
	)

	return {
		changed: diff.start.length > 0 || diff.stop.length > 0,
		reason: `Incremental reconcile: keep=${diff.keep.length}, stop=${diff.stop.length}, start=${diff.start.length}, killed=${killedProcesses}.`,
		totalThreads: totalThreadsAfter,
		hostsUsed: new Set(desiredSchedule.map((a) => a.hostname)).size,
		launchedProcesses: launchResults.reduce(
			(sum, result) => sum + result.launchedProcesses,
			0
		),
		scheduledAllocations: desiredSchedule.length,
	}
}
