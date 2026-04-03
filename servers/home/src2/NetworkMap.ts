import { NetworkNode } from "./types"

const DB_PATH = "data/network_map.json"

let saved_map_invalid = false
let network_map: NetworkMap | null = null

export class NetworkMap {
	static loadFromDisk(ns: NS, DB_PATH: string): NetworkMap | null {
		if (!ns.fileExists(DB_PATH)) {
			return null
		}

		const json_txt = ns.read(DB_PATH)
		const net_map: NetworkMap = JSON.parse(json_txt)

		if (!("ramSizes" in net_map)) {
			return null
		}

		const newMap = new NetworkMap()

		newMap.allHosts = net_map.allHosts

		// upgrade the schema
		if ("hosts" in net_map) {
			newMap.allHosts = net_map.hosts as string[]
		}

		newMap.nodes = net_map.nodes
		newMap.ramSizes = net_map.ramSizes

		return newMap
	}
	constructor(
		public allHosts: string[] = [],
		public nodes: Record<string, NetworkNode> = {},
		public ramSizes: Record<string, number> = {},
	) { }
	getRamInfo(ns: NS, host: string) {
		const maxRam = this.ramSizes[host]
		const usedRam = ns.getServerUsedRam(host)
		const free = maxRam - usedRam
		return {
			host,
			maxRam,
			usedRam,
			freeRam: free,
		}
	}
	findBestTarget(ns: NS) {
		const myHacking = ns.getHackingLevel()
		const map = this

		let best = null
		let bestValue = 0

		for (const s of map.allHosts) {
			if (s === "home") continue
			if (!ns.hasRootAccess(s)) continue
			if (ns.getServerRequiredHackingLevel(s) > (myHacking / 2) + 2) {
				continue
			}

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
	addNodes(ns: NS, parent: string, hosts: string[]) {
		const pn = this.nodes[parent]
		for (const host of hosts) {
			this.nodes[host] = {
				host,
				parent,
				depth: pn.depth + 1,
				neighbors: ns.scan(host),
			}
			this.allHosts.push(host)
			this.ramSizes[host] = ns.getServerMaxRam(host)
		}
		const json_txt = JSON.stringify(this, void 0, "\t")
		ns.write(DB_PATH, json_txt, "w")
	}
	static build(ns: NS, start = "home") {
		x: if (network_map) {
			const hosts = network_map.allHosts
			const nodes = network_map.nodes
			const hosts_len = hosts.length
			const recheck_idx = Math.floor(Math.random() * hosts_len)
			const check_host = hosts[recheck_idx]
			const scan_results = ns.scan(check_host)
			const nn = nodes[check_host]
			if (scan_results.length != nn.neighbors.length) {
				network_map = null
				saved_map_invalid = true
				break x
			}
			for (let i = 0; i < 3; i++) {
				const idx = Math.floor(Math.random() * hosts_len)
				network_map.update_single_host(ns, hosts[idx])
			}
			return network_map
		}
		if (!saved_map_invalid) {
			network_map = NetworkMap.loadFromDisk(ns, DB_PATH)
			if (network_map) return network_map
		}
		const nodes: Record<string, NetworkNode> = {}
		const queue: string[] = [start]
		const seen = new Set<string>([start])

		nodes[start] = {
			host: start,
			parent: null,
			depth: 0,
			neighbors: ns.scan(start),
		}

		while (queue.length > 0) {
			const host = queue.shift()!
			const depth = nodes[host].depth

			for (const next of ns.scan(host)) {
				if (seen.has(next)) continue
				seen.add(next)

				nodes[next] = {
					host: next,
					parent: host,
					depth: depth + 1,
					neighbors: ns.scan(next),
				}

				queue.push(next)
			}
		}

		const hosts = Object.keys(nodes)
		const ramSizes: Record<string, number> = {}
		for (const host of hosts) {
			ramSizes[host] = ns.getServerMaxRam(host)
		}
		network_map = new NetworkMap(hosts, nodes, ramSizes)
		const json_txt = JSON.stringify(network_map, void 0, "\t")
		ns.write(DB_PATH, json_txt, "w")
		return network_map
	}
	update_single_host(ns: NS, host: string) {
		this.ramSizes[host] = ns.getServerMaxRam(host)
	}
}
