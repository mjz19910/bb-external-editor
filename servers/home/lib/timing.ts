// lib/timing.ts

export type BatchTiming = {
	target: string

	now: number

	// durations
	hackTime: number
	growTime: number
	weakenTime: number

	// landing times
	hackEnd: number
	weaken1End: number
	growEnd: number
	weaken2End: number

	// launch delays from "now"
	hackDelay: number
	weaken1Delay: number
	growDelay: number
	weaken2Delay: number

	// spacing
	gapMs: number

	// total batch duration from first launch to final land
	totalDuration: number
}

export type BatchTimingOptions = {
	/** ms between each job landing */
	gapMs?: number

	/** optional absolute landing anchor */
	anchorTime?: number
}

/**
 * Compute a single HWGW batch timing plan so actions LAND in order:
 * H -> W1 -> G -> W2
 */
export function computeBatchTiming(
	ns: NS,
	target: string,
	opts: BatchTimingOptions = {}
): BatchTiming {
	const gapMs = opts.gapMs ?? 200
	const now = Date.now()

	const hackTime = ns.getHackTime(target)
	const growTime = ns.getGrowTime(target)
	const weakenTime = ns.getWeakenTime(target)

	// Anchor the last weaken to land furthest in the future
	const weaken2End = opts.anchorTime ?? (now + weakenTime + gapMs * 4)

	const growEnd = weaken2End - gapMs
	const weaken1End = growEnd - gapMs
	const hackEnd = weaken1End - gapMs

	const hackDelay = Math.max(0, hackEnd - now - hackTime)
	const weaken1Delay = Math.max(0, weaken1End - now - weakenTime)
	const growDelay = Math.max(0, growEnd - now - growTime)
	const weaken2Delay = Math.max(0, weaken2End - now - weakenTime)

	const firstLaunchAt = Math.min(
		now + hackDelay,
		now + weaken1Delay,
		now + growDelay,
		now + weaken2Delay
	)

	const totalDuration = weaken2End - firstLaunchAt

	return {
		target,
		now,
		hackTime,
		growTime,
		weakenTime,
		hackEnd,
		weaken1End,
		growEnd,
		weaken2End,
		hackDelay,
		weaken1Delay,
		growDelay,
		weaken2Delay,
		gapMs,
		totalDuration,
	}
}
