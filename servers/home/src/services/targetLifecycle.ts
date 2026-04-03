import { CONFIG } from "../core/config"
import { GameState, ServerState, TargetLifecycleState, TargetState } from "../core/types"

export function buildTargetStates(state: Omit<GameState, "targetStates">): TargetState[] {
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

export function scoreTarget(server: ServerState): number {
	const securityPenalty = Math.max(
		1,
		server.currentSecurity - server.minSecurity + 1
	)

	return (server.maxMoney * Math.max(1, server.growth)) / securityPenalty
}
