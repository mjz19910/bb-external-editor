import { CONFIG } from "../core/config"
import { shouldWeaken, shouldGrow } from "../core/state"
import { GameState, ActionPlan, DesiredWorkload } from "../core/types"
import { estimateWeakenThreads, estimateGrowThreads, estimateHackThreads } from "../services/plannerMath"

export function buildPlan(state: GameState): ActionPlan {
	if (!state.bestTarget) {
		return {
			type: "scan",
			reason: "No valid target available yet.",
		}
	}

	const target = state.bestTarget

	if (shouldWeaken(target)) {
		return {
			type: "weaken",
			target: target.hostname,
			reason: `Security above threshold (${target.currentSecurity.toFixed(2)} / min ${target.minSecurity.toFixed(2)}).`,
		}
	}

	if (shouldGrow(target)) {
		return {
			type: "grow",
			target: target.hostname,
			reason: `Money below threshold (${target.currentMoney.toFixed(0)} / ${target.maxMoney.toFixed(0)}).`,
		}
	}

	return {
		type: "hack",
		target: target.hostname,
		reason: "Target is in profitable state.",
	}
}

export function buildDesiredWorkloads(
	ns: NS,
	state: GameState
): DesiredWorkload[] {
	const candidates = [...state.hackableTargets]
		.slice(0, CONFIG.planner.maxTargetsToEvaluate)

	const workloads: DesiredWorkload[] = []

	for (const server of candidates) {
		if (shouldWeaken(server)) {
			workloads.push({
				action: "weaken",
				target: server.hostname,
				desiredThreads: estimateWeakenThreads(ns, server),
				priority: 100 + server.maxMoney / 1_000_000,
				reason: "Security reduction needed.",
			})
			continue
		}

		if (shouldGrow(server)) {
			workloads.push({
				action: "grow",
				target: server.hostname,
				desiredThreads: estimateGrowThreads(ns, server),
				priority: 80 + server.maxMoney / 1_000_000,
				reason: "Money recovery needed.",
			})
			continue
		}

		workloads.push({
			action: "hack",
			target: server.hostname,
			desiredThreads: estimateHackThreads(ns, server),
			priority: 50 + server.maxMoney / 1_000_000,
			reason: "Profitable target ready for hacking.",
		})
	}

	return workloads
		.filter((w) => w.desiredThreads > 0)
		.sort((a, b) => b.priority - a.priority)
		.slice(0, CONFIG.planner.maxDesiredWorkloads)
}

export function planToDesiredWorkload(
	ns: NS,
	state: GameState,
	plan: ActionPlan
): DesiredWorkload | null {
	if (!plan.target) return null

	const server = state.servers.find((s) => s.hostname === plan.target)
	if (!server) return null

	if (plan.type === "weaken") {
		return {
			action: "weaken",
			target: plan.target,
			desiredThreads: estimateWeakenThreads(ns, server),
			priority: 0,
			reason: ""
		}
	}

	if (plan.type === "grow") {
		return {
			action: "grow",
			target: plan.target,
			desiredThreads: estimateGrowThreads(ns, server),
			priority: 0,
			reason: ""
		}
	}

	if (plan.type === "hack") {
		return {
			action: "hack",
			target: plan.target,
			desiredThreads: estimateHackThreads(ns, server),
			priority: 0,
			reason: ""
		}
	}

	return null
}
