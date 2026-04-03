import { CONFIG } from "../core/config"
import { ServerState, ExecutionHost, DispatchResult, ScheduledAllocation } from "../core/types"

export function getExecutionHosts(
	ns: NS,
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

export async function ensureWorkerScripts(
	ns: NS,
	hosts: string[]
): Promise<void> {
	const files = Object.values(CONFIG.workerScripts)

	for (const host of hosts) {
		if (host === "home") continue
		await ns.scp(files, host, "home")
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
	desiredThreads: number,
	hosts: ExecutionHost[]
): DispatchResult {
	const scriptRam = ns.getScriptRam(script, "home")

	if (scriptRam <= 0) {
		throw new Error(`Invalid script RAM cost for ${script}`)
	}

	let remainingThreads = desiredThreads
	let totalThreads = 0
	let launchedProcesses = 0
	let hostsUsed = 0

	for (const host of hosts) {
		if (remainingThreads <= 0) break

		const maxThreadsOnHost = Math.floor(host.freeRam / scriptRam)
		if (maxThreadsOnHost <= 0) continue

		const threads = Math.min(maxThreadsOnHost, remainingThreads)
		const pid = ns.exec(script, host.hostname, threads, target)

		if (pid !== 0) {
			totalThreads += threads
			remainingThreads -= threads
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

export function dispatchSchedule(
	ns: NS,
	allocations: ScheduledAllocation[]
): DispatchResult[] {
	const results = new Map<string, DispatchResult>()

	for (const allocation of allocations) {
		const script = CONFIG.workerScripts[allocation.action]
		const pid = ns.exec(
			script,
			allocation.hostname,
			allocation.threads,
			allocation.target
		)

		if (pid === 0) continue

		const key = `${script}::${allocation.target}`
		const existing = results.get(key)

		if (existing) {
			existing.totalThreads += allocation.threads
			existing.launchedProcesses += 1
			existing.hostsUsed += 1
		} else {
			results.set(key, {
				script,
				target: allocation.target,
				totalThreads: allocation.threads,
				launchedProcesses: 1,
				hostsUsed: 1,
			})
		}
	}

	return [...results.values()]
}
