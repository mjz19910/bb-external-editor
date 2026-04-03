import { CONFIG } from "../core/config"
import { killManagedScripts, getExecutionHosts, ensureWorkerScripts, dispatchScript } from "../services/executor"

export async function reconcileDesiredJobState(
	ns: NS,
	desired: DesiredJobState | null,
	running: RunningJobState,
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
			}
		}

		killManagedScripts(
			ns,
			rootedServers.map((s) => s.hostname)
		)

		return {
			changed: true,
			reason: "Stopped managed workload because no desired job exists.",
			totalThreads: 0,
			hostsUsed: 0,
			launchedProcesses: 0,
		}
	}

	if (isDesiredStateSatisfied(desired, running)) {
		return {
			changed: false,
			reason: "Desired workload already running.",
			totalThreads: running.processes.reduce((sum, p) => sum + p.threads, 0),
			hostsUsed: new Set(running.processes.map((p) => p.hostname)).size,
			launchedProcesses: running.processes.length,
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
	const result = dispatchScript(ns, script, desired.target, 1, hosts)

	return {
		changed: true,
		reason: `Deployed ${desired.action} workload on ${desired.target}.`,
		totalThreads: result.totalThreads,
		hostsUsed: result.hostsUsed,
		launchedProcesses: result.launchedProcesses,
	}
}

function isDesiredStateSatisfied(
	desired: DesiredJobState,
	running: RunningJobState
): boolean {
	return running.action === desired.action && running.target === desired.target
}
