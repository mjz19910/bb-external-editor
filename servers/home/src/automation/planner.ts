import { CONFIG } from "../core/config"
import { GameState, DesiredWorkload, TargetState, ServerState } from "../core/types"
import { estimateWeakenThreads, estimateGrowThreads, estimateHackThreads } from "../services/plannerMath"

export function buildDesiredWorkloads(
	ns: NS,
	state: GameState
): DesiredWorkload[] {
	const candidates = state.targetStates
		.filter((target) => target.isHackable)
		.sort((a, b) => b.score - a.score)
		.slice(0, CONFIG.planner.maxTargetsToEvaluate)

	const workloads: DesiredWorkload[] = []

	for (const target of candidates) {
		const server = state.servers.find((s) => s.hostname === target.hostname)
		if (!server) continue

		const workload = buildWorkloadForTargetState(ns, server, target)
		if (workload) {
			workloads.push(workload)
		}
	}

	return workloads
		.filter((w) => w.desiredThreads > 0)
		.sort((a, b) => b.priority - a.priority)
		.slice(0, CONFIG.planner.maxDesiredWorkloads)
}

function buildWorkloadForTargetState(
	ns: NS,
	server: ServerState,
	target: TargetState
): DesiredWorkload | null {
	switch (target.lifecycle) {
		case "UNAVAILABLE":
			return null

		case "UNPREPPED":
		case "WEAKENING":
			return {
				action: "weaken",
				target: target.hostname,
				desiredThreads: estimateWeakenThreads(ns, server),
				priority: 100 + target.score / 1_000_000,
				reason: `Target lifecycle=${target.lifecycle}, reduce security first.`,
			}

		case "GROWING":
			return {
				action: "grow",
				target: target.hostname,
				desiredThreads: estimateGrowThreads(ns, server),
				priority: 80 + target.score / 1_000_000,
				reason: `Target lifecycle=${target.lifecycle}, restore money.`,
			}

		case "READY":
		case "FARMING":
			return {
				action: "hack",
				target: target.hostname,
				desiredThreads: estimateHackThreads(ns, server),
				priority: 50 + target.score / 1_000_000,
				reason: `Target lifecycle=${target.lifecycle}, profitable farming.`,
			}

		default:
			return null
	}
}
