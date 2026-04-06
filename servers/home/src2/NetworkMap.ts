import { NetworkNode } from "./types"

const DB_PATH = "data/network_map.json"

let network_map: NetworkMap | null = null


// ----------------------------
// safe scan
// ----------------------------
function safeScan(ns: NS, host: string): string[] {
	try {
		if (!host || !ns.serverExists(host)) return []
		return ns.scan(host)
	} catch {
		return []
	}
}

export class NetworkMap {
	roots: string[] = ["home"]

	constructor(
		public allHosts: string[] = [],
		public nodes: Record<string, NetworkNode> = {},
		public ramSizes: Record<string, number> = {},
	) { }

	// ----------------------------
	// persistence
	// ----------------------------
	save(ns: NS, path = DB_PATH) {
		const json_txt = JSON.stringify(this, null, "\t")
		ns.write(path, json_txt, "w")
		return this
	}

	static loadFromDisk(ns: NS, path = DB_PATH): NetworkMap | null {
		if (!ns.fileExists(path)) return null
		const json_txt = ns.read(path)
		if (!json_txt) return null

		let raw: unknown
		try { raw = JSON.parse(json_txt) } catch { return null }

		if (!raw || typeof raw !== "object") return null
		const net_map = raw as Partial<NetworkMap> & { hosts?: string[] }

		if (!("ramSizes" in net_map) || !("nodes" in net_map)) return null

		const newMap = new NetworkMap()
		newMap.allHosts = Array.isArray(net_map.allHosts)
			? net_map.allHosts
			: Array.isArray(net_map.hosts)
				? net_map.hosts
				: Object.keys(net_map.nodes ?? {})
		newMap.nodes = net_map.nodes as Record<string, NetworkNode>
		newMap.ramSizes = net_map.ramSizes as Record<string, number>
		newMap.roots = Array.isArray((net_map as any).roots) ? (net_map as any).roots : ["home"]

		return newMap
	}

	// ----------------------------
	// network scanning
	// ----------------------------
	static scanNetwork(ns: NS, start = "home") {
		const nodes: Record<string, NetworkNode> = {}
		const queue: string[] = [start]
		const seen = new Set<string>([start])

		nodes[start] = {
			host: start,
			parent: null,
			depth: 0,
			neighbors: safeScan(ns, start)
		}

		while (queue.length > 0) {
			const host = queue.shift()!
			const depth = nodes[host].depth
			const neighbors = safeScan(ns, host)

			for (const next of neighbors) {
				if (seen.has(next)) continue
				seen.add(next)
				nodes[next] = {
					host: next,
					parent: host,
					depth: depth + 1,
					neighbors: safeScan(ns, next)
				}
				queue.push(next)
			}
		}

		const allHosts = Object.keys(nodes)
		const ramSizes: Record<string, number> = {}
		for (const host of allHosts) ramSizes[host] = ns.getServerMaxRam(host)

		return { allHosts, nodes, ramSizes }
	}

	// ----------------------------
	// full network refresh
	// ----------------------------
	refresh(ns: NS, start = "home") {
		const scanned = NetworkMap.scanNetwork(ns, start)
		this.allHosts = scanned.allHosts
		this.nodes = scanned.nodes
		this.ramSizes = scanned.ramSizes
		this.roots = ["home"]

		this.save(ns)
		network_map = this
		return this
	}

	// ----------------------------
	// subtree / host updates
	// ----------------------------
	refreshSubtree(ns: NS, startHost: string) {
		if (!this.nodes[startHost]) {
			this.roots.push(startHost)
			this.nodes[startHost] = {
				host: startHost,
				parent: null,
				depth: 0,
				neighbors: safeScan(ns, startHost),
			}
			this.ramSizes[startHost] = ns.getServerMaxRam(startHost)
			if (!this.allHosts.includes(startHost)) this.allHosts.push(startHost)
		}

		const queue = [startHost]
		const seen = new Set<string>()

		while (queue.length > 0) {
			const host = queue.shift()!
			if (seen.has(host)) continue
			seen.add(host)

			const node = this.nodes[host]
			const neighbors = safeScan(ns, host)
			node.neighbors = neighbors
			this.ramSizes[host] = ns.getServerMaxRam(host)

			for (const n of neighbors) {
				if (!this.nodes[n]) {
					this.nodes[n] = {
						host: n,
						parent: host,
						depth: node.depth + 1,
						neighbors: safeScan(ns, n),
					}
					this.ramSizes[n] = ns.getServerMaxRam(n)
					if (!this.allHosts.includes(n)) this.allHosts.push(n)
				}

				if (!seen.has(n)) queue.push(n)
			}
		}
	}

	touchHost(ns: NS, host: string) {
		this.refreshSubtree(ns, host)
		this.healGraph()
	}

	// ----------------------------
	// root merging
	// ----------------------------
	mergeRoots() {
		const newRoots: string[] = []

		for (const root of this.roots) {
			const node = this.nodes[root]
			if (!node) continue

			if (root === "home") {
				node.parent = null
				node.depth = 0
				newRoots.push(root)
				continue
			}

			let bestParent: string | null = null
			let bestDepth = Number.MAX_SAFE_INTEGER

			for (const neighbor of node.neighbors) {
				const neighborNode = this.nodes[neighbor]
				if (!neighborNode) continue
				if (this.isDescendant(neighbor, root)) continue

				const d = neighborNode.depth ?? Number.MAX_SAFE_INTEGER
				if (d < bestDepth) {
					bestDepth = d
					bestParent = neighbor
				}
			}

			if (bestParent) {
				node.parent = bestParent
				node.depth = (this.nodes[bestParent]?.depth ?? 0) + 1
				this.recomputeDepthsFrom(root)
			} else {
				node.parent = null
				node.depth = 0
				newRoots.push(root)
			}
		}

		this.roots = [...new Set(newRoots)]
	}

	// ----------------------------
	// helper: checks if node is a descendant of a potential ancestor
	// ----------------------------
	isDescendant(nodeName: string, ancestor: string): boolean {
		let cur: string | null = nodeName
		const visited = new Set<string>()

		while (cur) {
			if (cur === ancestor) return true
			if (visited.has(cur)) return false // cycle detected, stop traversal
			visited.add(cur)
			cur = this.nodes[cur]?.parent ?? null
		}

		return false
	}

	// ----------------------------
	// add nodes manually
	// ----------------------------
	addNodes(ns: NS, parent: string, hosts: string[]) {
		const pn = this.nodes[parent]
		if (!pn) return

		for (const host of hosts) {
			if (this.nodes[host]) continue

			this.nodes[host] = {
				host,
				parent,
				depth: pn.depth + 1,
				neighbors: safeScan(ns, host),
			}

			if (!this.allHosts.includes(host)) this.allHosts.push(host)
			this.ramSizes[host] = ns.getServerMaxRam(host)
		}

		this.save(ns)
	}

	// ----------------------------
	// validation
	// ----------------------------
	isLikelyStale(ns: NS) {
		if (this.allHosts.length === 0) return true
		const hosts = this.allHosts
		const nodes = this.nodes
		const check_host = hosts[Math.floor(Math.random() * hosts.length)]
		const known = nodes[check_host]
		if (!known) return true
		const scan_results = safeScan(ns, check_host)
		return scan_results.length !== known.neighbors.length
	}

	// ----------------------------
	// builders
	// ----------------------------
	static build(ns: NS, start = "home") {
		if (network_map) {
			if (network_map.isLikelyStale(ns)) network_map.refresh(ns, start)
			else {
				const hosts = network_map.allHosts
				const checks = Math.min(1, hosts.length)
				for (let i = 0; i < checks; i++) {
					network_map.touchHost(ns, hosts[Math.floor(Math.random() * hosts.length)])
				}
			}
			return network_map
		}

		const loaded = NetworkMap.loadFromDisk(ns, DB_PATH)
		if (loaded) {
			network_map = loaded
			if (network_map.isLikelyStale(ns)) network_map.refresh(ns, start)
			return network_map
		}

		network_map = new NetworkMap().refresh(ns, start)
		return network_map
	}

	// ----------------------------
	// helpers
	// ----------------------------
	getRamInfo(ns: NS, host: string) {
		const maxRam = this.ramSizes[host] ?? 0
		const usedRam = ns.getServerUsedRam(host)
		return { host, maxRam, usedRam, freeRam: maxRam - usedRam }
	}

	findBestTarget(ns: NS) {
		const myHacking = ns.getHackingLevel()
		let best: string | null = null
		let bestValue = 0

		for (const s of this.allHosts) {
			if (s === "home") continue
			if (!ns.hasRootAccess(s)) continue
			if (ns.getServerRequiredHackingLevel(s) > myHacking / 2 + 2) continue

			const maxMoney = ns.getServerMaxMoney(s)
			if (maxMoney <= 0) continue

			const reqHack = ns.getServerRequiredHackingLevel(s)
			const minSec = ns.getServerMinSecurityLevel(s)
			const growth = ns.getServerGrowth(s)
			const score = (maxMoney * growth) / Math.max(1, minSec * reqHack)

			if (score > bestValue) {
				bestValue = score
				best = s
			}
		}

		return best
	}

	pathTo(host: string) {
		if (!this.nodes[host]) return null
		const path: string[] = []
		let cur: string | null = host
		while (cur) {
			path.push(cur)
			cur = this.nodes[cur]?.parent ?? null
		}
		path.reverse()
		return path
	}

	connectString(host: string) {
		const path = this.pathTo(host)
		if (!path) return null
		return path.map(h => `connect ${h};`).join(" ")
	}

	/**
	 * Diagnose the current network map for corruption or inconsistencies
	 */
	diagnoseGraph() {
		const issues: string[] = []

		// --- cycle detection ---
		const reportedCycleNodes = new Set<string>()

		for (const host of this.allHosts) {
			if (reportedCycleNodes.has(host)) continue

			const visited = new Set<string>()
			let cur: string | null = host
			while (cur) {
				if (visited.has(cur)) {
					// report this cycle once, using the first node we found
					const representative = host
					issues.push(`[cycle] Detected cycle at node ${representative}`)
					// mark all nodes in this cycle as reported
					for (const n of visited) reportedCycleNodes.add(n)
					break
				}
				visited.add(cur)
				cur = this.nodes[cur]?.parent ?? null
			}
		}

		// --- 2. Detect unreachable nodes from any root ---
		const reachable = new Set<string>()
		const queue = [...this.roots]
		for (const root of this.roots) reachable.add(root)

		while (queue.length > 0) {
			const host = queue.shift()!
			const node = this.nodes[host]
			if (!node) continue
			for (const neighbor of node.neighbors) {
				if (this.nodes[neighbor] && !reachable.has(neighbor)) {
					reachable.add(neighbor)
					queue.push(neighbor)
				}
			}
		}

		for (const host of this.allHosts) {
			if (!reachable.has(host)) issues.push(`[orphan] Node ${host} is unreachable from any root`)
		}

		// --- 3. Detect nodes with missing or invalid parents ---
		for (const host of this.allHosts) {
			const node = this.nodes[host]
			if (!node) continue
			if (node.parent && !this.nodes[node.parent]) {
				issues.push(`[invalid parent] Node ${host} has missing parent ${node.parent}`)
			}
			if (node.parent && !node.neighbors.includes(node.parent)) {
				issues.push(`[broken link] Node ${host} has parent ${node.parent} not in neighbors`)
			}
		}

		// --- 4. Detect root inconsistencies ---
		for (const root of this.roots) {
			if (!this.nodes[root]) issues.push(`[invalid root] Root ${root} does not exist in nodes`)
		}

		if (!this.roots.includes("home")) issues.push(`[missing root] Home is missing from roots`)

		return issues
	}

	private fixupHomeInvariant() {
		const homeNode = this.nodes["home"] ?? {
			host: "home",
			parent: null,
			depth: 0,
			neighbors: [],
		}

		homeNode.parent = null
		homeNode.depth = 0
		this.nodes["home"] = homeNode

		if (!this.roots.includes("home")) this.roots.unshift("home")
	}

	private fixupRoots() {
		const dedup = new Set<string>()
		const validRoots: string[] = []

		for (const root of this.roots) {
			if (!root) continue
			if (!this.nodes[root]) continue
			if (dedup.has(root)) continue
			dedup.add(root)
			validRoots.push(root)
		}

		if (!validRoots.includes("home")) validRoots.unshift("home")
		this.roots = validRoots
	}

	private repairBrokenParent(host: string) {
		const node = this.nodes[host]
		if (!node) return false

		let bestParent: string | null = null
		let bestDepth = Number.MAX_SAFE_INTEGER

		for (const neighbor of node.neighbors) {
			const neighborNode = this.nodes[neighbor]
			if (!neighborNode) continue

			// don't create a cycle
			if (this.isDescendant(neighbor, host)) continue

			const d = neighborNode.depth ?? Number.MAX_SAFE_INTEGER
			if (d < bestDepth) {
				bestDepth = d
				bestParent = neighbor
			}
		}

		if (bestParent) {
			node.parent = bestParent
			node.depth = (this.nodes[bestParent]?.depth ?? 0) + 1
			this.roots = this.roots.filter(r => r !== host)
			this.recomputeDepthsFrom(host)
			return true
		}

		node.parent = null
		node.depth = 0
		if (!this.roots.includes(host)) this.roots.push(host)
		return true
	}

	private repairBrokenLinks() {
		for (const host of this.allHosts) {
			const node = this.nodes[host]
			if (!node) continue
			if (host === "home") continue

			if (node.parent && !this.nodes[node.parent]) {
				this.repairBrokenParent(host)
				continue
			}

			if (node.parent && !node.neighbors.includes(node.parent)) {
				this.repairBrokenParent(host)
				continue
			}

			if (!node.parent && !this.roots.includes(host)) {
				this.repairBrokenParent(host)
			}
		}
	}

	private recomputeDepthsFrom(startHost: string) {
		const startNode = this.nodes[startHost]
		if (!startNode) return

		const queue = [startHost]
		const seen = new Set<string>([startHost])

		while (queue.length > 0) {
			const host = queue.shift()!
			const node = this.nodes[host]
			if (!node) continue

			for (const childHost of this.allHosts) {
				const child = this.nodes[childHost]
				if (!child) continue
				if (child.parent !== host) continue
				if (seen.has(childHost)) continue

				child.depth = node.depth + 1
				seen.add(childHost)
				queue.push(childHost)
			}
		}
	}

	private getReachableFromRoots(): Set<string> {
		const reachable = new Set<string>()
		const queue = [...this.roots]

		for (const root of this.roots) {
			if (this.nodes[root]) reachable.add(root)
		}

		while (queue.length > 0) {
			const host = queue.shift()!
			const node = this.nodes[host]
			if (!node) continue

			for (const neighbor of node.neighbors) {
				if (!this.nodes[neighbor]) continue
				if (reachable.has(neighbor)) continue
				reachable.add(neighbor)
				queue.push(neighbor)
			}
		}

		return reachable
	}

	private repairOrphans() {
		const reachable = this.getReachableFromRoots()

		for (const host of this.allHosts) {
			if (reachable.has(host)) continue

			const node = this.nodes[host]
			if (!node) continue
			if (host === "home") continue

			const attachTo = node.neighbors
				.filter(n => reachable.has(n) && this.nodes[n] && !this.isDescendant(n, host))
				.sort((a, b) => (this.nodes[a]?.depth ?? 999999) - (this.nodes[b]?.depth ?? 999999))[0]

			if (attachTo) {
				node.parent = attachTo
				node.depth = (this.nodes[attachTo]?.depth ?? 0) + 1
				reachable.add(host)
				this.recomputeDepthsFrom(host)
			} else {
				node.parent = null
				node.depth = 0
				if (!this.roots.includes(host)) this.roots.push(host)
				reachable.add(host)
			}
		}
	}

	private getCycles(): string[][] {
		const cycles: string[][] = []
		const globallySeen = new Set<string>()

		for (const host of this.allHosts) {
			if (globallySeen.has(host)) continue
			if (!this.nodes[host]) continue

			const path: string[] = []
			const pathIndex = new Map<string, number>()
			let cur: string | null = host

			while (cur && this.nodes[cur]) {
				if (pathIndex.has(cur)) {
					const start = pathIndex.get(cur)!
					const cycle = path.slice(start)

					for (const n of cycle) globallySeen.add(n)
					cycles.push(cycle)
					break
				}

				if (globallySeen.has(cur)) break

				pathIndex.set(cur, path.length)
				path.push(cur)
				cur = this.nodes[cur]?.parent ?? null
			}

			for (const n of path) globallySeen.add(n)
		}

		return cycles
	}

	private getBestCycleBreakNode(cycle: string[]) {
		let candidates = cycle.filter(h => h !== "home")
		if (candidates.length === 0) candidates = cycle

		let best = candidates[0]
		let bestDepth = this.nodes[best]?.depth ?? Number.MAX_SAFE_INTEGER

		for (const host of candidates) {
			const d = this.nodes[host]?.depth ?? Number.MAX_SAFE_INTEGER
			if (d < bestDepth) {
				best = host
				bestDepth = d
			}
		}

		return best
	}

	private findAnchorOutsideCycle(start: string, cycle: Set<string>, reachable?: Set<string>) {
		const queue: Array<{ host: string; dist: number }> = [{ host: start, dist: 0 }]
		const seen = new Set<string>([start])
		const bestDist = new Map<string, number>()
		bestDist.set(start, 0)

		while (queue.length > 0) {
			const { host, dist } = queue.shift()!
			const node = this.nodes[host]
			if (!node) continue

			for (const neighbor of node.neighbors) {
				if (!this.nodes[neighbor]) continue

				const nextDist = dist + 1
				const prevBest = bestDist.get(neighbor)
				if (prevBest !== undefined && prevBest <= nextDist) continue
				bestDist.set(neighbor, nextDist)

				if (seen.has(neighbor)) continue
				seen.add(neighbor)

				if (!cycle.has(neighbor)) {
					if (!reachable || reachable.has(neighbor)) {
						return neighbor
					}
				}

				queue.push({ host: neighbor, dist: nextDist })
			}
		}

		return null
	}

	private rebuildSubtreeParentsFrom(startHost: string) {
		if (!this.nodes[startHost]) return

		const queue = [startHost]
		const seen = new Set<string>([startHost])

		while (queue.length > 0) {
			const host = queue.shift()!
			const node = this.nodes[host]
			if (!node) continue

			for (const neighbor of node.neighbors) {
				if (!this.nodes[neighbor]) continue
				if (seen.has(neighbor)) continue
				if (this.isDescendant(host, neighbor)) continue

				const child = this.nodes[neighbor]
				if (child.parent == null || !child.neighbors.includes(child.parent)) {
					child.parent = host
					child.depth = node.depth + 1
				}

				seen.add(neighbor)
				queue.push(neighbor)
			}
		}
	}

	private repairCycle(cycleNodes: string[]) {
		if (cycleNodes.length === 0) return false

		const cycle = new Set(cycleNodes)
		const breakNode = this.getBestCycleBreakNode(cycleNodes)

		if (breakNode === "home") {
			this.nodes["home"].parent = null
			this.nodes["home"].depth = 0
			if (!this.roots.includes("home")) this.roots.unshift("home")
			this.rebuildSubtreeParentsFrom("home")
			return true
		}

		const reachable = this.getReachableFromRoots()
		const anchor = this.findAnchorOutsideCycle(breakNode, cycle, reachable)

		if (anchor && !this.isDescendant(anchor, breakNode)) {
			this.nodes[breakNode].parent = anchor
			this.nodes[breakNode].depth = (this.nodes[anchor]?.depth ?? 0) + 1
		} else {
			this.nodes[breakNode].parent = null
			this.nodes[breakNode].depth = 0
			if (!this.roots.includes(breakNode)) this.roots.push(breakNode)
		}

		this.rebuildSubtreeParentsFrom(breakNode)
		return true
	}

	private repairCycles() {
		for (const cycle of this.getCycles()) {
			this.repairCycle(cycle)
		}
	}

	private healGraph() {
		this.fixupRoots()
		this.fixupHomeInvariant()
		this.repairBrokenLinks()
		this.repairCycles()
		this.repairOrphans()
		this.mergeRoots()
	}
}
