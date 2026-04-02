// batch_manager.ts
import { getFleet } from "./lib/fleet"
import { RamAllocator, AllocationRequest } from "./lib/ram_allocator"
import { chooseBestTargetScore } from "./choose_best_target"
import { computeBatchTiming, BatchTiming } from "./lib/timing"
import { runAllocation } from "./lib/run_alloc"

export async function main(ns: NS) {
	ns.disableLog("ALL")

	// --- 1. Pick target ---
	const targetScore = chooseBestTargetScore(ns)
	if (!targetScore) {
		ns.tprint("No valid target found.")
		return
	}
	const target = targetScore.target
	ns.tprint(`Selected target: ${target} (score=${targetScore.finalScore.toFixed(2)})`)

	// --- 2. Build fleet and allocator ---
	const fleet = getFleet(ns)
	const allocator = new RamAllocator(fleet, 128) // reserve 128GB on home

	// --- 3. Decide threads ---
	const hackThreads = targetScore.hackThreadsFor10Pct
	const growThreads = targetScore.growThreadsToMax
	const weakenThreads = targetScore.weakenThreadsForSecurity

	const hackRam = ns.getScriptRam("/lib/hack.ts")
	const growRam = ns.getScriptRam("/lib/grow.ts")
	const weakenRam = ns.getScriptRam("/lib/weaken.ts")

	// --- 4. Compute batch timing ---
	const batch: BatchTiming = computeBatchTiming(ns, target)

	ns.tprint(`Hack batch timings (ms): H=${batch.hackDelay} W1=${batch.weaken1Delay} G=${batch.growDelay} W2=${batch.weaken2Delay}`)

	// --- 5. Allocate RAM ---
	const allocations: { label: string; req: AllocationRequest; delay: number; script: string }[] = [
		{ label: "weaken1", script: "/lib/weaken.ts", delay: batch.weaken1Delay, req: { label: "weaken1", scriptRam: weakenRam, threads: weakenThreads } },
		{ label: "hack", script: "/lib/hack.ts", delay: batch.hackDelay, req: { label: "hack", scriptRam: hackRam, threads: hackThreads } },
		{ label: "grow", script: "/lib/grow.ts", delay: batch.growDelay, req: { label: "grow", scriptRam: growRam, threads: growThreads } },
		{ label: "weaken2", script: "/lib/weaken.ts", delay: batch.weaken2Delay, req: { label: "weaken2", scriptRam: weakenRam, threads: weakenThreads } },
	]

	// --- 6. Launch all jobs ---
	for (const alloc of allocations) {
		const result = allocator.allocate(alloc.req)
		if (!result.success) {
			ns.tprint(`Failed to allocate RAM for ${alloc.label} (requested ${alloc.req.threads} threads)`)
			continue
		}

		const runResult = runAllocation(ns, result, { script: alloc.script, args: [target, alloc.delay] })
		ns.tprint(`${alloc.label}: launched ${runResult.totalThreads} threads on ${runResult.pids.length} hosts`)
	}
}
