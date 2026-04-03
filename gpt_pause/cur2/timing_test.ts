import {
	computeBatchTiming,
	formatBatchTiming,
	getSuggestedBatchSpacing,
} from "./lib/timing"

export async function main(ns: NS) {
	ns.disableLog("ALL")

	const target = String(ns.args[0] ?? "n00dles")
	const timing = computeBatchTiming(ns, target, {
		gapMs: 200,
	})

	ns.tprint(`=== TIMING TEST: ${target} ===`)
	ns.tprint(formatBatchTiming(timing))
	ns.tprint(`Suggested spacing: ${getSuggestedBatchSpacing(ns, target, 200)}ms`)
}
