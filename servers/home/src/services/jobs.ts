import { CONFIG } from "../core/config"
import { ServerState, RunningJobState, RunningJobProcess } from "../core/types"

export function getRunningJobState(
	ns: NS,
	rootedServers: ServerState[]
): RunningJobState {
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

	if (processes.length === 0) {
		return {
			action: null,
			target: null,
			processes: [],
		}
	}

	const grouped = groupByActionAndTarget(processes)
	const dominant = [...grouped.entries()].sort((a, b) => b[1].length - a[1].length)[0]

	if (!dominant) {
		return {
			action: null,
			target: null,
			processes: [],
		}
	}

	const [key, dominantProcesses] = dominant
	const [action, target] = key.split("::")

	return {
		action: action as "hack" | "grow" | "weaken",
		target,
		processes: dominantProcesses,
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

function groupByActionAndTarget(
	processes: RunningJobProcess[]
): Map<string, RunningJobProcess[]> {
	const map = new Map<string, RunningJobProcess[]>()

	for (const process of processes) {
		const action = getActionForScript(process.script)
		if (!action) continue

		const key = `${action}::${process.target}`
		const existing = map.get(key) ?? []
		existing.push(process)
		map.set(key, existing)
	}

	return map
}
