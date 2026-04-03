import { CONFIG } from "../core/config"
import { GameState, TargetRegistry, DesiredWorkload, ServerState, TrackedTargetState } from "../core/types"
import { estimateWeakenThreads, estimateGrowThreads, estimateHackThreads } from "../services/plannerMath"

export function buildDesiredWorkloads(
	ns: NS,
	state: GameState,
	registry: TargetRegistry
): DesiredWorkload[] {
	const trackedTargets = Object.values(registry.byHostname)
		.filter((target) => target.isHackable)
		.sort((a, b) => b.score - a.score)
		.slice(0, CONFIG.planner.maxTargetsToEvaluate)

	const workloads: DesiredWorkload[] = []

	for (const tracked of trackedTargets) {
		const server = state.servers.find((s) => s.hostname === tracked.hostname)
		if (!server) continue

		const workload = buildWorkloadForTrackedTarget(ns, server, tracked, registry)
		if (workload) {
			workloads.push(workload)
		}
	}

	return workloads
		.filter((w) => w.desiredThreads > 0)
		.sort((a, b) => b.priority - a.priority)
		.slice(0, CONFIG.planner.maxDesiredWorkloads)
}

function buildWorkloadForTrackedTarget(
	ns: NS,
	server: ServerState,
	target: TrackedTargetState,
	registry: TargetRegistry
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
				reason: `Tracked lifecycle=${target.lifecycle}, reduce security.`,
			}

		case "GROWING":
			return {
				action: "grow",
				target: target.hostname,
				desiredThreads: estimateGrowThreads(ns, server),
				priority:
					(target.isActiveFarm ? 95 : 80) + target.score / 1_000_000,
				reason: `Tracked lifecycle=${target.lifecycle}, restore money.`,
			}

		case "READY":
		case "FARMING":
			return {
				action: "hack",
				target: target.hostname,
				desiredThreads: estimateHackThreads(ns, server),
				priority:
					(registry.activeFarmTarget === target.hostname ? 120 : 50) +
					target.score / 1_000_000,
				reason: `Tracked lifecycle=${target.lifecycle}, profitable farming.`,
			}

		default:
			return null
	}
}
