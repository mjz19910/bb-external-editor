import { CONFIG } from "./config"
import { GameState, AutomationMode, ServerState } from "./types"

export function collectGameState(ns: NS): GameState {
	const discovered = discoverAllServers(ns)
	const servers = discovered.map((hostname) => getServerState(ns, hostname))
	const rootedServers = servers.filter((s) => s.rooted)
	const hackableTargets = rootedServers.filter(
		(s) =>
			s.maxMoney > 0 &&
			s.requiredHackingLevel <= ns.getHackingLevel() &&
			s.hostname !== "home"
	)

	const bestTarget = selectBestTarget(hackableTargets)

	return {
		timestamp: Date.now(),
		mode: determineMode(ns, hackableTargets.length),
		player: {
			hackingLevel: ns.getHackingLevel(),
			money: ns.getServerMoneyAvailable("home"),
		},
		servers,
		rootedServers,
		hackableTargets,
		bestTarget,
	}
}

function determineMode(ns: NS, hackableTargetCount: number): AutomationMode {
	if (hackableTargetCount === 0) return "bootstrap"
	if (ns.getHackingLevel() < 200) return "income"
	return "prep"
}

export function discoverAllServers(ns: NS): string[] {
	const visited = new Set<string>()
	const queue: string[] = ["home"]

	while (queue.length > 0) {
		const current = queue.shift()
		if (!current || visited.has(current)) continue

		visited.add(current)

		for (const neighbor of ns.scan(current)) {
			if (!visited.has(neighbor)) {
				queue.push(neighbor)
			}
		}
	}

	return [...visited]
}

export function getServerState(ns: NS, hostname: string): ServerState {
	const server = ns.getServer(hostname)
	if (server.backdoorInstalled === void 0) throw new Error("Invalid state")
	return {
		hostname,
		rooted: ns.hasRootAccess(hostname),
		requiredHackingLevel: ns.getServerRequiredHackingLevel(hostname),
		maxMoney: ns.getServerMaxMoney(hostname),
		currentMoney: ns.getServerMoneyAvailable(hostname),
		minSecurity: ns.getServerMinSecurityLevel(hostname),
		currentSecurity: ns.getServerSecurityLevel(hostname),
		maxRam: ns.getServerMaxRam(hostname),
		usedRam: ns.getServerUsedRam(hostname),
		hasBackdoor: server.backdoorInstalled,
		growth: ns.getServerGrowth(hostname),
	}
}

function selectBestTarget(servers: ServerState[]): ServerState | null {
	if (servers.length === 0) return null
	return [...servers].sort((a, b) => scoreServer(b) - scoreServer(a))[0] ?? null
}

function scoreServer(server: ServerState): number {
	if (server.maxMoney <= 0) return 0

	const securityGap = Math.max(
		1,
		server.currentSecurity - server.minSecurity + 1
	)

	const moneyRatio =
		server.maxMoney > 0 ? server.currentMoney / server.maxMoney : 0.1

	return (server.maxMoney * server.growth * (0.5 + moneyRatio)) / securityGap
}

export function shouldWeaken(server: ServerState): boolean {
	return server.currentSecurity - server.minSecurity > CONFIG.weakenThreshold
}

export function shouldGrow(server: ServerState): boolean {
	if (server.maxMoney <= 0) return false
	return server.currentMoney / server.maxMoney < CONFIG.growThresholdRatio
}
