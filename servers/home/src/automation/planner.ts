import { shouldGrow, shouldWeaken } from "../core/state"
import { estimateWeakenThreads, estimateGrowThreads, estimateHackThreads } from "../services/plannerMath"

export function planToDesiredJobState(
	plan: ActionPlan
): DesiredJobState | null {
	if (!plan.target) return null

	if (plan.type === "hack" || plan.type === "grow" || plan.type === "weaken") {
		return {
			action: plan.type,
			target: plan.target,
		}
	}

	return null
}

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
		}
	}

	if (plan.type === "grow") {
		return {
			action: "grow",
			target: plan.target,
			desiredThreads: estimateGrowThreads(ns, server),
		}
	}

	if (plan.type === "hack") {
		return {
			action: "hack",
			target: plan.target,
			desiredThreads: estimateHackThreads(ns, server),
		}
	}

	return null
}
