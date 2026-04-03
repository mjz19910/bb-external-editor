// ./lib/batch.ts
import { Fleet } from "./fleet"
import { log, tlog } from "./log"

/**
 * Represents a single batch of operations for a target server
 */
export type Batch = {
	target: string
	hackThreads: number
	growThreads: number
	weaken1Threads: number
	weaken2Threads: number
	startTime: number // scheduled launch timestamp in ms
	completed: boolean
}

/**
 * Represents a batch plan for a target, with calculated offsets
 */
export type BatchPlan = {
	hackTime: number
	growTime: number
	weakenTime: number
	hackDelay: number
	growDelay: number
	weaken1Delay: number
	weaken2Delay: number
}

/**
 * Main batch manager
 */
export class BatchManager {
	ns: NS
	fleet: Fleet
	batches: Batch[] = [];

	constructor(ns: NS, fleet: Fleet) {
		this.ns = ns
		this.fleet = fleet
	}

	/**
	 * Plan a batch for a target
	 */
	planBatch(target: string): BatchPlan {
		const hackTime = this.ns.getHackTime(target)
		const growTime = this.ns.getGrowTime(target)
		const weakenTime = this.ns.getWeakenTime(target)

		// Simple offset strategy:
		// Weaken before hack and after grow
		const weaken1Delay = 0
		const hackDelay = weakenTime - hackTime + 50 // ms buffer
		const growDelay = hackDelay + hackTime - growTime + 50
		const weaken2Delay = growDelay + growTime - weakenTime + 50

		return {
			hackTime,
			growTime,
			weakenTime,
			hackDelay,
			growDelay,
			weaken1Delay,
			weaken2Delay
		}
	}

	/**
	 * Schedule a batch on available RAM
	 */
	scheduleBatch(batch: Batch): boolean {
		const requiredRam =
			batch.hackThreads * 1.7 + // hack.js RAM
			batch.growThreads * 1.75 + // grow.js RAM
			(batch.weaken1Threads + batch.weaken2Threads) * 1.55 // weaken.js RAM

		// Try to find a host to accommodate
		const host = this.fleet.hosts.find(h => h.freeRam >= requiredRam)
		if (!host) {
			tlog(this.ns, `No host with enough RAM for batch on ${batch.target} (${requiredRam}GB required)`)
			return false
		}

		host.usedRam += requiredRam
		this.batches.push(batch)
		log(this.ns, `Scheduled batch on ${host.host} for ${batch.target} requiring ${requiredRam.toFixed(2)}GB RAM`)
		return true
	}

	/**
	 * Execute all due batches
	 */
	async runBatches() {
		const now = Date.now()
		for (const batch of this.batches) {
			if (!batch.completed && batch.startTime <= now) {
				// Dispatch scripts
				await this.dispatchBatch(batch)
				batch.completed = true
			}
		}
		// Clean up completed batches
		this.batches = this.batches.filter(b => !b.completed)
	}

	/**
	 * Launch scripts for a batch (simplified)
	 */
	private async dispatchBatch(batch: Batch) {
		// Replace these with your actual deployScriptSet / allocation logic
		tlog(this.ns, `Dispatching batch for ${batch.target}: H:${batch.hackThreads} G:${batch.growThreads} W1:${batch.weaken1Threads} W2:${batch.weaken2Threads}`)
		// TODO: hook this up
		// Example:
		// await deployScriptSet(this.ns, host, "hack.js", batch.hackThreads, batch.startTime + batch.hackDelay, batch.target);
		// etc.
	}
}
