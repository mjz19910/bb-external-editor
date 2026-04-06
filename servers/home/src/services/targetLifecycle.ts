import { CONFIG } from "../core/config"
import { GameState, TargetState, ServerState, TargetLifecycleState, TargetRegistry, TrackedTargetState } from "../core/types"

export function buildTargetStates(
	state: Omit<GameState, "targetStates">
): TargetState[] {
	return state.servers
		.map((server) => classifyTarget(server, state.player.hackingLevel))
		.sort((a, b) => b.score - a.score)
}

export function classifyTarget(
	server: ServerState,
	playerHackingLevel: number
): TargetState {
	const isHackable =
		server.rooted &&
		server.requiredHackingLevel <= playerHackingLevel &&
		server.maxMoney > 0

	const score = scoreTarget(server)

	if (!isHackable) {
		return {
			hostname: server.hostname,
			lifecycle: "UNAVAILABLE",
			maxMoney: server.maxMoney,
			currentMoney: server.currentMoney,
			minSecurity: server.minSecurity,
			currentSecurity: server.currentSecurity,
			score,
			isHackable: false,
		}
	}

	const securityTooHigh =
		server.currentSecurity > server.minSecurity + CONFIG.weakenThreshold

	const moneyTooLow =
		server.maxMoney > 0 &&
		server.currentMoney < server.maxMoney * CONFIG.growThresholdRatio

	let lifecycle: TargetLifecycleState = "READY"

	if (securityTooHigh && moneyTooLow) {
		lifecycle = "UNPREPPED"
	} else if (securityTooHigh) {
		lifecycle = "WEAKENING"
	} else if (moneyTooLow) {
		lifecycle = "GROWING"
	} else {
		lifecycle = "READY"
	}

	return {
		hostname: server.hostname,
		lifecycle,
		maxMoney: server.maxMoney,
		currentMoney: server.currentMoney,
		minSecurity: server.minSecurity,
		currentSecurity: server.currentSecurity,
		score,
		isHackable: true,
	}
}

export function reconcileTargetRegistry(
	observedTargets: TargetState[],
	previous: TargetRegistry,
	now: number
): TargetRegistry {
	const nextByHostname: Record<string, TrackedTargetState> = {}

	for (const observed of observedTargets) {
		const prior = previous.byHostname[observed.hostname]
		const lifecycle = determineTrackedLifecycle(observed, prior)

		const transitioned =
			!prior || prior.lifecycle !== lifecycle || prior.observedLifecycle !== observed.lifecycle

		const readyStreak =
			lifecycle === "READY" || lifecycle === "FARMING"
				? (prior?.readyStreak ?? 0) + 1
				: 0

		nextByHostname[observed.hostname] = {
			hostname: observed.hostname,
			lifecycle,
			observedLifecycle: observed.lifecycle,
			score: observed.score,
			isHackable: observed.isHackable,
			isActiveFarm: false,
			firstSeenAt: prior?.firstSeenAt ?? now,
			lastSeenAt: now,
			lastTransitionAt: transitioned ? now : prior?.lastTransitionAt ?? now,
			transitions: transitioned ? (prior?.transitions ?? 0) + 1 : prior?.transitions ?? 0,
			readyStreak,
		}
	}

	const activeFarmTargets = chooseActiveFarmTargets(
		nextByHostname,
		previous.activeFarmTargets
	)

	for (const hostname of activeFarmTargets) {
		const target = nextByHostname[hostname]
		if (!target) continue

		target.isActiveFarm = true

		if (target.lifecycle === "READY") {
			target.lifecycle = "FARMING"
		}
	}

	return {
		byHostname: nextByHostname,
		activeFarmTargets,
		lastUpdatedAt: now,
	}
}

function chooseActiveFarmTarget(
	targets: Record<string, TrackedTargetState>,
	previousActiveFarmTarget: string | null
): string | null {
	if (previousActiveFarmTarget) {
		const prior = targets[previousActiveFarmTarget]

		if (
			prior &&
			prior.isHackable &&
			(prior.lifecycle === "READY" ||
				prior.lifecycle === "FARMING" ||
				prior.lifecycle === "GROWING")
		) {
			return previousActiveFarmTarget
		}
	}

	const candidates = Object.values(targets)
		.filter(
			(target) =>
				target.isHackable &&
				(target.lifecycle === "READY" ||
					target.lifecycle === "FARMING" ||
					target.lifecycle === "GROWING")
		)
		.sort((a, b) => b.score - a.score)

	return candidates[0]?.hostname ?? null
}

export function scoreTarget(server: ServerState): number {
	const securityPenalty = Math.max(
		1,
		server.currentSecurity - server.minSecurity + 1
	)

	return (server.maxMoney * Math.max(1, server.growth)) / securityPenalty
}

const MIN_READY_STREAK = 3 // only consider a target READY after 3 consecutive loops
const MIN_TRANSITION_INTERVAL = 5000 // ms, minimal time between transitions

export function determineTrackedLifecycle(
	observed: TargetState,
	prior?: TrackedTargetState,
	now: number = Date.now()
): TargetLifecycleState {
	if (!prior) return observed.lifecycle

	if (!observed.isHackable) return "UNAVAILABLE"

	const timeSinceLastTransition = now - (prior.lastTransitionAt ?? 0)

	// enforce minimal interval between transitions
	if (timeSinceLastTransition < MIN_TRANSITION_INTERVAL) {
		return prior.lifecycle
	}

	// hysteresis for READY/FARMING
	if (observed.lifecycle === "READY" || observed.lifecycle === "FARMING") {
		if ((prior.readyStreak ?? 0) < MIN_READY_STREAK) {
			return "GROWING" // give it some loops to stabilize
		}
		return "READY"
	}

	return observed.lifecycle
}

function chooseActiveFarmTargets(
	targets: Record<string, TrackedTargetState>,
	previousActiveFarmTargets: string[]
): string[] {
	const candidates = Object.values(targets).filter(
		(target) =>
			target.isHackable &&
			(target.lifecycle === "READY" ||
				target.lifecycle === "FARMING" ||
				target.lifecycle === "GROWING")
	)

	const scored = candidates.map((target) => {
		const isPreviouslyActive = previousActiveFarmTargets.includes(target.hostname)
		const continuityBias = isPreviouslyActive
			? CONFIG.planner.activeFarmScoreBias
			: 1

		return {
			hostname: target.hostname,
			effectiveScore: target.score * continuityBias,
		}
	})

	return scored
		.sort((a, b) => b.effectiveScore - a.effectiveScore)
		.slice(0, CONFIG.planner.maxActiveFarmTargets)
		.map((entry) => entry.hostname)
}
