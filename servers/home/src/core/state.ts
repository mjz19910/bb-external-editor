import {
	AutomationMode,
	GameState,
	PlayerState,
	ServerState,
} from "./types"
import { buildTargetStates } from "../services/targetLifecycle"

export function discoverAllServers(ns: NS): string[] {
	const visited = new Set<string>()
	const queue: string[] = ["home"]

	while (queue.length > 0) {
		const host = queue.shift()
		if (!host || visited.has(host)) continue

		visited.add(host)

		for (const neighbor of ns.scan(host)) {
			if (!visited.has(neighbor)) {
				queue.push(neighbor)
			}
		}
	}

	return [...visited]
}

export function getServerState(ns: NS, hostname: string): ServerState {
	const server = ns.getServer(hostname)

	if ("isOnline" in server) throw new Error("Invalid state")

	return {
		hostname,
		rooted: server.hasAdminRights,
		requiredHackingLevel: server.requiredHackingSkill!,
		maxMoney: server.moneyMax!,
		currentMoney: server.moneyAvailable!,
		minSecurity: server.minDifficulty!,
		currentSecurity: server.hackDifficulty!,
		maxRam: server.maxRam,
		usedRam: server.ramUsed,
		hasBackdoor: server.backdoorInstalled!,
		growth: server.serverGrowth!,
	}
}

export function getPlayerState(ns: NS): PlayerState {
	const player = ns.getPlayer()

	return {
		hackingLevel: player.skills.hacking,
		money: player.money,
	}
}

export function determineMode(state: {
	player: PlayerState
	rootedServers: ServerState[]
}): AutomationMode {
	if (state.rootedServers.length < 5) return "bootstrap"
	if (state.player.hackingLevel < 200) return "income"
	return "prep"
}

export function collectGameState(ns: NS): GameState {
	const hostnames = discoverAllServers(ns)
	const servers = hostnames.map((hostname) => getServerState(ns, hostname))
	const rootedServers = servers.filter((server) => server.rooted)
	const player = getPlayerState(ns)

	const hackableTargets = servers.filter(
		(server) =>
			server.rooted &&
			server.requiredHackingLevel <= player.hackingLevel &&
			server.maxMoney > 0
	)

	const bestTarget =
		[...hackableTargets].sort((a, b) => scoreServer(b) - scoreServer(a))[0] ??
		null

	const partialState = {
		timestamp: Date.now(),
		mode: determineMode({ player, rootedServers }),
		player,
		servers,
		rootedServers,
		hackableTargets,
		bestTarget,
	}

	const targetStates = buildTargetStates(partialState)

	return {
		...partialState,
		targetStates,
	}
}

export function shouldWeaken(server: ServerState): boolean {
	return server.currentSecurity > server.minSecurity + 5
}

export function shouldGrow(server: ServerState): boolean {
	if (server.maxMoney <= 0) return false
	return server.currentMoney < server.maxMoney * 0.75
}

export function scoreServer(server: ServerState): number {
	const securityPenalty = Math.max(
		1,
		server.currentSecurity - server.minSecurity + 1
	)

	return (server.maxMoney * Math.max(1, server.growth)) / securityPenalty
}
