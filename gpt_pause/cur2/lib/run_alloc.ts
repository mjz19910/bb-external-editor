// lib/run_alloc.ts

import { AllocationResult } from "./ram_allocator"

export type RunAllocArgs = {
	script: string
	args?: (string | number | boolean)[]
	label?: string
}

export type RunAllocResult = {
	pids: number[]
	totalThreads: number
	ok: boolean
}

export function runAllocation(
	ns: NS,
	allocation: AllocationResult,
	opts: RunAllocArgs
): RunAllocResult {
	const { script, args = [] } = opts

	const pids: number[] = []
	let totalThreads = 0

	for (const r of allocation.reservations) {
		const pid = ns.exec(script, r.host, r.threads, ...args)
		if (pid !== 0) {
			pids.push(pid)
			totalThreads += r.threads
		}
	}

	return {
		pids,
		totalThreads,
		ok: totalThreads > 0,
	}
}
