import { CONFIG } from "../core/config"
import { DesiredWorkload, ReconcileResult, RunningFleetState, RunningWorkloadState, ServerState } from "../core/types"
import { killManagedScripts, getExecutionHosts, ensureWorkerScripts, dispatchScript, dispatchSchedule } from "../services/executor"
import { buildSchedule } from "../services/scheduler"
import { workloadSetsMatch } from "../services/workloadCompare"

export async function reconcileFleetWorkloads(
	ns: NS,
	desiredWorkloads: DesiredWorkload[],
	runningFleet: RunningFleetState,
	rootedServers: ServerState[]
): Promise<ReconcileResult> {
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

		killManagedScripts(ns, rootedServers.map((s) => s.hostname))

		return {
			changed: true,
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
			scheduledAllocations: runningFleet.workloads.length,
		}
	}

	const hosts = getExecutionHosts(ns, rootedServers)
	if (hosts.length === 0) {
		return {
			changed: false,
			reason: "No execution hosts with free RAM available.",
			totalThreads: 0,
			hostsUsed: 0,
			launchedProcesses: 0,
			scheduledAllocations: 0,
		}
	}

	await ensureWorkerScripts(ns, rootedServers.map((s) => s.hostname))
	killManagedScripts(ns, rootedServers.map((s) => s.hostname))

	const allocations = buildSchedule(ns, desiredWorkloads, hosts)
	const results = dispatchSchedule(ns, allocations)

	return {
		changed: true,
		reason: `Rebuilt fleet schedule for ${desiredWorkloads.length} desired workloads.`,
		totalThreads: results.reduce((sum, result) => sum + result.totalThreads, 0),
		hostsUsed: new Set(allocations.map((a) => a.hostname)).size,
		launchedProcesses: results.reduce((sum, result) => sum + result.launchedProcesses, 0),
		scheduledAllocations: allocations.length,
	}
}

function isDesiredWorkloadSatisfied(
	desired: DesiredWorkload,
	running: RunningWorkloadState
): boolean {
	if (running.action !== desired.action) return false
	if (running.target !== desired.target) return false

	const desiredThreads = Math.max(1, desired.desiredThreads)
	const differenceRatio =
		Math.abs(running.totalThreads - desiredThreads) / desiredThreads

	return (
		differenceRatio <= CONFIG.workloadTolerance.minThreadDifferenceToRedeploy
	)
}

export async function reconcileDesiredWorkload(
	ns: NS,
	desired: DesiredWorkload | null,
	running: RunningWorkloadState,
	rootedServers: ServerState[]
): Promise<ReconcileResult> {
	if (!desired) {
		if (running.processes.length === 0) {
			return {
				changed: false,
				reason: "No desired workload and no managed workload running.",
				totalThreads: 0,
				hostsUsed: 0,
				launchedProcesses: 0,
				scheduledAllocations: 0,
			}
		}

		killManagedScripts(
			ns,
			rootedServers.map((s) => s.hostname)
		)

		return {
			changed: true,
			reason: "Stopped managed workload because no desired workload exists.",
			totalThreads: 0,
			hostsUsed: 0,
			launchedProcesses: 0,
			scheduledAllocations: 0,
		}
	}

	if (isDesiredWorkloadSatisfied(desired, running)) {
		return {
			changed: false,
			reason: "Desired workload already satisfied.",
			totalThreads: running.totalThreads,
			hostsUsed: new Set(running.processes.map((p) => p.hostname)).size,
			launchedProcesses: running.processes.length,
			scheduledAllocations: 0,
		}
	}

	const hosts = getExecutionHosts(ns, rootedServers)
	if (hosts.length === 0) {
		return {
			changed: false,
			reason: "No execution hosts with free RAM available.",
			totalThreads: 0,
			hostsUsed: 0,
			launchedProcesses: 0,
			scheduledAllocations: 0,
		}
	}

	await ensureWorkerScripts(
		ns,
		rootedServers.map((s) => s.hostname)
	)

	killManagedScripts(
		ns,
		rootedServers.map((s) => s.hostname)
	)

	const script = CONFIG.workerScripts[desired.action]
	const result = dispatchScript(
		ns,
		script,
		desired.target,
		desired.desiredThreads,
		hosts
	)

	return {
		changed: true,
		reason: `Deployed ${desired.action} workload on ${desired.target} with ${result.totalThreads}/${desired.desiredThreads} threads.`,
		totalThreads: result.totalThreads,
		hostsUsed: result.hostsUsed,
		launchedProcesses: result.launchedProcesses,
		scheduledAllocations: 0,
	}
}
