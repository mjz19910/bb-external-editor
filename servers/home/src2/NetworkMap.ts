import { NetworkNode } from "./types"

const DB_PATH = "data/network_map.json"

let network_map: NetworkMap | null = null

export class NetworkMap {
	roots: string[] = ["home"] // track disconnected subgraph roots

	constructor(
		public allHosts: string[] = [],
		public nodes: Record<string, NetworkNode> = {},
		public ramSizes: Record<string, number> = {},
	) { }

	// ----------------------------
	// safe scan
	// ----------------------------
	safeScan(ns: NS, host: string): string[] {
		try {
			if (!host || !ns.serverExists(host)) return []
			return ns.scan(host)
		} catch {
			return []
		}
	}

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

		const tempMap = new NetworkMap() // to use safeScan
		nodes[start] = { host: start, parent: null, depth: 0, neighbors: tempMap.safeScan(ns, start) }

		while (queue.length > 0) {
			const host = queue.shift()!
			const depth = nodes[host].depth
			const neighbors = tempMap.safeScan(ns, host)

			for (const next of neighbors) {
				if (seen.has(next)) continue
				seen.add(next)
				nodes[next] = { host: next, parent: host, depth: depth + 1, neighbors: tempMap.safeScan(ns, next) }
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

		this.mergeRoots(ns)
		this.save(ns)
		network_map = this
		return this
	}

	// ----------------------------
	// subtree / host updates
	// ----------------------------
	refreshSubtree(ns: NS, startHost: string) {
		this.fixupRoots(ns)
		this.repairOrphans()

		if (!this.nodes[startHost]) {
			this.roots.push(startHost)
			this.nodes[startHost] = {
				host: startHost,
				parent: null,
				depth: 0,
				neighbors: this.safeScan(ns, startHost),
			}
			this.ramSizes[startHost] = ns.getServerMaxRam(startHost)
			if (!this.allHosts.includes(startHost)) this.allHosts.push(startHost)
			ns.tprint(`[refreshSubtree] ${startHost} added as new root`)
		}

		const queue = [startHost]
		const seen = new Set([startHost])
		let neighborsChanged = false // track if any neighbor list changed

		while (queue.length > 0) {
			const host = queue.shift()!
			if (seen.has(host)) continue // extra guard
			seen.add(host)

			const node = this.nodes[host]
			const neighbors = this.safeScan(ns, host)

			// check if neighbors actually changed
			if (!arraysEqual(node.neighbors, neighbors)) {
				neighborsChanged = true
			}

			let parentValid = true
			if (node.parent && !neighbors.includes(node.parent)) {
				parentValid = false
				node.parent = null
				node.depth = 0
				if (!this.roots.includes(host)) this.roots.push(host)
				ns.tprint(`[refreshSubtree] ${host} lost parent, added to roots`)
			}

			node.neighbors = neighbors
			this.ramSizes[host] = ns.getServerMaxRam(host)

			for (const n of neighbors) {
				if (seen.has(n)) continue
				seen.add(n)

				if (!this.nodes[n]) {
					this.nodes[n] = {
						host: n,
						parent: parentValid ? host : null,
						depth: parentValid ? node.depth + 1 : 0,
						neighbors: this.safeScan(ns, n),
					}
					this.ramSizes[n] = ns.getServerMaxRam(n)
					if (!this.allHosts.includes(n)) this.allHosts.push(n)
					if (!parentValid) this.roots.push(n)
					ns.tprint(`[refreshSubtree] ${n} discovered as new node, ${parentValid ? `parent=${host}` : 'added to roots'}`)
				} else {
					const existingParent = this.nodes[n].parent
					if (existingParent && !this.nodes[n].neighbors.includes(existingParent)) {
						this.nodes[n].parent = null
						this.nodes[n].depth = 0
						if (!this.roots.includes(n)) this.roots.push(n)
						ns.tprint(`[refreshSubtree] ${n} lost parent, added to roots`)
					}
				}

				queue.push(n)
			}
		}

		const repairedCycles = this.repairCycles(ns)
		if (repairedCycles > 0) {
			console.log(`[refreshSubtree] repaired ${repairedCycles} cycle(s)`)
		}

		// Only merge roots if neighbors actually changed
		if (neighborsChanged) {
			this.mergeRoots(ns)
		}
	}

	touchHost(ns: NS, host: string) {
		this.refreshSubtree(ns, host)
	}

	fixupRoots(ns: NS) {
		if (!this.roots.includes("home")) {
			this.roots.unshift("home")
			const homeNode = this.nodes["home"] ?? { host: "home", parent: null, depth: 0, neighbors: this.safeScan(ns, "home") }
			this.nodes["home"] = homeNode
			console.log("[fixupRoots] Home re-added to roots")
		}
	}

	// ----------------------------
	// root merging
	// ----------------------------
	mergeRoots(ns: NS) {
		this.fixupRoots(ns)

		const newRoots: string[] = []

		for (const root of this.roots) {
			const node = this.nodes[root]
			if (!node) continue

			let attached = false
			for (const neighbor of node.neighbors) {
				const neighborNode = this.nodes[neighbor]
				if (!neighborNode) continue

				// Only attach if the neighbor is NOT in root's subtree
				if (!this.isDescendant(neighbor, root)) {
					node.parent = neighbor
					node.depth = neighborNode.depth + 1
					attached = true
					ns.tprint(`[mergeRoots] ${root} attached under ${neighbor}, removed from roots`)
					break
				}
			}

			if (!attached) {
				node.parent = null
				node.depth = 0
				newRoots.push(root)
				ns.tprint(`[mergeRoots] ${root} remains a root`)
			}
		}

		this.roots = newRoots
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
				neighbors: this.safeScan(ns, host),
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
		const scan_results = this.safeScan(ns, check_host)
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
				const checks = Math.min(3, hosts.length)
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

	repairOrphans() {
		// Step 1: find all reachable nodes
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

		// Step 2: orphaned nodes = nodes not in reachable
		for (const host of this.allHosts) {
			if (!reachable.has(host)) {
				const node = this.nodes[host]
				if (!node) continue

				// Try to attach to a neighbor that is reachable
				const attachTo = node.neighbors.find(n => reachable.has(n))
				if (attachTo && !this.isDescendant(attachTo, host)) {
					node.parent = attachTo
					node.depth = (this.nodes[attachTo]?.depth ?? 0) + 1
					reachable.add(host)
					console.log(`[repairOrphans] Node ${host} re-attached to neighbor ${attachTo}`)
				} else {
					// No reachable neighbor: make it a new root
					node.parent = null
					node.depth = 0
					if (!this.roots.includes(host)) this.roots.push(host)
					reachable.add(host)
					console.log(`[repairOrphans] Node ${host} added as new root (was orphan)`)
				}
			}
		}
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

	/**
	 * Log graph diagnostics to NS
	 */
	logDiagnostics(ns: NS, label = "Graph") {
		const issues = this.diagnoseGraph()
		if (issues.length === 0) {
			ns.tprint(`[${label}] No issues detected`)
		} else {
			ns.tprint(`[${label}] Detected ${issues.length} issues:`)
			for (const i of issues) ns.tprint(`  ${i}`)
		}
	}

	getCycles(): string[][] {
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

	findAnchorOutsideCycle(start: string, cycle: Set<string>, reachable?: Set<string>) {
		const queue: Array<{ host: string; dist: number }> = [{ host: start, dist: 0 }]
		const seen = new Set<string>([start])

		// best known distance to avoid revisiting deeper paths
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

				// Candidate anchor:
				// - not part of the cycle
				// - ideally already reachable from a known root
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

	getReachableFromRoots(): Set<string> {
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

	getBestCycleBreakNode(cycle: string[]) {
		let best = cycle[0]
		let bestDepth = this.nodes[best]?.depth ?? Number.MAX_SAFE_INTEGER

		for (const host of cycle) {
			const d = this.nodes[host]?.depth ?? Number.MAX_SAFE_INTEGER
			if (d < bestDepth) {
				best = host
				bestDepth = d
			}
		}

		return best
	}

	rebuildSubtreeParentsFrom(startHost: string) {
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

				// Don't assign parent if it would create a cycle
				if (this.isDescendant(host, neighbor)) continue

				// Only reparent if missing or obviously wrong
				const child = this.nodes[neighbor]
				if (child.parent == null || !child.neighbors.includes(child.parent)) {
					child.parent = host
					child.depth = node.depth + 1
					console.log(`[rebuildSubtree] ${neighbor} parent -> ${host}`)
				}

				seen.add(neighbor)
				queue.push(neighbor)
			}
		}
	}

	repairCycle(ns: NS, cycleNodes: string[]) {
		if (cycleNodes.length === 0) return false

		const cycle = new Set(cycleNodes)
		const breakNode = this.getBestCycleBreakNode(cycleNodes)
		const reachable = this.getReachableFromRoots()

		const anchor = this.findAnchorOutsideCycle(breakNode, cycle, reachable)

		if (anchor) {
			this.nodes[breakNode].parent = anchor
			this.nodes[breakNode].depth = (this.nodes[anchor]?.depth ?? 0) + 1
			console.log(`[repairCycle] Broke cycle at ${breakNode}, reattached under ${anchor}`)
		} else {
			// no safe anchor found: make it a root
			this.nodes[breakNode].parent = null
			this.nodes[breakNode].depth = 0
			if (!this.roots.includes(breakNode)) this.roots.push(breakNode)
			console.log(`[repairCycle] Broke cycle at ${breakNode}, promoted to root`)
		}

		// Now rebuild the subtree depths/parents under the repaired node
		this.rebuildSubtreeParentsFrom(breakNode)

		return true
	}

	repairCycles(ns: NS) {
		const cycles = this.getCycles()
		if (cycles.length === 0) return 0

		let repaired = 0
		for (const cycle of cycles) {
			console.log(`[repairCycles] Found cycle: ${cycle.join(" -> ")} -> ${cycle[0]}`)
			if (this.repairCycle(ns, cycle)) repaired++
		}

		return repaired
	}
}

// ----------------------------
// helper: compare two arrays (order doesn't matter)
// ----------------------------
function arraysEqual(a: string[], b: string[]): boolean {
	if (a.length !== b.length) return false
	const setA = new Set(a)
	const setB = new Set(b)
	if (setA.size !== setB.size) return false
	for (const v of setA) if (!setB.has(v)) return false
	return true
}
