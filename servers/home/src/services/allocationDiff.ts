import { AllocationDiff, ScheduledAllocation } from "../core/types"

export function diffAllocations(
	desired: ScheduledAllocation[],
	running: ScheduledAllocation[]
): AllocationDiff {
	const desiredCounts = countAllocations(desired)
	const runningCounts = countAllocations(running)

	const keep: ScheduledAllocation[] = []
	const start: ScheduledAllocation[] = []
	const stop: ScheduledAllocation[] = []

	const allKeys = new Set<string>([
		...desiredCounts.keys(),
		...runningCounts.keys(),
	])

	for (const key of allKeys) {
		const desiredCount = desiredCounts.get(key) ?? 0
		const runningCount = runningCounts.get(key) ?? 0
		const allocation = parseKey(key)

		const keepCount = Math.min(desiredCount, runningCount)
		const startCount = Math.max(0, desiredCount - runningCount)
		const stopCount = Math.max(0, runningCount - desiredCount)

		for (let i = 0; i < keepCount; i++) {
			keep.push({ ...allocation })
		}

		for (let i = 0; i < startCount; i++) {
			start.push({ ...allocation })
		}

		for (let i = 0; i < stopCount; i++) {
			stop.push({ ...allocation })
		}
	}

	return { keep, start, stop }
}

function countAllocations(
	allocations: ScheduledAllocation[]
): Map<string, number> {
	const counts = new Map<string, number>()

	for (const allocation of allocations) {
		const key = getKey(allocation)
		counts.set(key, (counts.get(key) ?? 0) + 1)
	}

	return counts
}

function getKey(allocation: ScheduledAllocation): string {
	return `${allocation.hostname}::${allocation.action}::${allocation.target}::${allocation.threads}`
}

function parseKey(key: string): ScheduledAllocation {
	const [hostname, action, target, threadsRaw] = key.split("::")

	return {
		hostname,
		action: action as "hack" | "grow" | "weaken",
		target,
		threads: Number(threadsRaw),
	}
}
