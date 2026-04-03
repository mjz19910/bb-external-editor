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

/**
 * How much time a batch occupies from first land to last land.
 */
export function getBatchLandingWindow(gapMs = 200): number {
	return gapMs * 3
}

/**
 * Suggested minimum spacing between batch anchors.
 * Conservative so overlapping batches don't stomp each other.
 */
export function getSuggestedBatchSpacing(
	ns: NS,
	target: string,
	gapMs = 200
): number {
	// Conservative starter value; can tighten later once your engine is stable
	return gapMs * 4
}

/**
 * Compute the next anchor time after an existing batch anchor.
 */
export function getNextBatchAnchor(
	prevAnchorTime: number,
	spacingMs: number
): number {
	return prevAnchorTime + spacingMs
}

/**
 * Pretty print batch timing for logs/debugging.
 */
export function formatBatchTiming(t: BatchTiming): string {
	return [
		`target=${t.target}`,
		`hackDelay=${t.hackDelay}ms`,
		`w1Delay=${t.weaken1Delay}ms`,
		`growDelay=${t.growDelay}ms`,
		`w2Delay=${t.weaken2Delay}ms`,
		`lands=[H:${rel(t.hackEnd, t.now)} W1:${rel(t.weaken1End, t.now)} G:${rel(t.growEnd, t.now)} W2:${rel(t.weaken2End, t.now)}]`,
		`total=${t.totalDuration}ms`,
	].join("  ")
}

function rel(t: number, base: number): string {
	return `+${Math.round(t - base)}ms`
}
