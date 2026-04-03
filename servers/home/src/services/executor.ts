import { CONFIG } from "../core/config"
import {
	DispatchResult,
	ExecutionHost,
	ScheduledAllocation,
	ServerState,
} from "../core/types"

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

export function getExecutionHosts(rootedServers: ServerState[]): ExecutionHost[] {
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

export function killSpecificAllocations(
	ns: NS,
	allocationsToStop: ScheduledAllocation[]
): number {
	let killed = 0

	for (const allocation of allocationsToStop) {
		const script = CONFIG.workerScripts[allocation.action]
		const processes = ns.ps(allocation.hostname)
			.filter(
				(p) =>
					p.filename === script &&
					p.args[0] === allocation.target
			)
			.sort((a, b) => b.threads - a.threads)

		let remainingThreadsToKill = allocation.threads

		for (const process of processes) {
			if (remainingThreadsToKill <= 0) break

			ns.kill(process.pid)
			killed += 1
			remainingThreadsToKill -= process.threads
		}
	}

	return killed
}

export function dispatchSchedule(
	ns: NS,
	allocations: ScheduledAllocation[]
): DispatchResult[] {
	const results = new Map<string, DispatchResult>()

	for (const allocation of allocations) {
		if (allocation.threads <= 0) continue

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
