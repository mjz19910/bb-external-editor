import { CONFIG } from "../core/config"
import { ServerState, RunningFleetState, RunningJobProcess, RunningWorkloadGroup, ScheduledAllocation } from "../core/types"

export function getRunningFleetState(
	ns: NS,
	rootedServers: ServerState[]
): RunningFleetState {
	const processes: RunningJobProcess[] = []

	for (const server of rootedServers) {
		const hostProcesses = ns.ps(server.hostname)

		for (const process of hostProcesses) {
			const parsed = parseManagedProcess(process, server.hostname)
			if (parsed) {
				processes.push(parsed)
			}
		}
	}

	const allocations = processesToAllocations(processes)

	return {
		processes,
		workloads: groupRunningWorkloads(processes),
		allocations,
	}
}

function parseManagedProcess(
	process: ProcessInfo,
	hostname: string
): RunningJobProcess | null {
	const action = getActionForScript(process.filename)
	if (!action) return null

	const targetArg = process.args[0]
	if (typeof targetArg !== "string") return null

	return {
		hostname,
		script: process.filename,
		target: targetArg,
		threads: process.threads,
		pid: process.pid,
	}
}

function getActionForScript(
	script: string
): "hack" | "grow" | "weaken" | null {
	if (script === CONFIG.workerScripts.hack) return "hack"
	if (script === CONFIG.workerScripts.grow) return "grow"
	if (script === CONFIG.workerScripts.weaken) return "weaken"
	return null
}

function groupRunningWorkloads(
	processes: RunningJobProcess[]
): RunningWorkloadGroup[] {
	const grouped = new Map<string, RunningJobProcess[]>()

	for (const process of processes) {
		const action = getActionForScript(process.script)
		if (!action) continue

		const key = `${action}::${process.target}`
		const existing = grouped.get(key) ?? []
		existing.push(process)
		grouped.set(key, existing)
	}

	const workloads: RunningWorkloadGroup[] = []

	for (const [key, groupedProcesses] of grouped.entries()) {
		const [action, target] = key.split("::")

		workloads.push({
			action: action as "hack" | "grow" | "weaken",
			target,
			totalThreads: groupedProcesses.reduce(
				(sum, process) => sum + process.threads,
				0
			),
			processes: groupedProcesses,
		})
	}

	return workloads.sort((a, b) => b.totalThreads - a.totalThreads)
}

function processesToAllocations(
	processes: RunningJobProcess[]
): ScheduledAllocation[] {
	return processes.map((process) => ({
		hostname: process.hostname,
		action: getActionForScript(process.script)!,
		target: process.target,
		threads: process.threads,
	}))
}
