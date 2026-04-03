import { CONFIG } from "../core/config"
import { ServerState, ExecutionHost, DispatchResult } from "../core/types"

export function getExecutionHosts(
	_ns: NS,
	rootedServers: ServerState[]
): ExecutionHost[] {
	return rootedServers
		.filter((server) => server.maxRam > 0)
		.map((server) => {
			const reserved =
				server.hostname === "home" ? CONFIG.reservedHomeRam : 0
			const freeRam = Math.max(0, server.maxRam - server.usedRam - reserved)

			return {
				hostname: server.hostname,
				freeRam,
			}
		})
		.filter((host) => host.freeRam > 0)
		.sort((a, b) => b.freeRam - a.freeRam)
}

export function ensureWorkerScripts(ns: NS, hosts: string[]) {
	const files = Object.values(CONFIG.workerScripts)

	for (const host of hosts) {
		if (host === "home") continue
		ns.scp(files, host, "home")
	}
}

export function killManagedScripts(ns: NS, hosts: string[]): void {
	const files = Object.values(CONFIG.workerScripts)

	for (const host of hosts) {
		for (const file of files) {
			ns.scriptKill(file, host)
		}
	}
}

export function dispatchScript(
	ns: NS,
	script: string,
	target: string,
	hosts: ExecutionHost[]
): DispatchResult {
	const scriptRam = ns.getScriptRam(script, "home")

	if (scriptRam <= 0) {
		throw new Error(`Invalid script RAM cost for ${script}`)
	}

	let totalThreads = 0
	let launchedProcesses = 0
	let hostsUsed = 0

	for (const host of hosts) {
		const threads = Math.floor(host.freeRam / scriptRam)
		if (threads <= 0) continue

		const pid = ns.exec(script, host.hostname, threads, target)

		if (pid !== 0) {
			totalThreads += threads
			launchedProcesses++
			hostsUsed++
		}
	}

	return {
		script,
		target,
		totalThreads,
		launchedProcesses,
		hostsUsed,
	}
}
