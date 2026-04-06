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

		// Only merge roots if neighbors actually changed
		if (neighborsChanged) {
			this.mergeRoots(ns)
		}
	}

	touchHost(ns: NS, host: string) {
		this.refreshSubtree(ns, host)
	}

	// ----------------------------
	// root merging
	// ----------------------------
	mergeRoots(ns: NS) {
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
		while (cur) {
			if (cur === ancestor) return true
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
